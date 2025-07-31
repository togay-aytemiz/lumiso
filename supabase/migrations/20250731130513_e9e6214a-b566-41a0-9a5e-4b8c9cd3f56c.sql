-- Create table to store Google Calendar OAuth tokens
CREATE TABLE public.google_calendar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  user_email TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own calendar tokens" 
ON public.google_calendar_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar tokens" 
ON public.google_calendar_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar tokens" 
ON public.google_calendar_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar tokens" 
ON public.google_calendar_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_google_calendar_tokens_updated_at
BEFORE UPDATE ON public.google_calendar_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();