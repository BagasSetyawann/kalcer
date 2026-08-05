-- ============================================================
-- KalRemind: Initial Schema Migration
-- Jalankan script ini di Supabase SQL Editor
-- (Database → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- Buat tabel events
CREATE TABLE IF NOT EXISTS public.events (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,
  category    TEXT NOT NULL,
  "picName"   TEXT NOT NULL,
  "picPhone"  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan comment pada kolom
COMMENT ON COLUMN public.events.status IS 'pending | reminded | confirmed';

-- Index untuk query berdasarkan tanggal dan status (performa)
CREATE INDEX IF NOT EXISTS idx_events_date    ON public.events (date);
CREATE INDEX IF NOT EXISTS idx_events_status  ON public.events (status);
CREATE INDEX IF NOT EXISTS idx_events_phone   ON public.events ("picPhone");

-- ============================================================
-- Row Level Security (RLS)
-- Kita nonaktifkan RLS agar Edge Functions dengan service_role
-- bisa mengakses tanpa perlu autentikasi pengguna.
-- Data ini diakses oleh admin melalui aplikasi internal.
-- ============================================================
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;

-- Grant akses penuh ke service_role (untuk Edge Functions)
GRANT ALL ON public.events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.events_id_seq TO service_role;

-- Grant akses baca ke anon (untuk frontend via anon key, jika diperlukan)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.events_id_seq TO anon;
