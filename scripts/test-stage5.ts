import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const health = require('../api/health.ts');
const createBooking = require('../api/bookings/create.ts');
const applyProvider = require('../api/providers/apply.ts');
const respondJob = require('../api/jobs/respond.ts');

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

  const schema = fs.readFileSync('docs/supabase-schema.sql', 'utf8');
  ['customer_user_id', 'provider_user_id', 'auth_provider'].forEach((field) => {
    assert.ok(schema.includes(field), `schema should include ${field}`);
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

  const booking = await invoke(createBooking, {
    method: 'POST',
    body: {
      user: { email: 'Customer@Test.Example', name: 'Customer Test' },
      draft: { category: 'home', address: 'Södertälje', propertySize: '2 rum', frequency: 'Weekly', dateTime: 'Monday' },
      estimate: { total: 100 }
    },
    headers: {}
  });
  assert.equal(booking.statusCode, 200);
  assert.equal(booking.body.owner, 'demo:customer@test.example');

  const provider = await invoke(applyProvider, {
    method: 'POST',
    body: {
      user: { email: 'Provider@Test.Example', name: 'Provider Test' },
      providerData: { type: 'individual', serviceArea: 'Stockholm', categories: ['home'], hourlyRate: '390' }
    },
    headers: {}
  });
  assert.equal(provider.statusCode, 200);
  assert.equal(provider.body.owner, 'demo:provider@test.example');

  const jobResponse = await invoke(respondJob, {
    method: 'POST',
    body: {
      user: { email: 'Provider@Test.Example', name: 'Provider Test' },
      profile: { providerStatus: 'approved' },
      jobId: 'job-home-weekly-stockholm',
      response: 'accepted'
    },
    headers: {}
  });
  assert.equal(jobResponse.statusCode, 200);
  assert.equal(jobResponse.body.owner, 'demo:provider@test.example');

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