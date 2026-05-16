import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const jobsList = require('../api/jobs/list.ts');
const providerStatus = require('../api/providers/status.ts');
const adminApproval = require('../api/admin/provider-approval.ts');
const adminList = require('../api/admin/list-provider-applications.ts');

function mockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
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
  const jobsResponse = await invoke(jobsList, { method: 'POST', body: {}, headers: {} });
  assert.equal(jobsResponse.statusCode, 200);
  assert.ok(Array.isArray(jobsResponse.body.jobs));
  assert.ok(jobsResponse.body.jobs.length >= 1);
  assert.ok(jobsResponse.body.jobs[0].id);

  const statusResponse = await invoke(providerStatus, {
    method: 'POST',
    body: { applicationId: 'PRV-TEST' },
    headers: {}
  });
  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.body.status, 'pending');

  process.env.ADMIN_API_TOKEN = 'stage4-test-code';
  const approvalResponse = await invoke(adminApproval, {
    method: 'POST',
    body: { applicationId: 'PRV-TEST', status: 'approved' },
    headers: { authorization: 'Bearer stage4-test-code' }
  });
  assert.equal(approvalResponse.statusCode, 200);
  assert.equal(approvalResponse.body.status, 'approved');

  const listResponse = await invoke(adminList, {
    method: 'POST',
    body: {},
    headers: { authorization: 'Bearer stage4-test-code' }
  });
  assert.equal(listResponse.statusCode, 200);
  assert.ok(Array.isArray(listResponse.body.applications));

  const requiredFiles = [
    'src/admin.html',
    'src/scripts/admin-main.ts',
    'src/scripts/provider-stage3-main.ts',
    'api/jobs/list.ts',
    'api/providers/status.ts',
    'api/admin/list-provider-applications.ts'
  ];
  requiredFiles.forEach((file) => {
    assert.ok(fs.existsSync(path.resolve(file)), `${file} should exist`);
  });

  const providerFeed = fs.readFileSync('src/provider-feed.html', 'utf8');
  assert.ok(providerFeed.includes('provider-stage3.js'), 'provider feed should load deploy-safe Stage 3 entry shim');

  const providerShim = fs.readFileSync('src/scripts/provider-stage3.js', 'utf8');
  assert.ok(providerShim.includes('provider-stage3-main.ts'), 'provider shim should delegate to TypeScript implementation');

  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  assert.ok(viteConfig.includes('admin.html'), 'admin page should be included in Vite build');

  console.log('Stage 3 TypeScript tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
