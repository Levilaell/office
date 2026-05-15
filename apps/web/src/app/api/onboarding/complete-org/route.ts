import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import {
  createTenant,
  createUser,
  getTenantByClerkOrgId,
  getUserByClerkUserId,
  linkUserToTenant,
  seedDefaultAgentsForTenant,
} from '@office/shared-domain';
import { getServiceRoleSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceRoleSupabase();

  let tenant = await getTenantByClerkOrgId(supabase, orgId);
  if (!tenant) {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    tenant = await createTenant(supabase, {
      clerkOrgId: orgId,
      name: org.name,
    });
  }
  await seedDefaultAgentsForTenant(supabase, tenant.id);

  let user = await getUserByClerkUserId(supabase, userId);
  if (!user) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: 'user without email' }, { status: 400 });
    }
    const fullNameParts = [clerkUser.firstName, clerkUser.lastName].filter(
      (p): p is string => Boolean(p),
    );
    user = await createUser(supabase, {
      clerkUserId: userId,
      email,
      fullName: fullNameParts.length > 0 ? fullNameParts.join(' ') : null,
    });
  }

  await linkUserToTenant(supabase, {
    tenantId: tenant.id,
    userId: user.id,
    role: 'owner_tenant',
  });

  return NextResponse.json({ tenantId: tenant.id });
}
