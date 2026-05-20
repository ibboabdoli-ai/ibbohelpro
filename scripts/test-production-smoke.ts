import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlFiles = [
  'src/index.html',
  'src/login.html',
  'src/register.html',
  'src/onboarding.html',
  'src/book.html',
  'src/provider-onboarding.html',
  'src/provider-feed.html',
  'src/admin.html',
  'src/privacy.html',
  'src/terms.html',
  'src/rut.html'
];

const requiredSourceFiles = [
  'src/scripts/app-entry.ts',
  'src/scripts/app-main.ts',
  'src/scripts/session-scope.ts',
  'src/scripts/protected-routes.ts',
  'src/scripts/profile-hydration.ts',
  'src/scripts/onboarding-flow.ts',
  'src/scripts/booking-flow.ts',
  'src/scripts/provider-onboarding-flow.ts',
  'src/scripts/provider-stage3-main.ts',
  'src/scripts/admin-main.ts',
  'src/scripts/rut-calculator.ts',
  'src/public/robots.txt',
  'src/public/sitemap.xml',
  'vercel.json',
  'api/health.ts',
  'api/account/snapshot.ts',
  'api/profile/upsert.ts',
  'api/profile/get.ts',
  'api/bookings/create.ts',
  'api/providers/apply.ts',
  'api/jobs/respond.ts',
  'api/jobs/list.ts',
  'api/admin/list-provider-applications.ts',
  'api/admin/provider-approval.ts'
];

const removedShimFiles = [
  'src/scripts/app.js',
  'src/scripts/admin.js',
  'src/scripts/provider-stage3.js'
];

function read(file: string) {
  return fs.readFileSync(path.resolve(file), 'utf8');
}

function exists(file: string) {
  return fs.existsSync(path.resolve(file));
}

function assertContains(file: string, expected: string) {
  assert.ok(read(file).includes(expected), `${file} should include ${expected}`);
}

function assertNotContains(file: string, unexpected: string) {
  assert.ok(!read(file).includes(unexpected), `${file} should not include ${unexpected}`);
}

function main() {
  requiredSourceFiles.forEach((file) => assert.ok(exists(file), `${file} should exist`));
  removedShimFiles.forEach((file) => assert.ok(!exists(file), `${file} should be removed`));

  htmlFiles.forEach((file) => {
    assert.ok(exists(file), `${file} should exist`);
    assertNotContains(file, 'app.js');
    assertNotContains(file, 'admin.js');
    assertNotContains(file, 'provider-stage3.js');
  });

  [
    'src/index.html',
    'src/login.html',
    'src/register.html',
    'src/onboarding.html',
    'src/book.html',
    'src/provider-onboarding.html',
    'src/provider-feed.html',
    'src/privacy.html',
    'src/terms.html',
    'src/rut.html'
  ].forEach((file) => {
    assertContains(file, './scripts/app-entry.ts');
  });

  assertContains('src/provider-feed.html', './scripts/provider-stage3-main.ts');
  assertContains('src/admin.html', './scripts/admin-main.ts');

  assertContains('src/index.html', 'RUT-kalkylator');
  assertContains('src/index.html', 'Hemstädning');
  assertContains('src/index.html', 'Flyttstädning');
  assertContains('src/index.html', 'Verifierade städare');
  assertContains('src/index.html', 'GDPR');
  assertContains('src/index.html', 'Få pris & tillgänglighet');
  assertContains('src/index.html', '/rut.html');
  assertContains('src/index.html', '/privacy.html');
  assertContains('src/index.html', '/terms.html');
  assertContains('src/index.html', 'rel="canonical"');
  assertContains('src/index.html', 'og:title');
  assertContains('src/index.html', 'twitter:card');
  assertContains('src/index.html', 'robots');

  assertContains('src/privacy.html', 'Integritetspolicy');
  assertContains('src/privacy.html', 'Platsdata');
  assertContains('src/terms.html', 'Allmänna villkor');
  assertContains('src/terms.html', 'Avbokning');
  assertContains('src/rut.html', 'RUT-avdrag');
  assertContains('src/rut.html', 'preliminärt RUT-estimat');

  assertContains('src/public/robots.txt', 'User-agent');
  assertContains('src/public/robots.txt', 'Allow: /');
  assertContains('src/public/sitemap.xml', '<urlset');
  assertContains('src/public/sitemap.xml', 'https://ibbohelpro.vercel.app/');
  assertContains('src/public/sitemap.xml', 'https://ibbohelpro.vercel.app/rut.html');

  assertContains('vercel.json', 'X-Content-Type-Options');
  assertContains('vercel.json', 'Referrer-Policy');
  assertContains('vercel.json', 'X-Frame-Options');
  assertContains('vercel.json', 'Permissions-Policy');
  assertContains('vercel.json', 'Strict-Transport-Security');

  assertContains('src/book.html', 'start-booking');
  assertContains('src/book.html', 'chat-stream');
  assertContains('src/book.html', 'booking-summary');
  assertContains('src/provider-onboarding.html', 'next-step');
  assertContains('src/provider-onboarding.html', 'submit-provider');
  assertContains('src/provider-feed.html', 'feed-locked');
  assertContains('src/admin.html', 'load-applications');

  const appEntry = read('src/scripts/app-entry.ts');
  ['session-scope.ts', 'protected-routes.ts', 'profile-hydration.ts', 'onboarding-flow.ts', 'booking-flow.ts', 'provider-onboarding-flow.ts', 'rut-calculator.ts', 'app-main.ts'].forEach((entry) => {
    assert.ok(appEntry.includes(entry), `app-entry.ts should import ${entry}`);
  });

  const appMain = read('src/scripts/app-main.ts');
  assert.ok(appMain.includes('expiresAt'), 'auth token should include expiresAt');
  assert.ok(appMain.includes('clearSessionCaches'), 'logout should clear session-scoped caches');
  assert.ok(appMain.includes('session_expired'), 'app auth should handle expired sessions');
  assert.ok(appMain.includes('logged_out=true'), 'logout should redirect with logged out marker');

  const protectedRoutes = read('src/scripts/protected-routes.ts');
  assert.ok(protectedRoutes.includes('/book.html'), 'protected route guard should protect booking page');
  assert.ok(protectedRoutes.includes('/provider-onboarding.html'), 'protected route guard should protect provider onboarding');
  assert.ok(protectedRoutes.includes('/provider-feed.html'), 'protected route guard should protect provider feed');
  assert.ok(protectedRoutes.includes('/login.html?'), 'protected route guard should redirect to login');
  assert.ok(protectedRoutes.includes('expiresAt'), 'protected route guard should check session expiry');
  assert.ok(protectedRoutes.includes('session_expired'), 'protected route guard should redirect expired sessions');

  const snapshotApi = read('api/account/snapshot.ts');
  assert.ok(snapshotApi.includes('customer_user_id=eq.'), 'snapshot API should scope bookings by customer_user_id');
  assert.ok(snapshotApi.includes('provider_user_id=eq.'), 'snapshot API should scope provider applications by provider_user_id');
  assert.ok(snapshotApi.includes('user_profiles'), 'snapshot API should read user profile');

  const profileHydration = read('src/scripts/profile-hydration.ts');
  assert.ok(profileHydration.includes('/api/account/snapshot'), 'profile hydration should read account snapshot server-side');
  assert.ok(profileHydration.includes('cleanai_bookings'), 'profile hydration should cache server bookings');
  assert.ok(profileHydration.includes('cleanai_provider_applications'), 'profile hydration should cache provider application');

  const onboardingFlow = read('src/scripts/onboarding-flow.ts');
  assert.ok(onboardingFlow.includes('/api/profile/upsert'), 'onboarding flow should sync profile server-side');

  const bookingFlow = read('src/scripts/booking-flow.ts');
  assert.ok(bookingFlow.includes('navigator.geolocation'), 'booking flow should request browser location permission only when asked');
  assert.ok(bookingFlow.includes('/api/bookings/create'), 'booking flow should submit to booking API');
  assert.ok(bookingFlow.includes('submittedBookingKey'), 'booking flow should guard duplicate submissions');
  assert.ok(bookingFlow.includes('cleanai_nlp_memory'), 'booking flow should include local NLP memory');

  const providerFlow = read('src/scripts/provider-onboarding-flow.ts');
  assert.ok(providerFlow.includes('/api/providers/apply'), 'provider onboarding should submit to provider API');
  assert.ok(providerFlow.includes('/api/profile/upsert'), 'provider onboarding should sync profile server-side');
  assert.ok(providerFlow.includes('next-step'), 'provider onboarding should bind next-step');

  const profileUpsertApi = read('api/profile/upsert.ts');
  assert.ok(profileUpsertApi.includes('user_profiles'), 'profile upsert API should upsert into user_profiles');
  assert.ok(profileUpsertApi.includes('on_conflict=user_id'), 'profile upsert API should upsert by user_id');

  const profileGetApi = read('api/profile/get.ts');
  assert.ok(profileGetApi.includes('user_profiles'), 'profile get API should read from user_profiles');
  assert.ok(profileGetApi.includes('user_id=eq.'), 'profile get API should read by user_id');

  const viteConfig = read('vite.config.ts');
  assert.ok(viteConfig.includes("envPrefix: ['VITE_', 'NEXT_PUBLIC_']"), 'vite config should expose only public env prefixes');
  htmlFiles.forEach((file) => {
    assert.ok(viteConfig.includes(path.basename(file)), `vite.config.ts should include ${path.basename(file)}`);
  });

  const envExample = read('.env.example');
  ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].forEach((key) => {
    assert.ok(envExample.includes(key), `.env.example should document ${key}`);
  });
  assert.ok(envExample.includes('Do not put the service-role key here.'), '.env.example should warn against exposing service-role key');

  console.log('Production smoke tests passed');
}

main();
