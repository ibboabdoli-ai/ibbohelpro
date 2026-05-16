import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const health = require('../api/health.ts');

function mockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    ended: false,
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

async function invoke(handler: any, req: any) {
  const res = mockRes();
  await handler(req, res);
  return res;
}

async function main() {
  assert.ok(fs.existsSync('.env.example'), '.env.example should exist');
  assert.ok(fs.existsSync('docs/STAGE5_PRODUCTION_SETUP.md'), 'Stage 5 production guide should exist');
  assert.ok(fs.existsSync('api/health.ts'), 'health endpoint should exist');

  const envExample = fs.readFileSync('.env.example', 'utf8');
  ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_API_TOKEN', 'OPENAI_API_KEY', 'APP_ORIGIN'].forEach((key) => {
    assert.ok(envExample.includes(key), `.env.example should document ${key}`);
  });

  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN
  };

  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.ADMIN_API_TOKEN;

  const missing = await invoke(health, { method: 'GET', headers: {} });
  assert.equal(missing.statusCode, 503);
  assert.equal(missing.body.ok, false);
  assert.ok(missing.body.missingRequired.includes('SUPABASE_URL'));
  assert.ok(missing.body.missingRequired.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(missing.body.missingRequired.includes('ADMIN_API_TOKEN'));

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  process.env.ADMIN_API_TOKEN = 'test-admin-token';

  const ready = await invoke(health, { method: 'GET', headers: {} });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.body.ok, true);
  assert.deepEqual(ready.body.missingRequired, []);

  const options = await invoke(health, { method: 'OPTIONS', headers: {} });
  assert.equal(options.statusCode, 200);

  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });

  console.log('Stage 5 production readiness tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
