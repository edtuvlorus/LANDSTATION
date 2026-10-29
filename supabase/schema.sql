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


-- Frontend integration policies: public can read active catalog/promo data and submit bookings.
-- No public SELECT policy is created for bookings, so customer records remain private.
alter table public.bookings add column if not exists notes text not null default '';

insert into public.services (id,name,description,price,slot,image_url,active)
values
 ('ps4','PS4 Station','Console gaming untuk sesi santai, co-op, dan kompetisi antar teman.',25000,11,'assets/ps4.svg',true),
 ('ps5','PS5 Station','Next-gen console experience untuk main bareng squad.',35000,12,'assets/ps5.svg',true),
 ('billiard','Billiard Table Rent','Meja pool untuk casual play maupun friendly match.',50000,5,'assets/billiard.svg',true),
 ('arcade','Arcade & Retro Gaming','Rhythm, fighting, dan retro games dalam satu zona.',10000,30,'assets/arcade.svg',true)
on conflict (id) do nothing;

drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services"
on public.services for select to anon, authenticated
using (active = true);

drop policy if exists "Public can read active promos" on public.promos;
create policy "Public can read active promos"
on public.promos for select to anon, authenticated
using (active = true and slots > 0 and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));

drop policy if exists "Public can submit booking requests" on public.bookings;
create policy "Public can submit booking requests"
on public.bookings for insert to anon, authenticated
with check (
  length(trim(customer_name)) between 2 and 120
  and length(regexp_replace(phone, '[^0-9+]', '', 'g')) between 8 and 20
  and length(trim(service_name)) between 2 and 120
  and booking_date >= current_date
  and length(trim(booking_time)) between 4 and 10
  and total_price >= 0
  and status = 'PENDING'
);

-- Keep admin mutations locked until Supabase Auth + an explicit admin authorization
-- policy has been configured. Do not add a public SELECT policy to bookings.
