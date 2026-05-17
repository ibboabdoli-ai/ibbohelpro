# CleanAI Production Roadmap

This roadmap converts the MVP launch gaps into an execution plan for a Sweden-ready cleaning marketplace.

## Current Baseline

Done:

```txt
TypeScript-only frontend entries
Legacy JS shims removed
Sweden-ready homepage
RUT calculator
Customer booking flow
Location permission autofill
Supabase booking persistence
Provider onboarding
Provider feed lock
Admin review console
Legal pages
SEO basics
Security headers
Live smoke test script
Manual GitHub live smoke workflow
Launch runbook
```

## Phase 1 — Authentication and Account Isolation

Goal: replace demo/local auth with real account state and tenant isolation.

### Required work

```txt
1. Implement Supabase Auth or another production auth provider.
2. Add email verification.
3. Store user profile server-side.
4. Scope bookings to authenticated customer IDs.
5. Scope provider applications to authenticated provider IDs.
6. Replace localStorage-only profile state with API-backed profile state.
7. Add logout/session expiry handling.
```

### Acceptance criteria

```txt
A customer cannot see another customer's booking data.
A provider cannot see customer data before approval.
A logged-out user cannot access protected workspace pages.
Booking and provider records include owner IDs.
```

## Phase 2 — BankID / Swedish Identity Readiness

Goal: make the service credible for Sweden.

### Required work

```txt
1. Evaluate BankID provider options.
2. Add identity verification flow for providers first.
3. Add optional customer verification for high-value jobs.
4. Store verification status, not raw identity documents in frontend.
5. Add admin review indicators for verified/unverified providers.
```

### Acceptance criteria

```txt
Provider profile shows verification status.
Admin can see verification result.
Customers can identify verified providers.
Sensitive verification data is never exposed in frontend code.
```

## Phase 3 — Payment and RUT-Compatible Billing

Goal: move from estimate to real commercial checkout.

### Required work

```txt
1. Decide payment provider.
2. Create checkout flow after booking confirmation.
3. Separate labor cost, material cost, and optional fees.
4. Implement RUT-eligible service mapping.
5. Add RUT disclaimer and customer confirmation.
6. Prepare invoice data model.
7. Add final price confirmation before payment.
```

### Acceptance criteria

```txt
Customer sees price before RUT, RUT estimate, and price after RUT.
System never guarantees RUT before validation.
Booking cannot be paid without accepted terms.
Admin can audit pricing and RUT fields.
```

## Phase 4 — Notifications

Goal: make booking and provider workflows operational.

### Required work

```txt
1. Send customer confirmation email after booking.
2. Send provider application confirmation.
3. Notify admin about new provider applications.
4. Notify provider when approved/rejected.
5. Notify customer when booking status changes.
6. Add email templates in Swedish and English.
```

### Acceptance criteria

```txt
Every booking submit sends a confirmation.
Every provider application sends a confirmation.
Admin receives actionable review notification.
Emails include booking/application IDs.
```

## Phase 5 — Admin Audit and Operations

Goal: make admin actions traceable and safer.

### Required work

```txt
1. Add admin_users table or role claims.
2. Add admin_audit_log table.
3. Log provider approval/rejection.
4. Log booking status updates.
5. Add admin notes.
6. Add status filters and search.
7. Add admin-only route protection.
```

### Acceptance criteria

```txt
Every admin action has who/when/what.
Provider approval changes are auditable.
Admin API rejects missing/invalid tokens.
Admin UI does not expose service-role keys.
```

## Phase 6 — Marketplace Matching

Goal: connect customer jobs to approved providers.

### Required work

```txt
1. Convert bookings into jobs after validation.
2. Match jobs by service area, category, availability, and provider status.
3. Show only approved providers open jobs.
4. Track accept/decline responses.
5. Add assignment flow.
6. Add job status lifecycle: submitted, matched, assigned, completed, cancelled.
```

### Acceptance criteria

```txt
Unapproved providers see locked feed.
Approved providers only see relevant jobs.
Accepted job creates assignment state.
Customer and provider status stays consistent.
```

## Phase 7 — Reviews, Trust, and Support

Goal: increase marketplace trust.

### Required work

```txt
1. Add customer review after completed job.
2. Add provider rating summary.
3. Add complaint/support flow.
4. Add cancellation and reschedule workflow.
5. Add before/after photo workflow if appropriate.
6. Add support inbox or ticketing integration.
```

### Acceptance criteria

```txt
Only completed jobs can be reviewed.
Reviews are linked to real bookings.
Support cases include booking ID.
Provider profile can display rating after enough jobs.
```

## Phase 8 — Localization and Swedish UX Polish

Goal: make the product feel native in Sweden.

### Required work

```txt
1. Review all Swedish copy.
2. Add Swedish service-specific pages.
3. Add city landing pages for Stockholm, Södertälje, Botkyrka, Norrköping, Malmö, Göteborg.
4. Add RUT-focused FAQ.
5. Add service checklists for hemstädning, flyttstädning, kontor, fönsterputs.
```

### Acceptance criteria

```txt
Core customer path is Swedish-first.
Service pages have clear checklists.
RUT copy is consistent and legally reviewed.
City pages have unique relevant content.
```

## Phase 9 — Observability and Abuse Protection

Goal: make production maintainable.

### Required work

```txt
1. Add structured server logs.
2. Add error monitoring.
3. Add rate limiting to booking/provider/admin APIs.
4. Add spam protection for public forms.
5. Add uptime monitoring for /api/health.
6. Add backup/export procedure for Supabase.
```

### Acceptance criteria

```txt
Errors can be traced by request ID.
Health endpoint is monitored.
API abuse is rate-limited.
Database backup strategy is documented.
```

## Suggested Priority Order

```txt
1. Real auth + account isolation
2. Admin route protection + audit log
3. Booking/customer email notifications
4. Provider approval email notifications
5. RUT/payment data model
6. Marketplace matching
7. Reviews/support
8. City/service SEO pages
9. BankID/provider identity verification
10. Observability and abuse protection
```

## Production Definition of Done

CleanAI is production-ready when:

```txt
Real authentication is live.
Customer/provider/admin roles are isolated.
Bookings are persisted and visible only to the owner/admin.
Provider approvals are auditable.
RUT and payment flows are legally reviewed.
Email notifications work.
Admin operations are traceable.
Live smoke tests pass after deploy.
Legal pages are reviewed.
Custom domain/canonical/sitemap are updated.
```
