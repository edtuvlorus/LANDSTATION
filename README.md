# Land Station — Neon Space UI Revision

## Perubahan
- Wordmark LAND STATION diperbarui memakai gambar logo yang dikirim.
- Visual diperbarui mengikuti referensi: outline gradasi, glow tipis, latar space dengan bintang/orbit, tombol glass/neon, dan font futuristik Orbitron + Space Grotesk.
- Responsif untuk desktop dan mobile.
- Ditambahkan `vercel.json`, `.gitignore`, dan starter schema Supabase.

## Preview
Buka `index.html` langsung, atau gunakan VS Code + Live Server. Dashboard demo ada di `admin.html`.

## Deploy ke GitHub
1. Extract ZIP.
2. Buat repository baru di https://github.com/new.
3. Upload isi folder ini ke root repository, bukan ZIP-nya.
4. Commit ke branch `main`.

Atau lewat terminal:
```bash
git init
git add .
git commit -m "Refresh Land Station neon space UI"
git branch -M main
git remote add origin https://github.com/USERNAME/land-station.git
git push -u origin main
```
Ganti `USERNAME` dengan username GitHub kamu.

## Deploy ke Vercel
1. Buka https://vercel.com/new dan import repository GitHub.
2. Framework preset: **Other**.
3. Karena ini HTML statis, tidak perlu build command; output root project (`.`).
4. Klik Deploy. Push berikutnya ke branch yang terhubung akan memicu deployment baru.

## Menyiapkan Supabase
1. Buat project di https://supabase.com/dashboard.
2. Buka SQL Editor dan jalankan isi `supabase/schema.sql`.
3. Schema menyiapkan tabel `services`, `promos`, `bookings`, `site_settings`.

**Penting:** website ini masih menggunakan `localStorage` untuk data demo. SQL hanya menyiapkan struktur database dan belum menghubungkan form booking/admin ke Supabase. Sebelum live, integrasikan `js/main.js` dan `js/admin.js` dengan Supabase, siapkan Supabase Auth untuk admin, lalu buat RLS policies yang aman. Jangan pernah memasukkan `service_role` key ke HTML/JavaScript publik. Jangan membuka akses publik ke seluruh data pelanggan.

## Struktur
- `index.html` — website publik
- `admin.html` — dashboard demo
- `css/style.css` — tema visual
- `js/main.js`, `js/admin.js` — interaksi demo
- `assets/` — logo dan ilustrasi
- `supabase/schema.sql` — starter schema


## Supabase frontend connection (revisi)
- `index.html` and `admin.html` initialize the Supabase JS client using the supplied project URL and publishable key.
- The public booking form now attempts to insert booking requests into `public.bookings`.
- Run the complete `supabase/schema.sql` in Supabase SQL Editor before testing. It creates/updates tables, seeds the default service IDs used by the form, and adds limited RLS policies for active catalog reads, promo reads, and public booking inserts.
- Public visitors do **not** receive permission to read booking records. This is intentional to protect customer names and phone numbers.

## Current limitations — read before production
- The existing admin dashboard still uses browser `localStorage` for viewing/updating bookings, services, and promos. It does not yet load or update these records from Supabase, so bookings sent from another device will not automatically appear in the admin dashboard.
- Public booking inserts are connected, but price/slot/promo validation is still frontend-driven. Before accepting real payments or guaranteeing reservations, move price calculation and slot locking to a secure server/database RPC and add abuse protection.
- Admin login and admin-only RLS policies are not implemented in this ZIP. Do not expose booking SELECT/update permissions publicly. Add Supabase Auth and a verified admin authorization strategy before connecting admin reads/writes.
- The Supabase publishable key is designed for frontend use. Never use a `service_role` key or secret key in browser code.

## Upload foto/video Home Hero ke Supabase

Dashboard **Dashboard & tampilan → Midnight Mode · Home Hero** mendukung upload foto atau video. File media diunggah ke bucket `site-media` pada Supabase Storage; URL dan tipe media disimpan pada `public.site_settings` dengan key `homepage_media`. Halaman home membaca setting tersebut sehingga media yang sama tampil untuk pengunjung di perangkat lain.

### Setup tambahan (wajib satu kali)
1. Buka **Supabase Dashboard → SQL Editor**.
2. Jalankan ulang file `supabase/schema.sql` versi paket ini (aman untuk tabel yang sudah ada; policy media dibuat ulang).
3. Deploy ulang seluruh file ke hosting.
4. Buka dashboard admin, pilih foto/video hero, lalu klik **SIMPAN TAMPILAN**.

Batas upload dashboard: foto 12 MB, video 50 MB. Format video yang disarankan MP4 (H.264) atau WebM. Video tampil muted, autoplay, loop, dan playsinline.

**Peringatan keamanan:** dashboard statis ini belum memakai login admin Supabase. Policy upload dan update hero pada SQL di atas mengizinkan akses anonim, sehingga siapa pun yang mengetahui URL aplikasi dapat mengganti media hero atau mengunggah file ke bucket. Sebelum dipakai publik, pasang Supabase Auth dan ubah policy agar hanya akun admin terotorisasi yang bisa upload/update. Jangan pernah memasukkan service-role key ke frontend.
