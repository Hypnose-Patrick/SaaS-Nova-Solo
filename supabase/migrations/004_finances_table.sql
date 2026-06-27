-- Financial data table (budgets, forecasts, transactions)
CREATE TABLE IF NOT EXISTS public.finances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- revenue, expense, budget, forecast
  type TEXT, -- income, expense, tax, equipment, etc.
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  date DATE NOT NULL,
  description TEXT,
  tags TEXT[], -- for filtering
  is_encrypted BOOLEAN DEFAULT false,
  encrypted_data BYTEA, -- for sensitive data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

-- Users can only access their own financial data
CREATE POLICY "Users can view their own finances"
  ON public.finances
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own finances"
  ON public.finances
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own finances"
  ON public.finances
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own finances"
  ON public.finances
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER finances_updated_at_trigger
BEFORE UPDATE ON public.finances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX finances_user_id_idx ON public.finances(user_id);
CREATE INDEX finances_date_idx ON public.finances(date);
CREATE INDEX finances_category_idx ON public.finances(category);
