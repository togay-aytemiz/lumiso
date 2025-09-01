-- Remove the duplicate assignment notification triggers that are causing 4 emails
DROP TRIGGER IF EXISTS trigger_lead_assignment_notification ON public.leads;
DROP TRIGGER IF EXISTS trigger_project_assignment_notification ON public.projects;

-- Also drop the old functions if they exist
DROP FUNCTION IF EXISTS public.trigger_lead_assignment_notification();
DROP FUNCTION IF EXISTS public.trigger_project_assignment_notification();