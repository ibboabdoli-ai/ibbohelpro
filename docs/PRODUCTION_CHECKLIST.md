# CleanAI Production Checklist

## Required before real customers

- [ ] Replace localStorage demo auth with real auth provider
- [ ] Configure Supabase tables from `docs/supabase-schema.sql`
- [ ] Add RLS policies after auth is implemented
- [ ] Configure `APP_ORIGIN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- [ ] Configure `OPENAI_API_KEY` only in Vercel/server env
- [ ] Configure `ADMIN_API_TOKEN` for provider approval API
- [ ] Add real admin dashboard or protected admin workflow
- [ ] Add email/SMS confirmation for booking references
- [ ] Add payment provider only after booking confirmation flow is clear
- [ ] Add secure document upload for provider verification
- [ ] Add privacy policy, terms, GDPR consent, and cookie/analytics policy
- [ ] Replace demo job feed with database-backed jobs

## Verification commands

```bash
npm ci
npm run build
npm audit --audit-level=moderate
```

## Manual flow test

1. Select language.
2. Use landing intake without location prompt appearing automatically.
3. Click `Use current location` only when testing location permission.
4. Register customer and complete onboarding.
5. Open booking chat and submit a draft.
6. Confirm a booking reference appears.
7. Register provider and submit onboarding.
8. Confirm provider feed stays locked while pending.
9. Approve provider through backend/admin workflow.
10. Confirm approved provider can accept/decline jobs.
