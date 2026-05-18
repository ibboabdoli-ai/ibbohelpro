# CleanAI Launch Runbook

This runbook defines the production launch checks for the CleanAI MVP deployed on Vercel with Supabase persistence.

## 1. Production URL

Current production URL:

```txt
https://ibbohelpro.vercel.app
```

Use this URL for manual smoke tests, live smoke tests, and customer-facing checks until a custom domain is attached.

## 2. Required Vercel Environment Variables

Required for healthy production status:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_API_TOKEN
```

Optional:

```txt
OPENAI_API_KEY
OPENAI_MODEL
APP_ORIGIN
AI_RATE_LIMIT_MAX
```

Expected health endpoint result when required variables are configured:

```txt
/api/health -> ok: true
```

If `OPENAI_API_KEY` is missing, the booking assistant still works with deterministic fallback behavior.

## 3. Supabase Schema

Run the schema in Supabase SQL Editor:

```txt
docs/supabase-schema.sql
```

Required tables:

```txt
user_profiles
bookings
provider_applications
jobs
job_responses
```

Ownership fields used for account isolation:

```txt
user_profiles.user_id
bookings.customer_user_id
provider_applications.provider_user_id
job_responses.provider_user_id
```

After a booking submit, verify:

```txt
Supabase -> Table Editor -> bookings
```

After provider application submit, verify:

```txt
Supabase -> Table Editor -> provider_applications
```

## 4. Build Verification

Local full verification:

```bash
npm install
npm run check:stage5
```

This runs:

```txt
vite build
Stage 2 AI tests
Stage 3 provider/admin tests
Stage 5 production readiness tests
Production smoke tests
npm audit
```

## 5. Live Smoke Test

Manual local command:

```bash
npm run test:live-smoke
```

Custom URL:

```bash
PROD_URL=https://ibbohelpro.vercel.app npm run test:live-smoke
```

GitHub Actions:

```txt
Actions -> Live smoke -> Run workflow
```

The live smoke test checks:

```txt
/
/rut.html
/privacy.html
/terms.html
/register.html
/login.html
/book.html
/provider-onboarding.html
/provider-feed.html
/admin.html
/sitemap.xml
/robots.txt
/api/health
security headers
```

## 6. Manual UI Smoke Checklist

### Homepage

- Swedish-first landing page loads.
- RUT calculator updates price.
- Footer links work:
  - RUT-information
  - Integritet
  - Villkor
- Register and Login buttons work.

### Customer booking

- Register new user.
- Continue to onboarding.
- Select customer role and category.
- Open booking chat.
- Use location permission or type city manually.
- Fill size, frequency, and schedule.
- Submit booking.
- Verify only one booking is created after repeated clicks.
- Confirm booking row exists in Supabase.
- Confirm `customer_user_id` is set.
- Confirm a different customer identity does not receive this booking in `/api/account/snapshot`.

### Provider onboarding

- Register provider user.
- Complete Basics, Availability, Pricing, Verification, Profile.
- Next/Back works.
- Save draft persists data.
- Submit for review.
- Confirm provider application row exists in Supabase.
- Confirm `provider_user_id` is set.

### Provider feed

- Feed remains locked until approval.
- Approved status should unlock job feed when backend status returns approved.
- `/api/account/snapshot` should hydrate the provider's latest application/status.

### Admin

- Admin page loads.
- Admin code is required.
- Application list endpoint works when token is valid.
- Approval/rejection endpoints update provider application status.

## 7. Account Snapshot Verification

Endpoint:

```txt
/api/account/snapshot
```

Purpose:

```txt
Hydrate server-backed account state in one request.
```

Expected response sections:

```txt
profile
bookings
providerApplication
```

Verification checklist:

```txt
1. Submit a customer booking.
2. Call account snapshot as that customer.
3. Confirm the booking appears in `bookings`.
4. Call account snapshot as another customer.
5. Confirm the booking does not appear.
6. Submit a provider application.
7. Call account snapshot as that provider.
8. Confirm `providerApplication` includes the latest status.
9. Confirm frontend local caches are hydrated:
   - cleanai_profile
   - cleanai_bookings
   - cleanai_provider_applications
```

Security rule:

```txt
The service-role key must remain server-only and must never appear in frontend code or network payloads.
```

## 8. Security Headers

Configured in `vercel.json`:

```txt
X-Content-Type-Options
Referrer-Policy
X-Frame-Options
Permissions-Policy
Strict-Transport-Security
```

Do not add a strict Content-Security-Policy until Google Fonts, Nominatim reverse geocoding, Vercel scripts, and any future analytics domains are mapped and tested.

## 9. SEO Basics

Production SEO files:

```txt
src/public/robots.txt
src/public/sitemap.xml
```

Homepage metadata includes:

```txt
canonical
Open Graph
twitter card
robots index/follow
```

Before custom domain launch, update all URLs from:

```txt
https://ibbohelpro.vercel.app
```

to the final domain.

## 10. Known Production Gaps

Before real public launch, complete these items:

```txt
1. Replace demo/local auth with real authentication.
2. Add BankID or Swedish-grade identity verification when ready.
3. Add payment flow and RUT-compatible invoicing logic.
4. Legally review privacy policy, terms, and RUT copy.
5. Add customer/provider email notifications.
6. Add admin audit logs.
7. Add rate limiting and abuse protection beyond MVP defaults.
8. Add real review/rating system.
9. Add support/contact workflow.
10. Update sitemap and canonical URLs after custom domain is attached.
```

## 11. Rollback

If production breaks:

1. Open Vercel Deployments.
2. Find last known good deployment.
3. Promote/redeploy that version.
4. Verify `/api/health`.
5. Run live smoke test.

## 12. Current Launch Readiness

Current status:

```txt
TypeScript-only frontend entries: done
Legacy JS shims removed: done
Sweden-ready homepage: done
RUT calculator: done
Booking flow: done
Provider onboarding: done
Provider feed: done
Admin console: done
Legal pages: done
SEO basics: done
Security headers: done
Live smoke script: done
Manual GitHub live smoke workflow: done
Account snapshot hydration: in account-isolation-batch
```