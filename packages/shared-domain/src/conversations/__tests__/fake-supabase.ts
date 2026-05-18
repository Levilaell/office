// =============================================================================
// Fake Supabase mínimo pra testes de domínio que não envolvem RLS/banco real.
//
// Suporta apenas o subset usado pelas funções em src/conversations:
//   from(table).select('*' | 'col1,col2').eq(c,v)*.single()|maybeSingle()
//   from(table).insert(row).select().single()
//   from(table).update(patch).eq(c,v) (awaitable direto)
//
// Emula UNIQUE (tenant_id, account_id, channel, channel_handle) pra conversations
// retornando código '23505' como o Postgres real faria.
// =============================================================================

type Row = Record<string, unknown> & { id: string };

export type SupabaseError = { code: string; message: string };

const UNIQUE_KEYS_BY_TABLE: Record<string, string[][]> = {
  conversations: [['tenant_id', 'account_id', 'channel', 'channel_handle']],
};

// Defaults DB pra columns que o domain não seta (delegando ao DEFAULT do
// Postgres). O fake simula esses pra rows ficarem com forma realista.
const DEFAULTS_BY_TABLE: Record<string, Record<string, unknown>> = {
  conversations: {
    status: 'open',
    unread_count: 0,
    metadata: {},
    last_message_at: null,
    subject: null,
  },
  interactions: {
    metadata: {},
  },
};

const isMatch = (row: Row, filters: Array<[string, unknown]>): boolean => {
  for (const [col, val] of filters) {
    if (row[col] !== val) return false;
  }
  return true;
};

export type FakeTables = {
  conversations: Row[];
  interactions: Row[];
  audit_log: Row[];
} & Record<string, Row[]>;

export class FakeSupabase {
  tables: FakeTables = {
    conversations: [],
    interactions: [],
    audit_log: [],
  };
  // Permite verificar chamadas em testes.
  inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  updates: Array<{ table: string; patch: Record<string, unknown>; filters: Array<[string, unknown]> }> = [];

  from(table: string): FakeQuery {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeQuery(this, table);
  }
}

type Mode = 'select' | 'insert' | 'update' | 'delete';

export class FakeQuery implements PromiseLike<{ data: unknown; error: SupabaseError | null }> {
  private mode: Mode = 'select';
  private selectedCols: string = '*';
  private filters: Array<[string, unknown]> = [];
  private insertRow: Record<string, unknown> | null = null;
  private updatePatch: Record<string, unknown> | null = null;
  private wantSingle: 'single' | 'maybeSingle' | null = null;

  constructor(private store: FakeSupabase, private table: string) {}

  select(cols: string = '*'): FakeQuery {
    this.selectedCols = cols;
    if (this.mode !== 'insert') this.mode = 'select';
    return this;
  }

  insert(row: Record<string, unknown>): FakeQuery {
    this.mode = 'insert';
    this.insertRow = row;
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

  order(_col: string, _opts?: unknown): FakeQuery {
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
      | ((value: { data: unknown; error: SupabaseError | null }) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: SupabaseError | null } {
    const rows = this.store.tables[this.table] ?? [];

    if (this.mode === 'insert' && this.insertRow) {
      this.store.inserts.push({ table: this.table, row: this.insertRow });
      // Verifica UNIQUE constraints.
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
      // Se houve .select() depois, retorna o row; .single() ainda extrai um único.
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
      return { data: null, error: null };
    }

    // select
    const filtered = rows.filter((r) => isMatch(r, this.filters));
    const projected =
      this.selectedCols === '*'
        ? filtered
        : filtered.map((r) => {
            const out: Record<string, unknown> = {};
            for (const c of this.selectedCols.split(',').map((s) => s.trim())) {
              out[c] = r[c];
            }
            return out;
          });

    if (this.wantSingle === 'single') {
      if (projected.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      return { data: projected[0], error: null };
    }
    if (this.wantSingle === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null };
    }
    return { data: projected, error: null };
  }
}
