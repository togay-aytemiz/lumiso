-- Create session status enum
CREATE TYPE session_status AS ENUM ('planned', 'completed', 'in_post_processing', 'delivered', 'cancelled');

-- Add status column to sessions table with default 'planned'
ALTER TABLE public.sessions 
ADD COLUMN status session_status NOT NULL DEFAULT 'planned';

-- Create index for better performance when filtering by status
CREATE INDEX idx_sessions_status ON public.sessions(status);

-- Create index for checking planned sessions per lead
CREATE INDEX idx_sessions_lead_status ON public.sessions(lead_id, status);

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

-- Create trigger to enforce the planned session limit
CREATE TRIGGER trigger_check_planned_session_limit
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_planned_session_limit();