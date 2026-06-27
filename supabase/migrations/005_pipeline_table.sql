-- Sales pipeline table (prospects, deals, contacts)
CREATE TABLE IF NOT EXISTS public.pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL, -- prospect, qualified, proposal, negotiation, won, lost
  company_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  deal_value DECIMAL(12, 2),
  currency TEXT DEFAULT 'CHF',
  deal_probability DECIMAL(3, 2), -- 0.0 to 1.0
  expected_close_date DATE,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.pipeline ENABLE ROW LEVEL SECURITY;

-- Users can only access their own pipeline
CREATE POLICY "Users can view their own pipeline"
  ON public.pipeline
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own pipeline"
  ON public.pipeline
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pipeline"
  ON public.pipeline
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own pipeline"
  ON public.pipeline
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER pipeline_updated_at_trigger
BEFORE UPDATE ON public.pipeline
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX pipeline_user_id_idx ON public.pipeline(user_id);
CREATE INDEX pipeline_stage_idx ON public.pipeline(stage);
CREATE INDEX pipeline_expected_close_date_idx ON public.pipeline(expected_close_date);
