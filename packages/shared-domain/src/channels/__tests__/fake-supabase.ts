// =============================================================================
// Fake Supabase pra testes de channel_sessions. Diferente do fake de
// conversations: suporta UPSERT (que conversations não usa) e tem defaults
// específicos da tabela.
// =============================================================================

type Row = Record<string, unknown> & { id: string };

export type SupabaseError = { code: string; message: string };

const UNIQUE_KEYS_BY_TABLE: Record<string, string[][]> = {
  channel_sessions: [['tenant_id', 'channel']],
};

const DEFAULTS_BY_TABLE: Record<string, Record<string, unknown>> = {
  channel_sessions: {
    status: 'disconnected',
    connection_metadata: {},
    identifier: null,
    display_name: null,
    secrets_ref: null,
    last_health_check: null,
    last_message_at: null,
    error_details: null,
  },
};

const isMatch = (row: Row, filters: Array<[string, unknown]>): boolean => {
  for (const [col, val] of filters) {
    if (row[col] !== val) return false;
  }
  return true;
};

export type FakeTables = {
  channel_sessions: Row[];
  audit_log: Row[];
} & Record<string, Row[]>;

export class FakeSupabase {
  tables: FakeTables = {
    channel_sessions: [],
    audit_log: [],
  };
  inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  updates: Array<{
    table: string;
    patch: Record<string, unknown>;
    filters: Array<[string, unknown]>;
  }> = [];

  from(table: string): FakeQuery {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeQuery(this, table);
  }
}

type Mode = 'select' | 'insert' | 'update' | 'upsert';

export class FakeQuery
  implements PromiseLike<{ data: unknown; error: SupabaseError | null }>
{
  private mode: Mode = 'select';
  private selectedCols: string = '*';
  private filters: Array<[string, unknown]> = [];
  private insertRow: Record<string, unknown> | null = null;
  private updatePatch: Record<string, unknown> | null = null;
  private upsertOnConflict: string | null = null;
  private wantSingle: 'single' | 'maybeSingle' | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;

  constructor(
    private store: FakeSupabase,
    private table: string,
  ) {}

  select(cols: string = '*'): FakeQuery {
    this.selectedCols = cols;
    if (this.mode === 'select') this.mode = 'select';
    return this;
  }

  insert(row: Record<string, unknown>): FakeQuery {
    this.mode = 'insert';
    this.insertRow = row;
    return this;
  }

  upsert(
    row: Record<string, unknown>,
    options: { onConflict?: string } = {},
  ): FakeQuery {
    this.mode = 'upsert';
    this.insertRow = row;
    this.upsertOnConflict = options.onConflict ?? null;
    return this;
  }

  update(patch: Record<string, unknown>): FakeQuery {
    this.mode = 'update';
    this.updatePatch = patch;
    return this;
  }

  eq(col: string, val: unknown): FakeQuery {
    this.filters.push([col, val]);
    return this;
  }

  order(col: string, opts: { ascending?: boolean } = {}): FakeQuery {
    this.orderCol = col;
    this.orderAsc = opts.ascending !== false;
    return this;
  }

  limit(_n: number): FakeQuery {
    return this;
  }

  single(): FakeQuery {
    this.wantSingle = 'single';
    return this;
  }

  maybeSingle(): FakeQuery {
    this.wantSingle = 'maybeSingle';
    return this;
  }

  then<TResult1 = { data: unknown; error: SupabaseError | null }, TResult2 = never>(
    onfulfilled?:
      | ((
          value: { data: unknown; error: SupabaseError | null },
        ) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: SupabaseError | null } {
    const rows = this.store.tables[this.table] ?? [];

    if (this.mode === 'upsert' && this.insertRow) {
      // Conflict keys vêm em string `col1,col2` (espelhando supabase-js).
      const conflictCols = (this.upsertOnConflict ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (conflictCols.length > 0) {
        const existing = rows.find((r) =>
          conflictCols.every((c) => r[c] === this.insertRow?.[c]),
        );
        if (existing) {
          this.store.updates.push({
            table: this.table,
            patch: this.insertRow,
            filters: conflictCols.map((c) => [c, this.insertRow?.[c] as unknown]),
          });
          for (const [k, v] of Object.entries(this.insertRow)) {
            existing[k] = v as unknown;
          }
          existing.updated_at = new Date().toISOString();
          if (this.wantSingle) return { data: existing, error: null };
          return { data: [existing], error: null };
        }
      }
      // Cai pra insert normal
      this.mode = 'insert';
    }

    if (this.mode === 'insert' && this.insertRow) {
      this.store.inserts.push({ table: this.table, row: this.insertRow });
      const uniques = UNIQUE_KEYS_BY_TABLE[this.table] ?? [];
      for (const cols of uniques) {
        const dup = rows.find((r) => cols.every((c) => r[c] === this.insertRow?.[c]));
        if (dup) {
          return { data: null, error: { code: '23505', message: 'unique violation' } };
        }
      }
      const id = (this.insertRow.id as string) ?? `id-${rows.length + 1}-${this.table}`;
      const created_at = (this.insertRow.created_at as string) ?? new Date().toISOString();
      const updated_at = (this.insertRow.updated_at as string) ?? created_at;
      const defaults = DEFAULTS_BY_TABLE[this.table] ?? {};
      const row: Row = { ...defaults, ...this.insertRow, id, created_at, updated_at };
      rows.push(row);
      this.store.tables[this.table] = rows;
      if (this.wantSingle === 'single' || this.wantSingle === 'maybeSingle') {
        return { data: row, error: null };
      }
      return { data: [row], error: null };
    }

    if (this.mode === 'update' && this.updatePatch) {
      this.store.updates.push({
        table: this.table,
        patch: this.updatePatch,
        filters: this.filters.slice(),
      });
      const matched = rows.filter((r) => isMatch(r, this.filters));
      for (const r of matched) {
        for (const [k, v] of Object.entries(this.updatePatch)) {
          r[k] = v as unknown;
        }
      }
      if (this.wantSingle === 'single') {
        return matched[0]
          ? { data: matched[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      if (this.wantSingle === 'maybeSingle') {
        return { data: matched[0] ?? null, error: null };
      }
      return { data: matched, error: null };
    }

    let filtered = rows.filter((r) => isMatch(r, this.filters));
    if (this.orderCol) {
      const col = this.orderCol;
      filtered = filtered.slice().sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av === bv) return 0;
        if (av == null) return this.orderAsc ? 1 : -1;
        if (bv == null) return this.orderAsc ? -1 : 1;
        return (av as number | string) < (bv as number | string)
          ? this.orderAsc
            ? -1
            : 1
          : this.orderAsc
            ? 1
            : -1;
      });
    }

    if (this.wantSingle === 'single') {
      if (filtered.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      return { data: filtered[0], error: null };
    }
    if (this.wantSingle === 'maybeSingle') {
      return { data: filtered[0] ?? null, error: null };
    }
    return { data: filtered, error: null };
  }
}
