-- ============================================================
-- KalRemind: Migration 005 - Dynamic Activity Logs
--
-- Membuat tabel activity_logs dan sistem trigger otomatis
-- untuk mencatat setiap perubahan data pada tabel events.
-- ============================================================

-- 1. Buat tabel activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    action TEXT NOT NULL,         -- 'Tambah', 'Update', 'Hapus'
    entity_title TEXT NOT NULL,   -- Nama kegiatan
    description TEXT
);

-- 2. Aktifkan RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. Izinkan akses SELECT ke publik (anon)
GRANT SELECT ON public.activity_logs TO anon;
GRANT SELECT ON public.activity_logs TO authenticated;

DROP POLICY IF EXISTS "anon_read_activity_logs" ON public.activity_logs;
CREATE POLICY "anon_read_activity_logs" ON public.activity_logs
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "authenticated_read_activity_logs" ON public.activity_logs;
CREATE POLICY "authenticated_read_activity_logs" ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Izinkan INSERT oleh sistem Trigger
-- Secara teknis, fungsi SECURITY DEFINER akan menggunakan hak akses pembuatnya (bypass RLS), 
-- jadi Trigger akan bisa memasukkan data tanpa kebijakan insert RLS khusus.

-- 5. Buat Fungsi Trigger
CREATE OR REPLACE FUNCTION public.log_event_action()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (action, entity_title, description)
        VALUES ('Tambah', NEW.title, 'Kegiatan baru berhasil dijadwalkan.');
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Log hanya jika statusnya berubah
        IF (NEW.status <> OLD.status) THEN
            INSERT INTO public.activity_logs (action, entity_title, description)
            VALUES (
                'Update Status', 
                NEW.title, 
                'Status kegiatan berubah menjadi: ' || upper(NEW.status)
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.activity_logs (action, entity_title, description)
        VALUES ('Hapus', OLD.title, 'Jadwal kegiatan telah dihapus dari sistem.');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Pasang Trigger ke tabel events
DROP TRIGGER IF EXISTS events_audit_trigger ON public.events;
CREATE TRIGGER events_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_event_action();
