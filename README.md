# CleanAI MVP

CleanAI is a multi-page Vite prototype for a cleaning-service marketplace. It supports:

- Customer intake and guided booking chat
- Provider onboarding and review-locked provider feed
- Optional AI assistant endpoint with deterministic fallback
- Optional Supabase persistence for bookings, provider applications, and job responses
- Vercel-ready static frontend plus serverless API routes

## Actual stack

This repository is **not** a React monorepo. The actual implementation is:

- Vite multi-page frontend
- HTML + Tailwind CSS + vanilla JavaScript/TypeScript modules
- Vercel serverless API routes under `api/`
- Local demo persistence through `localStorage`
- Optional Supabase persistence through REST API when env vars are configured
- Optional OpenAI assistant when `OPENAI_API_KEY` is configured

## Project structure

```txt
src/
  index.html
  login.html
  register.html
  onboarding.html
  book.html
  provider-onboarding.html
  provider-feed.html
  scripts/
  styles/
  locales/
api/
  ai/chat.js
  bookings/create.js
  providers/apply.js
  jobs/respond.js
  admin/provider-approval.js
  dev-server.mjs
docs/
  supabase-schema.sql
  PRODUCTION_CHECKLIST.md
```

## Local development

```bash
npm ci
npm run dev:api
npm run dev
```

Or run both together:

```bash
npm run dev:full
```

Vite proxies `/api/*` to the local Express API server on port `8787`.

## Build and verification

```bash
npm run build
npm audit --audit-level=moderate
```

Current verified state:

- Build passes with Vite
- `npm audit --audit-level=moderate` passes with 0 vulnerabilities
- Local API routes respond for bookings, providers, jobs, and AI chat

## Environment variables

Create `.env` from `.env.example`.

```env
APP_ORIGIN=https://your-domain.com
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
ADMIN_API_TOKEN=your-admin-token
```

### Without env vars

The app still works as a safe demo:

- Bookings receive a reference ID from the API fallback
- Provider applications receive an application reference
- AI chat uses deterministic fallback replies
- Job responses are stored locally if the API/backend is unavailable

### With Supabase env vars

The following endpoints insert/update Supabase tables described in `docs/supabase-schema.sql`:

- `POST /api/bookings/create`
- `POST /api/providers/apply`
- `POST /api/jobs/respond`
- `POST /api/admin/provider-approval`

## Security changes already applied

- User/AI chat replies are rendered with `textContent`, not raw `innerHTML`
- User-controlled booking fields are escaped before rendering in HTML templates
- Automatic geolocation prompt was removed from landing page
- Location prompt now appears only after clicking `Use current location`
- Provider self-approval demo button was removed
- Provider approval requires backend/admin logic
- AI endpoint has basic in-memory rate limiting
- CI uses `npm ci` and `npm run build`
- Swedish language code is canonicalized to `sv`, with `se` preserved as a legacy alias

## Important production notes

This is still an MVP. Before serving real customers, complete:

- Real user authentication and authorization
- Supabase RLS policies or a dedicated backend permission layer
- Email/SMS notifications
- Payment flow
- GDPR/privacy/terms pages
- Secure file upload and verification for providers
- Admin dashboard for provider approval and job management

## Scripts

```bash
npm run dev
npm run dev:api
npm run dev:full
npm run build
npm run test:stage2
npm run check:stage2
```
