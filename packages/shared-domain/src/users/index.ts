import type {
  AuthenticatedClient,
  Database,
  ServiceRoleClient,
} from '@office/shared-db';

export type User = Database['public']['Tables']['users']['Row'];

type AnyClient = AuthenticatedClient | ServiceRoleClient;

export const getUserByClerkUserId = async (
  supabase: AnyClient,
  clerkUserId: string,
): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export type CreateUserInput = {
  clerkUserId: string;
  email: string;
  fullName?: string | null;
};

export const createUser = async (
  supabase: ServiceRoleClient,
  input: CreateUserInput,
): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        clerk_user_id: input.clerkUserId,
        email: input.email,
        full_name: input.fullName ?? null,
      },
      { onConflict: 'clerk_user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export type UpdateUserInput = {
  clerkUserId: string;
  email?: string;
  fullName?: string | null;
};

export const updateUserByClerkUserId = async (
  supabase: ServiceRoleClient,
  { clerkUserId, fullName, ...patch }: UpdateUserInput,
): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...patch,
      ...(fullName !== undefined && { full_name: fullName }),
    })
    .eq('clerk_user_id', clerkUserId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};
