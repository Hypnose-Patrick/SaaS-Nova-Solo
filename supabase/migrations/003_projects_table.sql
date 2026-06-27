-- Projects/Workspaces table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- dashboard, business_plan, cv, etc.
  data JSONB DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Users can only access their own projects
CREATE POLICY "Users can view their own projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER projects_updated_at_trigger
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Index for query performance
CREATE INDEX projects_user_id_idx ON public.projects(user_id);
CREATE INDEX projects_created_at_idx ON public.projects(created_at);
