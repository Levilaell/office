import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export type ServiceRoleClient = SupabaseClient<Database>;

export type ServiceRoleClientConfig = {
  url: string;
  /**
   * SERVICE_ROLE_KEY — bypass RLS. NUNCA expor pro client. Importar este
   * factory somente em código server-side (API routes, webhooks, workers).
   */
  serviceRoleKey: string;
};

/**
 * Cliente Supabase com role 'service_role'. Bypassa RLS.
 *
 * Server-only. Se este símbolo aparecer em bundle client-side, o build
 * está vazando a service key. Quem chama é responsável por adicionar
 * 'server-only' (ou equivalente) no arquivo que importa.
 */
export const createServiceRoleClient = (config: ServiceRoleClientConfig): ServiceRoleClient =>
  createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
