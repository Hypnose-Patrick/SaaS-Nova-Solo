-- Users profile table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  country TEXT DEFAULT 'CH',
  language TEXT DEFAULT 'fr',
  avatar_url TEXT,
  subscription_status TEXT DEFAULT 'free', -- free, pro, enterprise
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  usage_tokens INTEGER DEFAULT 0,
  max_tokens_monthly INTEGER DEFAULT 10000,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only view/edit their own profile
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
