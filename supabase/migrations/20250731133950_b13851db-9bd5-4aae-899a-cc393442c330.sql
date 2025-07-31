-- Create session status enum (if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('planned', 'completed', 'in_post_processing', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- First, remove the default to avoid casting issues
ALTER TABLE public.sessions 
ALTER COLUMN status DROP DEFAULT;

-- Update existing status column to use enum type
ALTER TABLE public.sessions 
ALTER COLUMN status TYPE session_status USING 
  CASE 
    WHEN status = 'scheduled' THEN 'planned'::session_status
    WHEN status = 'completed' THEN 'completed'::session_status
    WHEN status = 'cancelled' THEN 'cancelled'::session_status
    ELSE 'planned'::session_status
  END;

-- Now set the default for new records
ALTER TABLE public.sessions 
ALTER COLUMN status SET DEFAULT 'planned'::session_status;

-- Create indexes for better performance when filtering by status
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_lead_status ON public.sessions(lead_id, status);

-- Create function to check for existing planned sessions
CREATE OR REPLACE FUNCTION check_planned_session_limit() 
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for planned sessions on INSERT
  IF TG_OP = 'INSERT' AND NEW.status = 'planned' THEN
    -- Check if there's already a planned session for this lead
    IF EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE lead_id = NEW.lead_id 
      AND status = 'planned' 
      AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Lead already has a planned session. Only one planned session is allowed per lead.';
    END IF;
  END IF;
  
  -- On UPDATE, check if we're changing to planned status
  IF TG_OP = 'UPDATE' AND OLD.status != 'planned' AND NEW.status = 'planned' THEN
    -- Check if there's already another planned session for this lead
    IF EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE lead_id = NEW.lead_id 
      AND status = 'planned' 
      AND user_id = NEW.user_id
      AND id != NEW.id  -- Exclude the current session being updated
    ) THEN
      RAISE EXCEPTION 'Lead already has a planned session. Only one planned session is allowed per lead.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS trigger_check_planned_session_limit ON public.sessions;
CREATE TRIGGER trigger_check_planned_session_limit
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_planned_session_limit();