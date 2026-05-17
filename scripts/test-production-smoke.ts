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
  'src/scripts/onboarding-flow.ts',
  'src/scripts/booking-flow.ts',
  'src/scripts/provider-onboarding-flow.ts',
  'src/scripts/provider-stage3-main.ts',
  'src/scripts/admin-main.ts',
  'src/scripts/rut-calculator.ts',
  'api/health.ts',
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

  assertContains('src/privacy.html', 'Integritetspolicy');
  assertContains('src/privacy.html', 'Platsdata');
  assertContains('src/terms.html', 'Allmänna villkor');
  assertContains('src/terms.html', 'Avbokning');
  assertContains('src/rut.html', 'RUT-avdrag');
  assertContains('src/rut.html', 'preliminärt RUT-estimat');

  assertContains('src/book.html', 'start-booking');
  assertContains('src/book.html', 'chat-stream');
  assertContains('src/book.html', 'booking-summary');
  assertContains('src/provider-onboarding.html', 'next-step');
  assertContains('src/provider-onboarding.html', 'submit-provider');
  assertContains('src/provider-feed.html', 'feed-locked');
  assertContains('src/admin.html', 'load-applications');

  const appEntry = read('src/scripts/app-entry.ts');
  ['session-scope.ts', 'onboarding-flow.ts', 'booking-flow.ts', 'provider-onboarding-flow.ts', 'rut-calculator.ts', 'app-main.ts'].forEach((entry) => {
    assert.ok(appEntry.includes(entry), `app-entry.ts should import ${entry}`);
  });

  const bookingFlow = read('src/scripts/booking-flow.ts');
  assert.ok(bookingFlow.includes('navigator.geolocation'), 'booking flow should request browser location permission only when asked');
  assert.ok(bookingFlow.includes('/api/bookings/create'), 'booking flow should submit to booking API');
  assert.ok(bookingFlow.includes('submittedBookingKey'), 'booking flow should guard duplicate submissions');
  assert.ok(bookingFlow.includes('cleanai_nlp_memory'), 'booking flow should include local NLP memory');

  const providerFlow = read('src/scripts/provider-onboarding-flow.ts');
  assert.ok(providerFlow.includes('/api/providers/apply'), 'provider onboarding should submit to provider API');
  assert.ok(providerFlow.includes('next-step'), 'provider onboarding should bind next-step');

  const viteConfig = read('vite.config.ts');
  htmlFiles.forEach((file) => {
    assert.ok(viteConfig.includes(path.basename(file)), `vite.config.ts should include ${path.basename(file)}`);
  });

  console.log('Production smoke tests passed');
}

main();
