-- CleanAI MVP Supabase schema
-- Run in Supabase SQL editor. Adjust RLS policies before production.

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_id text unique not null,
  status text not null default 'submitted',
  customer_email text,
  customer_name text,
  profile_role text,
  category text not null,
  address text not null,
  property_size text,
  frequency text,
  date_time text,
  extras jsonb default '[]'::jsonb,
  notes text,
  location_consent boolean default false,
  estimate jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  application_id text unique not null,
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected')),
  provider_email text,
  provider_name text,
  provider_type text,
  service_area text not null,
  categories jsonb default '[]'::jsonb,
  weekdays text,
  weekends text,
  hourly_rate text not null,
  callout_fee text,
  verification_file text,
  bio text,
  languages text,
  portfolio text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.job_responses (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  response text not null check (response in ('accepted', 'declined')),
  provider_email text,
  provider_status text,
  responded_at timestamptz not null default now()
);

create index if not exists idx_bookings_booking_id on public.bookings (booking_id);
create index if not exists idx_provider_applications_application_id on public.provider_applications (application_id);
create index if not exists idx_provider_applications_status on public.provider_applications (status);
create index if not exists idx_job_responses_job_id on public.job_responses (job_id);

-- Production hardening:
-- 1. Enable RLS after implementing authenticated Supabase users.
-- 2. Keep SUPABASE_SERVICE_ROLE_KEY only in serverless env vars, never in frontend code.
-- 3. Replace broad service-role writes with user-scoped policies once auth is live.
