# Land Station — Revisi: Upload ke Supabase + Harga/Jam + CSS tanpa overlay

## Yang berubah
- **Semua upload dashboard tersimpan di Supabase**: file → Storage bucket `site-media`, catatan file → tabel `media_files`, pengaturan → tabel `site_settings`.
  Mencakup hero (foto/video), galeri (foto/video), banner event, dan foto layanan. File otomatis tersimpan begitu dipilih (tidak perlu menekan simpan).
- **Harga per jam bisa diatur di dashboard** (tab *Layanan & harga/jam*). Ubah angka di tabel → otomatis tersimpan ke tabel `services`. Booking menghitung total = harga/jam × durasi (pilihan durasi ditambahkan di form booking).
- **Layanan, promo, dan booking** sekarang dibaca/ditulis ke Supabase (bukan lagi `localStorage`), jadi booking dari perangkat lain muncul di dashboard.
- **Login admin lewat Supabase Authentication saja**. Sebelumnya policy mengizinkan siapa pun (anonim) mengganti media dan mengupload ke bucket. Sekarang hanya user yang login (dibuat di Authentication → Users) yang bisa menulis. Tidak ada tabel admin terpisah.
- **Booking lewat RPC `create_booking`**: harga dihitung di server dari harga/jam di database, promo divalidasi & slot promo dikurangi di server.
- **CSS ditulis ulang** (`css/style.css`): tidak ada lagi `body:before/:after`, lingkaran `.section:after`, frame `.hero-visual:before/:after`, scrim `.gallery-card:after`/`.event-banner:after`, atau efek `.btn:before/:after` yang saling menumpuk. Teks di atas foto memakai panel/badge sendiri; banner event dibuat panel + foto berdampingan.

## Anti bentrok jadwal
- Kapasitas tiap layanan = kolom **Slot / unit** (mis. PS4 = 11 unit). Booking aktif (Pending/Confirmed/Reschedule) pada jam yang tumpang tindih tidak boleh melebihi kapasitas itu.
- Dicek di database (trigger `ls_bookings_guard`) dengan kunci per layanan, jadi dua orang yang menekan kirim bersamaan tetap tidak bisa sama-sama masuk ke unit terakhir.
- Berlaku juga saat admin melakukan *Reschedule* di dashboard (jika penuh, muncul pesan error dan jadwal tidak berubah). Booking yang dibatalkan/selesai tidak menghitung kapasitas.
- Form booking mencoret jam yang penuh sesuai layanan, tanggal, dan durasi yang dipilih, serta jam yang sudah lewat hari ini.
- Booking yang melewati tengah malam ikut dihitung ke hari berikutnya.

## Pembatasan spam
Di server (`create_booking`, tidak bisa dilewati lewat browser):
- Jeda 30 detik per nomor WhatsApp; maks. 5 booking per 24 jam per nomor; maks. 3 booking aktif mendatang per nomor.
- Per alamat IP: maks. 8 booking per jam dan 2 per 10 detik.
- Kolom tersembunyi (honeypot): bot yang mengisinya dianggap sukses palsu dan tidak disimpan.
- Jam mulai yang sudah lewat, tanggal lebih dari 180 hari, dan nomor/durasi tidak valid ditolak.
Di browser: jeda 30 detik antar kirim dan form tidak bisa dikirim kurang dari 2,5 detik setelah dibuka.
Angka batas bisa diubah di fungsi `create_booking` pada `supabase/schema.sql`.

## Setup (sekali saja)
1. **Supabase → SQL Editor**: jalankan seluruh isi `supabase/schema.sql` (aman diulang; wajib dijalankan ulang untuk fitur jadwal & anti-spam).
2. **Supabase → Authentication → Users → Add user**: buat akun admin (email + password, centang *Auto Confirm User*). Menambah/menghapus admin cukup dilakukan di sini.
3. **Authentication → Sign In / Providers**: matikan **Allow new users to sign up** (dan Anonymous sign-ins). Wajib — karena semua user yang login dianggap admin, pendaftaran publik harus ditutup.
4. Deploy ulang seluruh isi folder ini (GitHub → Vercel), buka `/admin`, login, lalu upload.

## Struktur
- `index.html` — website publik · `admin.html` — dashboard (wajib login)
- `css/style.css` — tema · `js/config.js` (koneksi Supabase), `js/common.js`, `js/main.js`, `js/admin.js`
- `supabase/schema.sql` — tabel, RLS, bucket, RPC

## Batas & catatan
- Upload: foto 12 MB (foto besar otomatis diperkecil ke maks 2400 px), video 50 MB (MP4/WebM disarankan).
- Gunakan hanya publishable key di frontend. Jangan pernah memasukkan `service_role`/secret key.
- Pembatasan spam memakai batas per nomor/IP dan honeypot, belum CAPTCHA. Jika masih ada spam, tambahkan Cloudflare Turnstile sebelum menerima pembayaran.
- Field URL gambar manual dan embed post Instagram dihapus dari dashboard (embed tidak punya tempat di halaman home); link profil Instagram tetap ada di footer.
