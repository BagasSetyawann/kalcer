-- ============================================================
-- KalRemind: Migration 006 - Evidence Collection
--
-- Menambahkan kolom evidence_url pada tabel events dan
-- menyiapkan Supabase Storage bucket untuk menyimpan file bukti.
-- ============================================================

-- 1. Tambah kolom evidence_url di tabel events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- 2. Buat Bucket Storage 'evidence'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Atur Policy Storage agar Publik bisa membaca file
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'evidence');

-- 4. Atur Policy Storage agar Authenticated (Admin) bisa mengunggah file
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'evidence');

-- 5. Atur Policy Storage agar Authenticated (Admin) bisa mengupdate/menghapus file (opsional)
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'evidence');

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'evidence');
