-- Bucket sites — PUBLIC (pages vitrine générées par IA)
-- Convention : sites/{user_id}/index.html
-- L'utilisateur peut héberger son site sur l'URL publique Supabase Storage.

INSERT INTO storage.buckets (id, name, public)
VALUES ('sites', 'sites', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "users_upload_own_site"  ON storage.objects;
DROP POLICY IF EXISTS "users_update_own_site"  ON storage.objects;
DROP POLICY IF EXISTS "users_delete_own_site"  ON storage.objects;
DROP POLICY IF EXISTS "public_read_sites"       ON storage.objects;

-- L'utilisateur authentifié peut uploader uniquement dans son dossier
CREATE POLICY "users_upload_own_site" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sites'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users_update_own_site" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'sites'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users_delete_own_site" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'sites'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Accès public en lecture pour toutes les pages vitrine
CREATE POLICY "public_read_sites" ON storage.objects
  FOR SELECT USING (bucket_id = 'sites');
