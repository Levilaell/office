import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export type AuthenticatedClient = SupabaseClient<Database>;

export type AuthenticatedClientConfig = {
  url: string;
  anonKey: string;
  /**
   * Async getter pro JWT do Clerk. Pode retornar null quando não há sessão.
   * Segue o padrão Third-Party Auth Native do Supabase (sem JWT template).
   */
  accessToken: () => Promise<string | null>;
};

export const createAuthenticatedClient = (config: AuthenticatedClientConfig): AuthenticatedClient =>
  createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    async accessToken() {
      return (await config.accessToken()) ?? '';
    },
  });
