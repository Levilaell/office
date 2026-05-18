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
  messages: {
    metadata: {},
  },
  // Sprint 1.3 — message_drafts. Defaults espelham o schema.
  message_drafts: {
    status: 'pending',
    content_type: 'text',
    confidence: null,
    reasoning: null,
    edit_diff: null,
    expires_at: null,
    final_message_id: null,
    resolved_by: null,
    resolved_at: null,
    agent_run_id: null,
    source_message_id: null,
  },
  // Sprint 1.3 — obligations e documents também precisam de defaults
  // mínimos pra testes de tools.
  obligations: {
    status: 'pending',
    metadata: {},
    amount: null,
    amount_paid: null,
    paid_at: null,
    description: null,
    reference_period: null,
    payment_method: null,
    payment_link: null,
    payment_code: null,
    notes: null,
    entity_id: null,
  },
  documents: {
    status: 'pending',
    metadata: {},
    competencia: null,
    reference_date: null,
    received_at: null,
    processed_at: null,
    storage_path: null,
    file_name: null,
    file_size: null,
    mime_type: null,
    source: null,
    source_message_id: null,
    notes: null,
    description: null,
    entity_id: null,
  },
  // Sprint 1.4 — leads. Espelha colunas da migration.
  leads: {
    status: 'new',
    qualification_data: {},
    source_metadata: {},
    primary_contact_id: null,
    primary_conversation_id: null,
    estimated_value_monthly: null,
    notes: null,
    assigned_to_user_id: null,
    converted_to_account_id: null,
    qualified_at: null,
    scheduled_call_at: null,
    converted_at: null,
    lost_reason: null,
  },
};

// Sprint 1.3 — filtros estendidos pra suportar `gte`, `lte`, `in` usados
// pelas tools do Especialista Operacional.
type Filter =
  | { op: 'eq'; col: string; val: unknown }
  | { op: 'gte'; col: string; val: unknown }
  | { op: 'lte'; col: string; val: unknown }
  | { op: 'in'; col: string; values: unknown[] };

const isMatch = (row: Row, filters: Filter[]): boolean => {
  for (const f of filters) {
    const cell = row[f.col];
    if (f.op === 'eq') {
      if (cell !== f.val) return false;
    } else if (f.op === 'gte') {
      if (cell === null || cell === undefined) return false;
      // String compare seguro pra ISO dates e UUIDs.
      if ((cell as never) < (f.val as never)) return false;
    } else if (f.op === 'lte') {
      if (cell === null || cell === undefined) return false;
      if ((cell as never) > (f.val as never)) return false;
    } else if (f.op === 'in') {
      if (!f.values.includes(cell)) return false;
    }
  }
  return true;
};

export type FakeTables = {
  conversations: Row[];
  messages: Row[];
  audit_log: Row[];
} & Record<string, Row[]>;

export class FakeSupabase {
  tables: FakeTables = {
    conversations: [],
    messages: [],
    audit_log: [],
  };
  // Permite verificar chamadas em testes.
  inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  updates: Array<{ table: string; patch: Record<string, unknown>; filters: Filter[] }> = [];

  from(table: string): FakeQuery {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeQuery(this, table);
  }
}

type Mode = 'select' | 'insert' | 'update' | 'delete';

type OrderClause = { col: string; ascending: boolean };

export class FakeQuery implements PromiseLike<{ data: unknown; error: SupabaseError | null }> {
  private mode: Mode = 'select';
  private selectedCols: string = '*';
  private filters: Filter[] = [];
  private insertRow: Record<string, unknown> | null = null;
  private updatePatch: Record<string, unknown> | null = null;
  private wantSingle: 'single' | 'maybeSingle' | null = null;
  private orders: OrderClause[] = [];
  private limitN: number | null = null;
  private selectAfterMutation: boolean = false;

  constructor(private store: FakeSupabase, private table: string) {}

  select(cols: string = '*'): FakeQuery {
    this.selectedCols = cols;
    // insert().select() / update().select() devolvem rows mutadas.
    if (this.mode === 'insert' || this.mode === 'update') {
      this.selectAfterMutation = true;
    } else {
      this.mode = 'select';
    }
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
    this.filters.push({ op: 'eq', col, val });
    return this;
  }

  gte(col: string, val: unknown): FakeQuery {
    this.filters.push({ op: 'gte', col, val });
    return this;
  }

  lte(col: string, val: unknown): FakeQuery {
    this.filters.push({ op: 'lte', col, val });
    return this;
  }

  in(col: string, values: unknown[]): FakeQuery {
    this.filters.push({ op: 'in', col, values });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): FakeQuery {
    this.orders.push({ col, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number): FakeQuery {
    this.limitN = n;
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
      // Random hex pra id default — evita colisão quando múltiplas tabelas
      // têm row count similar (audit_log + message_drafts em paralelo).
      const idCounter = `${rows.length + 1}-${Math.floor(Math.random() * 1e9).toString(16)}`;
      const id = (this.insertRow.id as string) ?? `id-${idCounter}-${this.table}`;
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
      // update().select().single()/.maybeSingle() → devolve a row atualizada.
      // Sem .select(), supabase-js entrega { data: null }.
      if (this.selectAfterMutation) {
        if (this.wantSingle === 'single') {
          if (matched.length === 0) {
            return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
          }
          return { data: matched[0], error: null };
        }
        if (this.wantSingle === 'maybeSingle') {
          return { data: matched[0] ?? null, error: null };
        }
        return { data: matched, error: null };
      }
      return { data: null, error: null };
    }

    // select
    const filtered = rows.filter((r) => isMatch(r, this.filters));
    const ordered = this.orders.length === 0
      ? filtered
      : filtered.slice().sort((a, b) => {
          for (const { col, ascending } of this.orders) {
            const av = a[col];
            const bv = b[col];
            if (av === bv) continue;
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            const cmp = av < bv ? -1 : 1;
            const dir = ascending ? cmp : -cmp;
            if (dir !== 0) return dir;
          }
          return 0;
        });
    const limited = this.limitN !== null ? ordered.slice(0, this.limitN) : ordered;
    const projected =
      this.selectedCols === '*'
        ? limited
        : limited.map((r) => {
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
