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
