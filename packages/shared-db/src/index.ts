// Placeholder: schema Supabase, migrations e tipos gerados via `pnpm db:types`
// vão viver aqui. Apps NÃO devem importar deste pacote diretamente — acesso
// a dados passa pela camada de domínio (packages/shared-domain) ou pelo
// serviço de agentes.

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
