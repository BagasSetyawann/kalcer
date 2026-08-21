-- ============================================================
-- KalRemind: Recurring Events Migration
-- Jalankan script ini di Supabase SQL Editor
-- (Database → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- Buat tabel recurring_events
CREATE TABLE IF NOT EXISTS public.recurring_events (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  day_of_month  INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  category      TEXT NOT NULL,
  "picName"     TEXT NOT NULL,
  "picPhone"    TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan comment
COMMENT ON TABLE  public.recurring_events             IS 'Template event yang berulang setiap bulan pada tanggal tertentu';
COMMENT ON COLUMN public.recurring_events.day_of_month IS 'Tanggal dalam bulan (1-31). Jika bulan pendek, pakai hari terakhir bulan itu.';

-- Index
CREATE INDEX IF NOT EXISTS idx_recurring_active ON public.recurring_events (is_active);

-- Aktifkan RLS (ikuti pola migration 002)
ALTER TABLE public.recurring_events ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "authenticated_full_access" ON public.recurring_events;

-- Buat policy: hanya user yang sudah login (authenticated) bisa akses
CREATE POLICY "authenticated_full_access" ON public.recurring_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant akses ke service_role (untuk Edge Functions)
GRANT ALL ON public.recurring_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.recurring_events_id_seq TO service_role;

-- Cabut akses anon (tidak boleh akses tanpa login)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.recurring_events FROM anon;
