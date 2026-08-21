# KALCER 📅 — Kalender Cerdas Reminder

Aplikasi pengingat kegiatan berbasis WhatsApp untuk instansi/organisasi.  
Dibangun dengan **React (Vite)** + **Supabase** + **Fonnte Gateway**.

> Tidak memerlukan VPS. Sepenuhnya berbasis cloud serverless.

---

## Arsitektur

```
[Admin Browser] → [Vercel/Frontend] → [Supabase Edge Functions] → [Fonnte API] → [WhatsApp PIC]
                                   ↕
                           [Supabase PostgreSQL]
```

---

## Prasyarat

1. Akun **[Supabase](https://supabase.com)** (gratis)
2. Akun **[Fonnte](https://fonnte.com)** dengan nomor WA yang sudah didaftarkan
3. Akun **[Vercel](https://vercel.com)** untuk deploy frontend (gratis)
4. **Node.js** v18+ dan **npm** di komputer lokal
5. **Supabase CLI** (untuk deploy Edge Functions)

---

## Panduan Setup Lengkap

### Langkah 1: Setup Database Supabase

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Isi nama project: `kalcer`, isi password database, pilih region terdekat
3. Tunggu project selesai dibuat (~1-2 menit)
4. Buka **SQL Editor** → **New Query**
5. Copy-paste isi file [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) ke editor
6. Klik **Run** → pastikan tidak ada error
7. Ulangi untuk [`supabase/migrations/002_enable_auth_rls.sql`](./supabase/migrations/002_enable_auth_rls.sql)
8. Ulangi untuk [`supabase/migrations/003_recurring_events.sql`](./supabase/migrations/003_recurring_events.sql)

### Langkah 2: Catat Kredensial Supabase

Buka **Settings → API** di dashboard Supabase Anda, catat:

| Nilai | Nama Variabel |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| `anon` public key | `VITE_SUPABASE_ANON_KEY` |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` |

### Langkah 3: Buat File `.env` di Komputer Lokal

Salin file template dan isi:

```bash
copy .env.example .env
```

Isi file `.env`:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Langkah 4: Deploy Edge Functions ke Supabase

Install Supabase CLI jika belum ada:

```bash
npm install -g supabase
```

Login dan link project:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

> `PROJECT_REF` adalah bagian dari URL project Anda: `https://[PROJECT_REF].supabase.co`

Set secrets untuk Edge Functions:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Deploy semua Edge Functions:

```bash
supabase functions deploy events
supabase functions deploy blast
supabase functions deploy receive-reply
```

Setelah deploy berhasil, Edge Function URL Anda akan menjadi:
- `https://<PROJECT_REF>.supabase.co/functions/v1/events`
- `https://<PROJECT_REF>.supabase.co/functions/v1/blast`
- `https://<PROJECT_REF>.supabase.co/functions/v1/receive-reply`

### Langkah 5: Setup Fonnte

1. Daftar di [fonnte.com](https://fonnte.com)
2. Klik **"Add Device"** dan scan QR code dengan WhatsApp Anda
3. Setelah terhubung, salin **API Token** dari dashboard
4. *(Opsional)* Daftarkan Webhook URL untuk menerima balasan PIC:
   - Webhook URL: `https://<PROJECT_REF>.supabase.co/functions/v1/receive-reply`

### Langkah 6: Deploy Frontend ke Vercel

**Cara 1: Via GitHub (Direkomendasikan)**

1. Push kode Anda ke repository GitHub
2. Buka [vercel.com](https://vercel.com) → **New Project** → Import repository
3. Di bagian **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL` = URL project Supabase Anda
   - `VITE_SUPABASE_ANON_KEY` = Anon key Supabase Anda
4. Klik **Deploy**

**Cara 2: Via Vercel CLI**

```bash
npm install -g vercel
vercel --prod
```

Saat diminta, isi Environment Variables yang dibutuhkan.

---

## Menjalankan Secara Lokal (Development)

```bash
# Install dependensi
npm install

# Pastikan .env sudah terisi (lihat Langkah 3)

# Jalankan development server
npm run dev
```

Buka browser di `http://localhost:5173`

---

## Penggunaan Aplikasi

### Menambah Jadwal
1. Klik tombol **"New Event"** di kanan atas
2. Isi Nama Kegiatan, Tanggal, Kategori, Nama PIC, dan Nomor WA PIC
3. Klik **"Simpan Jadwal"**

### Import via Excel
1. Klik tombol **"Import Excel"** di header
2. Download template Excel, isi data, lalu upload kembali
3. Review preview dan klik **"Import"**

### Event Rutin Bulanan
1. Buka tab **"Rutin"**
2. Klik **"Tambah Rutin"** → isi template (tanggal setiap bulan, kategori, PIC)
3. Di awal bulan, klik **"Generate Bulan Ini"** untuk membuat jadwal otomatis

### Mengisi Token Fonnte
1. Buka tab **Pengaturan**
2. Paste token API Fonnte Anda
3. Klik **"Simpan Token"**

### Mengirim Pengingat WA
- **Per jadwal**: Klik ikon lonceng 🔔 atau tombol **"Kirim WA"** di tab Schedules
- **Massal**: Buka tab **Blasting** → klik tombol H-1, H-2, H-3, atau H-7

### Konfirmasi Otomatis
Jika Webhook Fonnte sudah dikonfigurasi, ketika PIC membalas pesan dengan kata **"OK"**, **"Siap"**, **"Baik"**, dll — status jadwal akan otomatis berubah menjadi **Terkonfirmasi** di database (real-time).

---

## Struktur Folder

```
kalcer/
├── src/
│   ├── App.jsx              # Komponen React utama
│   ├── components/
│   │   └── LoginPage.jsx    # Halaman login
│   └── lib/
│       └── supabase.js      # Konfigurasi Supabase client
├── supabase/
│   ├── functions/
│   │   ├── events/          # Edge Function: CRUD jadwal
│   │   ├── blast/           # Edge Function: Kirim WA via Fonnte
│   │   └── receive-reply/   # Edge Function: Webhook balasan Fonnte
│   └── migrations/
│       ├── 001_initial_schema.sql   # SQL setup database
│       ├── 002_enable_auth_rls.sql  # Auth & RLS
│       └── 003_recurring_events.sql # Event rutin bulanan
├── .env.example             # Template environment variables
├── vercel.json              # Konfigurasi deploy Vercel
└── package.json
```

---

## Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS |
| Database | Supabase (PostgreSQL) |
| Backend API | Supabase Edge Functions (Deno/TypeScript) |
| Realtime | Supabase Realtime |
| Gateway WA | Fonnte API |
| Deploy Frontend | Vercel |
| Import Data | SheetJS (xlsx) |
