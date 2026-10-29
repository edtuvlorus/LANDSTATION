create extension if not exists pgcrypto;
create table if not exists public.services (id text primary key, name text not null, description text not null default '', price integer not null default 0 check(price>=0), slot integer not null default 0 check(slot>=0), image_url text not null default '', active boolean not null default true, updated_at timestamptz not null default now());
create table if not exists public.promos (id uuid primary key default gen_random_uuid(), code text not null unique, discount_type text not null check(discount_type in ('percent','amount')), discount_value integer not null check(discount_value>=0), slots integer not null default 0 check(slots>=0), active boolean not null default true, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now());
create table if not exists public.bookings (id uuid primary key default gen_random_uuid(), customer_name text not null, phone text not null, service_id text references public.services(id) on delete set null, service_name text not null, booking_date date not null, booking_time text not null, duration_minutes integer not null default 60 check(duration_minutes>0), total_price integer not null default 0 check(total_price>=0), promo_code text, status text not null default 'PENDING' check(status in ('PENDING','CONFIRMED','RESCHEDULED','CANCELLED','COMPLETED')), created_at timestamptz not null default now());
create table if not exists public.site_settings (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.services enable row level security;
alter table public.promos enable row level security;
alter table public.bookings enable row level security;
alter table public.site_settings enable row level security;
-- Add carefully scoped RLS policies and Supabase Auth before production.
-- Do not expose the service_role key in browser JavaScript.
