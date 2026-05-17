-- CleanAI MVP Supabase schema
-- Run in Supabase SQL editor. Adjust RLS policies before production.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  auth_provider text not null default 'demo',
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'provider', 'admin')),
  preferred_category text,
  provider_status text,
  onboarding_complete boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_id text unique not null,
  status text not null default 'submitted',
  customer_user_id text,
  auth_provider text default 'demo',
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
  provider_user_id text,
  auth_provider text default 'demo',
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

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text unique not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'cancelled', 'completed')),
  title text not null,
  location text,
  budget text,
  start_time text,
  category text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_responses (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  response text not null check (response in ('accepted', 'declined')),
  provider_user_id text,
  auth_provider text default 'demo',
  provider_email text,
  provider_status text,
  responded_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists auth_provider text not null default 'demo';
alter table public.user_profiles add column if not exists preferred_category text;
alter table public.user_profiles add column if not exists provider_status text;
alter table public.user_profiles add column if not exists onboarding_complete boolean default false;
alter table public.user_profiles add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.user_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.bookings add column if not exists customer_user_id text;
alter table public.bookings add column if not exists auth_provider text default 'demo';
alter table public.provider_applications add column if not exists provider_user_id text;
alter table public.provider_applications add column if not exists auth_provider text default 'demo';
alter table public.job_responses add column if not exists provider_user_id text;
alter table public.job_responses add column if not exists auth_provider text default 'demo';

create index if not exists idx_user_profiles_user_id on public.user_profiles (user_id);
create index if not exists idx_user_profiles_email on public.user_profiles (email);
create index if not exists idx_user_profiles_role on public.user_profiles (role);
create index if not exists idx_bookings_booking_id on public.bookings (booking_id);
create index if not exists idx_bookings_customer_user_id on public.bookings (customer_user_id);
create index if not exists idx_provider_applications_application_id on public.provider_applications (application_id);
create index if not exists idx_provider_applications_provider_user_id on public.provider_applications (provider_user_id);
create index if not exists idx_provider_applications_status on public.provider_applications (status);
create index if not exists idx_jobs_job_id on public.jobs (job_id);
create index if not exists idx_jobs_status on public.jobs (status);
create index if not exists idx_job_responses_job_id on public.job_responses (job_id);
create index if not exists idx_job_responses_provider_user_id on public.job_responses (provider_user_id);

-- Optional seed jobs for Stage 3 demo
insert into public.jobs (job_id, status, title, location, budget, start_time, category, description)
values
  ('job-home-weekly-stockholm', 'open', 'Weekly home clean', 'Stockholm · Södermalm', '€120', 'Tue · 09:00', 'home', 'Recurring apartment cleaning. Customer requested kitchen focus and eco products.'),
  ('job-office-evening-solna', 'open', 'Office evening refresh', 'Solna Business Park', '€220', 'Wed · 18:00', 'office', 'Small office after-hours cleaning with desks, floors, and kitchenette.'),
  ('job-hotel-turnover-arlanda', 'open', 'Hotel turnover support', 'Arlanda area', '€180', 'Fri · 14:00', 'hotel', 'Turnover support for short-stay units. Fast checklist and photo handoff required.')
on conflict (job_id) do nothing;

-- Production hardening:
-- 1. Enable RLS after implementing authenticated Supabase users.
-- 2. Keep SUPABASE_SERVICE_ROLE_KEY only in serverless env vars, never in frontend code.
-- 3. Replace broad service-role writes with user-scoped policies once auth is live.
-- 4. Replace demo admin code workflow with real authenticated admin identity before production.
-- 5. Use user_id/customer_user_id/provider_user_id as ownership fields for authenticated access policies.
