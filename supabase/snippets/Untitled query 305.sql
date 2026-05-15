SELECT a.id, a.agent_key, a.name, a.tier, a.state, t.clerk_org_id
FROM public.agents a
JOIN public.tenants t ON t.id = a.tenant_id
WHERE t.clerk_org_id = 'org_3Dkwp7G2ynWfRcuiKfgiVqFKbmr';