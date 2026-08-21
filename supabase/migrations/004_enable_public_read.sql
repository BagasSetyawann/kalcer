-- ============================================================
-- KalRemind: Migration 004 - Enable Public Read Access
--
-- Mengizinkan akses anonim (public) hanya untuk membaca
-- (SELECT) tabel events untuk keperluan Dashboard Publik.
-- ============================================================

-- Berikan akses select ke anon
GRANT SELECT ON public.events TO anon;

-- Buat policy untuk read access ke public
DROP POLICY IF EXISTS "anon_read_events" ON public.events;
CREATE POLICY "anon_read_events" ON public.events
  FOR SELECT
  TO anon
  USING (true);
