-- ============================================================
-- KalRemind: Migration 002 - Enable Auth & RLS
--
-- Jalankan di Supabase SQL Editor SETELAH migration 001.
-- Ini mengaktifkan Row Level Security agar hanya user
-- yang sudah login (via Supabase Auth) dapat mengakses data.
--
-- Cara membuat user admin pertama:
--   1. Buka Supabase Dashboard → Authentication → Users
--   2. Klik "Invite user" atau "Add user"
--   3. Masukkan email & password admin
-- ============================================================

-- Aktifkan RLS pada tabel events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "anon_full_access" ON public.events;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.events;

-- Buat policy: hanya user yang sudah login (authenticated) bisa akses
CREATE POLICY "authenticated_full_access" ON public.events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role (digunakan Edge Functions) tetap bisa akses tanpa RLS
-- (service_role selalu bypass RLS secara default di Supabase)

-- Cabut akses anon dari events (tidak boleh akses tanpa login)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.events FROM anon;
