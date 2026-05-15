import 'server-only';
import { auth } from '@clerk/nextjs/server';
import {
  createAuthenticatedClient,
  createServiceRoleClient,
  type AuthenticatedClient,
  type ServiceRoleClient,
} from '@office/shared-domain';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

export const getSupabaseForCurrentUser = async (): Promise<AuthenticatedClient> => {
  const { getToken } = await auth();
  return createAuthenticatedClient({
    url: required('SUPABASE_URL'),
    anonKey: required('SUPABASE_ANON_KEY'),
    accessToken: async () => getToken(),
  });
};

export const getServiceRoleSupabase = (): ServiceRoleClient =>
  createServiceRoleClient({
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  });
