-- Bucket nova-docs — PRIVÉ (pas public)
-- Les fichiers ne sont accessibles qu'avec une URL signée temporaire (7 jours)

INSERT INTO storage.buckets (id, name, public) VALUES ('nova-docs', 'nova-docs', false);

-- Upload : l'utilisateur ne peut uploader que ses propres fichiers
CREATE POLICY "users_upload_own_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'nova-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Lecture : uniquement ses propres fichiers
CREATE POLICY "users_read_own_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'nova-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Suppression : uniquement ses propres fichiers
CREATE POLICY "users_delete_own_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'nova-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Convention de nommage : {user_id}/{timestamp}_{filename}
-- Exemple : uploads/{uid}/1719484800000_contrat.pdf
