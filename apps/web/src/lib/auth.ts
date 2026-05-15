import { auth, currentUser } from '@clerk/nextjs/server';
import { isRole, type Role } from '@office/shared-types';

export type AuthContext = {
  userId: string;
  orgId: string;
  role: Role;
  email: string;
};

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId || !orgId) return null;

  const user = await currentUser();
  if (!user) return null;

  const metadataRole = (sessionClaims?.publicMetadata as { role?: unknown } | undefined)?.role;
  const role: Role = isRole(metadataRole) ? metadataRole : 'operator';

  return {
    userId,
    orgId,
    role,
    email: user.emailAddresses[0]?.emailAddress ?? '',
  };
}
