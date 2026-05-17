import assert from 'node:assert/strict';

const baseUrl = (process.env.PROD_URL || 'https://ibbohelpro.vercel.app').replace(/\/$/, '');

const pages = [
  { path: '/', mustContain: 'Boka trygg städning i Sverige' },
  { path: '/rut.html', mustContain: 'RUT-avdrag' },
  { path: '/privacy.html', mustContain: 'Integritetspolicy' },
  { path: '/terms.html', mustContain: 'Allmänna villkor' },
  { path: '/register.html', mustContain: 'Create your account' },
  { path: '/login.html', mustContain: 'Welcome back' },
  { path: '/book.html', mustContain: 'Booking chat' },
  { path: '/provider-onboarding.html', mustContain: 'Provider onboarding' },
  { path: '/provider-feed.html', mustContain: 'Provider dashboard' },
  { path: '/admin.html', mustContain: 'Provider review' },
  { path: '/sitemap.xml', mustContain: '<urlset' },
  { path: '/robots.txt', mustContain: 'User-agent' }
];

async function readText(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'user-agent': 'CleanAI live smoke test' }
  });
  assert.equal(response.ok, true, `${path} should return 2xx, got ${response.status}`);
  return { response, text: await response.text() };
}

async function checkPages() {
  for (const page of pages) {
    const { text } = await readText(page.path);
    assert.ok(text.includes(page.mustContain), `${page.path} should include ${page.mustContain}`);
  }
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { 'user-agent': 'CleanAI live smoke test' }
  });
  assert.equal(response.ok, true, `/api/health should return 2xx, got ${response.status}`);
  const body = await response.json();
  assert.equal(body.service, 'cleanai-mvp');
  assert.equal(body.stage, 5);
  assert.equal(body.ok, true, '/api/health should report ok=true when required env vars are configured');
}

async function checkSecurityHeaders() {
  const { response } = await readText('/');
  const requiredHeaders = [
    'x-content-type-options',
    'referrer-policy',
    'x-frame-options',
    'permissions-policy',
    'strict-transport-security'
  ];
  requiredHeaders.forEach((header) => {
    assert.ok(response.headers.get(header), `Missing security header: ${header}`);
  });
}

async function main() {
  console.log(`Running live smoke tests against ${baseUrl}`);
  await checkPages();
  await checkHealth();
  await checkSecurityHeaders();
  console.log('Live production smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
