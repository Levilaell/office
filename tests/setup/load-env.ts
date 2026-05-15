import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), 'apps/agent-runtime/.env'),
];

for (const path of candidates) {
  if (existsSync(path)) loadEnv({ path, override: false });
}
