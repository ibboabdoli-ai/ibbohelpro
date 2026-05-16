# Stage 5 Production Setup

## Goal

Prepare CleanAI for production-style deployment with real environment variables, database persistence, admin review, and AI provider readiness.

## Required Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_API_TOKEN
```

## Optional Vercel Environment Variables

```txt
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
AI_RATE_LIMIT_MAX=30
APP_ORIGIN=https://your-production-domain
```

## Supabase setup

1. Open Supabase SQL editor.
2. Run `docs/supabase-schema.sql`.
3. Confirm these tables exist:
   - `bookings`
   - `provider_applications`
   - `jobs`
   - `job_responses`
4. Copy the project URL to `SUPABASE_URL`.
5. Copy the service role key to `SUPABASE_SERVICE_ROLE_KEY`.

## Admin setup

1. Generate a strong random value for `ADMIN_API_TOKEN`.
2. Add it to Vercel Environment Variables.
3. Use the same value in the admin console field when reviewing providers.

## AI setup

1. Add `OPENAI_API_KEY` to Vercel.
2. Keep `OPENAI_MODEL=gpt-4o-mini` unless there is a reason to change it.
3. If `OPENAI_API_KEY` is missing, the deterministic fallback assistant still works.

## Health check

After deployment, call:

```txt
/api/health
```

Expected production-ready response:

```json
{
  "ok": true,
  "stage": 5,
  "missingRequired": []
}
```

If `ok` is false, add the missing variables shown in `missingRequired`.

## End-to-end production test

Run this flow after setting environment variables:

1. Register customer.
2. Complete customer onboarding.
3. Create booking draft.
4. Submit booking.
5. Register provider.
6. Complete provider onboarding.
7. Open admin console.
8. Approve provider application.
9. Open provider feed.
10. Sync status.
11. Confirm job list loads.
12. Accept or decline a job.

## Verification command

```bash
npm install
npm run check:stage5
```

Expected:

```txt
Build OK
Stage 2 AI tests passed
Stage 3 TypeScript tests passed
Stage 5 production readiness tests passed
0 vulnerabilities
```

## Production warning

`SUPABASE_SERVICE_ROLE_KEY` must only exist in server-side environment variables. Never expose it in frontend code or client-visible config.
