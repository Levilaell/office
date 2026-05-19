import { NextResponse, type NextRequest } from 'next/server';
import { Webhook } from 'svix';
import {
  createTenant,
  createUser,
  getTenantByClerkOrgId,
  getUserByClerkUserId,
  linkUserToTenant,
  markTenantOnboardingPending,
  seedDefaultAgentsForTenant,
  unlinkUserFromTenant,
  updateTenantByClerkOrgId,
  updateUserByClerkUserId,
} from '@office/shared-domain';
import { getServiceRoleSupabase } from '@/lib/supabase';
import type { Database } from '@office/shared-domain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Role = Database['public']['Tables']['tenant_users']['Row']['role'];

type ClerkOrgEvent = {
  type: 'organization.created' | 'organization.updated' | 'organization.deleted';
  data: { id: string; name?: string };
};
type ClerkUserEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
};
type ClerkMembershipEvent = {
  type: 'organizationMembership.created' | 'organizationMembership.deleted';
  data: {
    organization: { id: string };
    public_user_data: { user_id: string };
    role: string;
  };
};
type ClerkEvent = ClerkOrgEvent | ClerkUserEvent | ClerkMembershipEvent | { type: string; data: unknown };

const mapClerkRole = (clerkRole: string): Role =>
  clerkRole === 'org:admin' ? 'owner_tenant' : 'operator';

const pickPrimaryEmail = (data: ClerkUserEvent['data']): string | undefined => {
  if (!data.email_addresses?.length) return undefined;
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
  return (primary ?? data.email_addresses[0])?.email_address;
};

const buildFullName = (data: ClerkUserEvent['data']): string | null => {
  const parts = [data.first_name, data.last_name].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : null;
};

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing svix headers' }, { status: 400 });
  }

  const body = await req.text();

  let evt: ClerkEvent;
  try {
    evt = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const supabase = getServiceRoleSupabase();

  // Idempotência via svix-id (PRIMARY KEY). Se já processado, sai 200.
  const { error: dedupeError } = await supabase.from('webhook_events').insert({
    svix_id: svixId,
    event_type: evt.type,
    payload: evt as unknown as Database['public']['Tables']['webhook_events']['Insert']['payload'],
  });
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      return NextResponse.json({ ok: true, dedup: true });
    }
    return NextResponse.json({ error: 'dedup failed' }, { status: 500 });
  }

  try {
    switch (evt.type) {
      case 'organization.created':
      case 'organization.updated': {
        const data = (evt as ClerkOrgEvent).data;
        const { tenant, created } = await createTenant(supabase, {
          clerkOrgId: data.id,
          name: data.name ?? 'Escritório',
        });
        await seedDefaultAgentsForTenant(supabase, tenant.id);
        // Sprint 1.6 — marca onboarding pendente apenas em tenants novos
        // (não em update). Tenants legados pré-feature ficam com
        // display_settings.onboarding_completed=undefined e passam direto.
        if (created) {
          await markTenantOnboardingPending(supabase, tenant.id);
        }
        break;
      }
      case 'organization.deleted': {
        const data = (evt as ClerkOrgEvent).data;
        await updateTenantByClerkOrgId(supabase, {
          clerkOrgId: data.id,
          status: 'archived',
        });
        break;
      }
      case 'user.created': {
        const data = (evt as ClerkUserEvent).data;
        const email = pickPrimaryEmail(data);
        if (!email) break;
        await createUser(supabase, {
          clerkUserId: data.id,
          email,
          fullName: buildFullName(data),
        });
        break;
      }
      case 'user.updated': {
        const data = (evt as ClerkUserEvent).data;
        await updateUserByClerkUserId(supabase, {
          clerkUserId: data.id,
          email: pickPrimaryEmail(data),
          fullName: buildFullName(data),
        });
        break;
      }
      case 'user.deleted': {
        // Sem coluna deleted_at por enquanto; intencionalmente no-op.
        break;
      }
      case 'organizationMembership.created': {
        const data = (evt as ClerkMembershipEvent).data;
        const tenant = await getTenantByClerkOrgId(supabase, data.organization.id);
        const user = await getUserByClerkUserId(supabase, data.public_user_data.user_id);
        if (!tenant || !user) break;
        await linkUserToTenant(supabase, {
          tenantId: tenant.id,
          userId: user.id,
          role: mapClerkRole(data.role),
        });
        break;
      }
      case 'organizationMembership.deleted': {
        const data = (evt as ClerkMembershipEvent).data;
        const tenant = await getTenantByClerkOrgId(supabase, data.organization.id);
        const user = await getUserByClerkUserId(supabase, data.public_user_data.user_id);
        if (!tenant || !user) break;
        await unlinkUserFromTenant(supabase, { tenantId: tenant.id, userId: user.id });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Remove o dedup row se o handler falhou — assim o Clerk re-entrega e
    // a próxima tentativa pode reprocessar com sucesso.
    await supabase.from('webhook_events').delete().eq('svix_id', svixId);
    const message = err instanceof Error ? err.message : 'handler failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
