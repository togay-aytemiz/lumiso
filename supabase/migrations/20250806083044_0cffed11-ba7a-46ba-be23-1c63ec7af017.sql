-- Create trigger to update updated_at column
CREATE TRIGGER update_lead_statuses_updated_at
BEFORE UPDATE ON public.lead_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();