import {
  createServiceRoleClient,
  getTenantByClerkOrgId,
  type ServiceRoleClient,
} from '@office/shared-domain';

export type ResolveTenantInput = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

let cached: ServiceRoleClient | null = null;

const getClient = (input: ResolveTenantInput): ServiceRoleClient => {
  if (cached) return cached;
  cached = createServiceRoleClient({
    url: input.supabaseUrl,
    serviceRoleKey: input.serviceRoleKey,
  });
  return cached;
};

export const resolveTenantId = async (
  clerkOrgId: string,
  input: ResolveTenantInput,
): Promise<string | null> => {
  const tenant = await getTenantByClerkOrgId(getClient(input), clerkOrgId);
  return tenant?.id ?? null;
};
