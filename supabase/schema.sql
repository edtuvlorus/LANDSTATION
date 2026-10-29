-- =====================================================================
-- LAND STATION — Supabase schema (jalankan SELURUH file di SQL Editor)
-- Aman dijalankan ulang. Mengatur: tabel, RLS, storage bucket, RPC booking.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Tabel ----------
create table if not exists public.services (
  id text primary key,
  name text not null,
  description text not null default '',
  price integer not null default 0 check (price >= 0),   -- HARGA PER JAM (Rupiah)
  slot integer not null default 0 check (slot >= 0),
  image_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.services add column if not exists sort_order integer not null default 0;
alter table public.services add column if not exists default_hours integer not null default 1 check (default_hours between 1 and 12);
comment on column public.services.price is 'Harga per jam (Rupiah)';

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','amount')),
  discount_value integer not null check (discount_value >= 0),
  slots integer not null default 0 check (slots >= 0),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  service_id text references public.services(id) on delete set null,
  service_name text not null,
  booking_date date not null,
  booking_time text not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  total_price integer not null default 0 check (total_price >= 0),
  promo_code text,
  notes text not null default '',
  status text not null default 'PENDING'
    check (status in ('PENDING','CONFIRMED','RESCHEDULED','CANCELLED','COMPLETED')),
  created_at timestamptz not null default now()
);
alter table public.bookings add column if not exists notes text not null default '';

-- Semua pengaturan tampilan: homepage_media, gallery, event, venue
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Catatan setiap file foto/video yang di-upload dari dashboard
create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  url text not null,
  kind text not null check (kind in ('image','video')),
  folder text not null default '',
  mime text not null default '',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Trigger updated_at ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_services_updated on public.services;
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();
drop trigger if exists trg_settings_updated on public.site_settings;
create trigger trg_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------- Seed layanan (harga per jam) ----------
insert into public.services (id,name,description,price,slot,image_url,active,sort_order) values
 ('ps4','PS4 Station','Console gaming untuk sesi santai, co-op, dan kompetisi antar teman.',25000,11,'assets/ps4.svg',true,1),
 ('ps5','PS5 Station','Next-gen console experience untuk main bareng squad.',35000,12,'assets/ps5.svg',true,2),
 ('billiard','Billiard Table Rent','Meja pool untuk casual play maupun friendly match.',50000,5,'assets/billiard.svg',true,3),
 ('arcade','Arcade & Retro Gaming','Rhythm, fighting, dan retro games dalam satu zona.',10000,30,'assets/arcade.svg',true,4)
on conflict (id) do nothing;

-- ---------- Helper admin ----------
-- Admin = user yang login lewat Supabase Authentication (dibuat di Authentication -> Users).
-- PENTING: matikan "Allow new users to sign up" di Authentication -> Sign In / Providers
-- agar orang lain tidak bisa mendaftar sendiri. Login anonim juga ditolak.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Tabel admin_users dari versi sebelumnya tidak dipakai lagi
drop table if exists public.admin_users cascade;

-- ---------- RLS ----------
alter table public.services      enable row level security;
alter table public.promos        enable row level security;
alter table public.bookings      enable row level security;
alter table public.site_settings enable row level security;
alter table public.media_files   enable row level security;

-- Hapus policy lama (termasuk policy anonim yang tidak aman)
drop policy if exists "Public can read active services" on public.services;
drop policy if exists "Public can read active promos" on public.promos;
drop policy if exists "Public can submit booking requests" on public.bookings;
drop policy if exists "Public can read homepage media setting" on public.site_settings;
drop policy if exists "Public can create homepage media setting" on public.site_settings;
drop policy if exists "Public can update homepage media setting" on public.site_settings;
drop policy if exists "Public can view site media files" on storage.objects;
drop policy if exists "Public can upload site media files" on storage.objects;
drop policy if exists "ls services public read" on public.services;
drop policy if exists "ls services admin all" on public.services;
drop policy if exists "ls promos public read" on public.promos;
drop policy if exists "ls promos admin all" on public.promos;
drop policy if exists "ls bookings admin all" on public.bookings;
drop policy if exists "ls settings public read" on public.site_settings;
drop policy if exists "ls settings admin all" on public.site_settings;
drop policy if exists "ls media admin all" on public.media_files;
drop policy if exists "ls storage public read" on storage.objects;
drop policy if exists "ls storage admin insert" on storage.objects;
drop policy if exists "ls storage admin update" on storage.objects;
drop policy if exists "ls storage admin delete" on storage.objects;

-- Pengunjung: hanya baca katalog aktif, promo aktif, dan pengaturan tampilan
create policy "ls services public read" on public.services
  for select to anon, authenticated using (active = true);
create policy "ls promos public read" on public.promos
  for select to anon, authenticated
  using (active and slots > 0 and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));
create policy "ls settings public read" on public.site_settings
  for select to anon, authenticated using (true);

-- Admin: akses penuh
create policy "ls services admin all" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ls promos admin all" on public.promos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ls bookings admin all" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ls settings admin all" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ls media admin all" on public.media_files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage bucket untuk foto & video ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media','site-media',true,52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];

create policy "ls storage public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'site-media');
create policy "ls storage admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
create policy "ls storage admin update" on storage.objects
  for update to authenticated using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin());
create policy "ls storage admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());

-- ---------- Anti bentrok jadwal & data pendukung anti-spam ----------
-- Kapasitas layanan = kolom services.slot (jumlah unit, mis. 11 unit PS4).
-- Booking aktif (PENDING/CONFIRMED/RESCHEDULED) tidak boleh melebihi kapasitas pada jam yang sama.
alter table public.bookings add column if not exists start_at timestamp;
alter table public.bookings add column if not exists end_at timestamp;
alter table public.bookings add column if not exists phone_norm text;
alter table public.bookings add column if not exists client_ip text;
create index if not exists bookings_service_time_idx on public.bookings (service_id, start_at, end_at);
create index if not exists bookings_phone_idx on public.bookings (phone_norm, created_at);
create index if not exists bookings_ip_idx on public.bookings (client_ip, created_at);

-- "09.30" -> 570 menit. "00.00" dianggap tengah malam akhir hari (1440).
create or replace function public.ls_parse_time(p text) returns integer
language sql immutable as $$
  select case when p ~ '^([01][0-9]|2[0-3])\.[0-5][0-9]$' then
    case when p = '00.00' then 1440
         else split_part(p,'.',1)::int * 60 + split_part(p,'.',2)::int end
  end
$$;

create or replace function public.ls_norm_phone(p text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(p,''), '[^0-9]', '', 'g'), '^62', '0')
$$;

-- Trigger: hitung start_at/end_at dan tolak jika kapasitas penuh.
-- Berlaku untuk booking baru DAN reschedule/perubahan dari dashboard admin.
create or replace function public.ls_bookings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m int; cap int; t timestamp; n int; v_check boolean;
  act text[] := array['PENDING','CONFIRMED','RESCHEDULED'];
begin
  m := public.ls_parse_time(new.booking_time);
  if m is null then raise exception 'Jam tidak valid'; end if;
  new.start_at := new.booking_date::timestamp + make_interval(mins => m);
  new.end_at   := new.start_at + make_interval(mins => new.duration_minutes);
  new.phone_norm := public.ls_norm_phone(new.phone);

  if tg_op = 'INSERT' then
    v_check := true;
  else
    v_check := old.start_at is distinct from new.start_at
            or old.end_at is distinct from new.end_at
            or old.service_id is distinct from new.service_id
            or not (old.status = any(act));
  end if;

  if v_check and new.status = any(act) and new.service_id is not null then
    select slot into cap from public.services where id = new.service_id;
    if coalesce(cap,0) <= 0 then raise exception 'Layanan ini tidak memiliki unit tersedia'; end if;
    perform pg_advisory_xact_lock(hashtext('ls_booking:' || new.service_id));
    t := new.start_at;
    while t < new.end_at loop
      select count(*) into n from public.bookings b
       where b.service_id = new.service_id and b.id <> new.id
         and b.status = any(act) and b.start_at <= t and b.end_at > t;
      if n >= cap then
        raise exception 'Jadwal % sudah penuh untuk layanan ini. Silakan pilih jam atau durasi lain.', to_char(t,'DD/MM HH24.MI');
      end if;
      t := t + interval '30 minutes';
    end loop;
  end if;
  return new;
end $$;

-- Isi data lama dulu (trigger dipasang SESUDAH backfill agar data lama tidak ditolak)
drop trigger if exists trg_bookings_guard on public.bookings;
update public.bookings
   set start_at = booking_date::timestamp + make_interval(mins => coalesce(public.ls_parse_time(booking_time), 0)),
       end_at   = booking_date::timestamp + make_interval(mins => coalesce(public.ls_parse_time(booking_time), 0) + duration_minutes),
       phone_norm = public.ls_norm_phone(phone)
 where start_at is null;
create trigger trg_bookings_guard before insert or update on public.bookings
  for each row execute function public.ls_bookings_guard();

-- Ketersediaan per 30 menit untuk satu layanan & tanggal (dipakai form booking untuk mencoret jam penuh)
create or replace function public.get_availability(p_service_id text, p_date date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cap int; res jsonb := '{}'::jsonb; m int; t timestamp; n int;
begin
  select slot into cap from public.services where id = p_service_id and active;
  if not found then return jsonb_build_object('capacity', 0, 'used', '{}'::jsonb); end if;
  for m in select generate_series(540, 1440, 30) loop
    t := p_date::timestamp + make_interval(mins => m);
    select count(*) into n from public.bookings
     where service_id = p_service_id and status in ('PENDING','CONFIRMED','RESCHEDULED')
       and start_at <= t and end_at > t;
    res := res || jsonb_build_object(m::text, n);
  end loop;
  return jsonb_build_object('capacity', cap, 'used', res);
end $$;
revoke all on function public.get_availability(text,date) from public;
grant execute on function public.get_availability(text,date) to anon, authenticated;

-- ---------- Kategori layanan (PS4, PS5, Billiard, Arcade, atau buatan sendiri) ----------
-- Kategori mengelompokkan LAYANAN (tabel services). Jumlah layanan = kolom services.slot (unit), foto ada di tiap layanan.
create table if not exists public.service_categories (
  id text primary key,
  name text not null,
  unit_count integer not null default 1 check (unit_count >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.service_categories add column if not exists unit_count integer not null default 1 check (unit_count >= 0);
alter table public.services add column if not exists category_id text references public.service_categories(id) on delete set null;
insert into public.service_categories (id,name,sort_order) values
 ('ps4','PS4',1),('ps5','PS5',2),('billiard','Billiard',3),('arcade','Arcade',4)
on conflict (id) do nothing;
update public.services set category_id = id where category_id is null and id in (select id from public.service_categories);
alter table public.service_categories enable row level security;
drop policy if exists "ls categories public read" on public.service_categories;
drop policy if exists "ls categories admin all" on public.service_categories;
create policy "ls categories public read" on public.service_categories for select to anon, authenticated using (true);
create policy "ls categories admin all" on public.service_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Paket layanan (harga paket / sekian jam, masuk ke kategori layanan) ----------
-- Kategori layanan = baris di tabel services (PS4, PS5, Billiard, Arcade, dst.) beserta kapasitas slot/unit-nya.
-- Setiap paket menempel ke satu kategori; saat dibooking, paket memakai 1 slot/unit dari kategori itu.
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(id) on delete cascade,
  name text not null,
  hours integer not null check (hours between 1 and 12),
  price integer not null default 0 check (price >= 0),   -- HARGA PAKET (Rupiah)
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists packages_service_idx on public.packages (service_id, sort_order);
alter table public.bookings add column if not exists package_name text;
alter table public.packages enable row level security;
drop policy if exists "ls packages public read" on public.packages;
drop policy if exists "ls packages admin all" on public.packages;
create policy "ls packages public read" on public.packages for select to anon, authenticated using (active = true);
create policy "ls packages admin all" on public.packages for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- RPC booking: harga di server + validasi + anti-spam ----------
drop function if exists public.create_booking(text,text,text,date,text,integer,text,text);
drop function if exists public.create_booking(text,text,text,date,text,integer,text,text,text);
create or replace function public.create_booking(
  p_name text, p_phone text, p_service_id text, p_date date, p_time text,
  p_hours integer, p_promo text default null, p_notes text default '', p_website text default '', p_package_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.services;
  pk public.packages; v_hours integer;
  pr public.promos;
  v_base integer; v_total integer; v_id uuid;
  v_promo text := nullif(trim(coalesce(p_promo,'')), '');
  v_now timestamp := now() at time zone 'Asia/Jakarta';
  v_min int; v_start timestamp;
  v_phone text := public.ls_norm_phone(p_phone);
  v_hdr text := nullif(current_setting('request.headers', true), '');
  v_ip text;
  act text[] := array['PENDING','CONFIRMED','RESCHEDULED'];
begin
  -- Honeypot: kolom tersembunyi diisi bot -> pura-pura sukses, tidak disimpan
  if length(coalesce(p_website,'')) > 0 then
    return jsonb_build_object('id', gen_random_uuid(), 'total_price', 0, 'hours', coalesce(p_hours,1));
  end if;

  begin v_ip := nullif(trim(split_part(coalesce((v_hdr::json)->>'x-forwarded-for',''), ',', 1)), '');
  exception when others then v_ip := null; end;

  if length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Nama tidak valid'; end if;
  if length(v_phone) not between 8 and 16 then raise exception 'Nomor WhatsApp tidak valid'; end if;
  if p_package_id is null and (p_hours is null or p_hours not between 1 and 12) then raise exception 'Durasi tidak valid'; end if;
  v_min := public.ls_parse_time(p_time);
  if v_min is null then raise exception 'Jam tidak valid'; end if;
  if p_date is null or p_date < v_now::date or p_date > v_now::date + 180 then raise exception 'Tanggal tidak valid'; end if;
  v_start := p_date::timestamp + make_interval(mins => v_min);
  if v_start < v_now then raise exception 'Jam mulai sudah lewat. Pilih jam yang masih tersedia.'; end if;

  -- ===== Pembatasan spam =====
  if exists (select 1 from public.bookings where phone_norm = v_phone and created_at > now() - interval '30 seconds') then
    raise exception 'Terlalu cepat. Tunggu 30 detik sebelum membuat booking lagi.';
  end if;
  if (select count(*) from public.bookings where phone_norm = v_phone and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Batas booking harian untuk nomor ini tercapai (maks. 5 per 24 jam).';
  end if;
  if (select count(*) from public.bookings where phone_norm = v_phone and status = any(act) and start_at >= v_now) >= 3 then
    raise exception 'Nomor ini sudah memiliki 3 booking aktif. Selesaikan atau batalkan dulu sebelum booking lagi.';
  end if;
  if v_ip is not null then
    if (select count(*) from public.bookings where client_ip = v_ip and created_at > now() - interval '10 seconds') >= 2 then
      raise exception 'Terlalu banyak permintaan. Coba lagi sebentar lagi.';
    end if;
    if (select count(*) from public.bookings where client_ip = v_ip and created_at > now() - interval '1 hour') >= 8 then
      raise exception 'Terlalu banyak booking dari jaringan ini. Coba lagi dalam 1 jam.';
    end if;
  end if;

  select * into s from public.services where id = p_service_id and active;
  if not found then raise exception 'Layanan tidak tersedia'; end if;

  if p_package_id is not null then
    select * into pk from public.packages where id = p_package_id and service_id = s.id and active;
    if not found then raise exception 'Paket tidak tersedia untuk layanan ini'; end if;
    v_hours := pk.hours; v_base := pk.price;
  else
    v_hours := p_hours; v_base := s.price * p_hours;
  end if;
  v_total := v_base;
  if v_promo is not null then
    select * into pr from public.promos
     where upper(code) = upper(v_promo) and active and slots > 0
       and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
     for update;
    if not found then raise exception 'Kode promo tidak valid atau sudah habis'; end if;
    v_total := case when pr.discount_type = 'percent'
                    then greatest(0, v_base - (v_base * pr.discount_value / 100))
                    else greatest(0, v_base - pr.discount_value) end;
  end if;

  -- Trigger ls_bookings_guard menolak insert jika jadwal bentrok / kapasitas penuh
  -- (error otomatis membatalkan seluruh transaksi, termasuk pengurangan slot promo di bawah)
  insert into public.bookings
    (customer_name, phone, service_id, service_name, booking_date, booking_time,
     duration_minutes, total_price, promo_code, notes, status, client_ip, package_name)
  values
    (trim(p_name), trim(p_phone), s.id, s.name, p_date, p_time,
     v_hours * 60, v_total, case when v_promo is null then null else upper(v_promo) end,
     left(coalesce(p_notes,''), 500), 'PENDING', v_ip, pk.name)
  returning id into v_id;

  if v_promo is not null then update public.promos set slots = slots - 1 where id = pr.id; end if;

  return jsonb_build_object('id', v_id, 'total_price', v_total, 'hours', v_hours);
end $$;
revoke all on function public.create_booking(text,text,text,date,text,integer,text,text,text,uuid) from public;
grant execute on function public.create_booking(text,text,text,date,text,integer,text,text,text,uuid) to anon, authenticated;
