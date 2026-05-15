import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { PORTS } from '@office/shared-config/constants';
import { health } from '@office/shared-domain';

const app = new Hono();

app.get('/health', (c) => c.json(health()));

const port = PORTS.agentRuntime;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[agent-runtime] listening on http://localhost:${info.port}`);
});
