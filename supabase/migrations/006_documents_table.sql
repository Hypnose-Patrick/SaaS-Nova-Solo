-- Documents & files storage metadata
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT, -- pdf, csv, xlsx, json, etc.
  file_size INTEGER,
  storage_path TEXT, -- path in Supabase Storage
  mime_type TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  checksum TEXT, -- MD5 or SHA256 for integrity
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Users can only access their own documents
CREATE POLICY "Users can view their own documents"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can upload documents"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX documents_user_id_idx ON public.documents(user_id);
CREATE INDEX documents_project_id_idx ON public.documents(project_id);
