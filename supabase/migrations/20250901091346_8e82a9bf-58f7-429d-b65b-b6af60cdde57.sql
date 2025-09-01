-- Add more sessions and reminders for September and October 2025
-- First, let's add sessions for September 2025
INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-09-02'::date,
  '10:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Golden Gate Park, San Francisco',
  'Engagement session in the rose garden'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Sarah Johnson'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-09-05'::date,
  '14:30'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Client home - Beverly Hills',
  'Newborn session with props and family photos'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Emily Davis'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-09-12'::date,
  '16:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Malibu Beach',
  'Beach maternity session at sunset'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Lisa Thompson'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-09-18'::date,
  '11:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Central Park, New York',
  'Family portrait session with autumn colors'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Robert Wilson'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-09-22'::date,
  '09:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'The Ritz-Carlton, Half Moon Bay',
  'Wedding ceremony and reception coverage'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Amanda Brown'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-09-28'::date,
  '15:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Downtown LA Studio',
  'Corporate headshots for executive team'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Jennifer Martinez'
LIMIT 1;

-- October 2025 sessions
INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-10-03'::date,
  '13:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Griffith Observatory',
  'Engagement session with city skyline backdrop'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'David Garcia'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-10-08'::date,
  '10:30'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Balboa Park, San Diego',
  'Family reunion photography'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Karen Anderson'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-10-15'::date,
  '14:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Client home - Manhattan Beach',
  'Baby milestone session - 6 months'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Christopher Lee'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-10-20'::date,
  '12:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Santa Monica Pier',
  'Fun couple session with carnival backdrop'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Michelle Taylor'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-10-25'::date,
  '16:30'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Beverly Hills Hotel',
  'Wedding reception and dancing coverage'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Steven Clark'
LIMIT 1;

INSERT INTO public.sessions (user_id, lead_id, session_date, session_time, status, project_id, organization_id, location, notes)
SELECT 
  l.user_id,
  l.id as lead_id,
  '2025-10-30'::date,
  '11:00'::time,
  'planned'::session_status,
  p.id as project_id,
  l.organization_id,
  'Huntington Gardens, Pasadena',
  'Halloween-themed family portraits'
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Nancy Lewis'
LIMIT 1;

-- Add reminders for September 2025
INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Call to confirm engagement session details and discuss outfit suggestions',
  '2025-09-01 09:00:00'::timestamptz,
  '09:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Sarah Johnson'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Send newborn session preparation guide and props list',
  '2025-09-03 10:30:00'::timestamptz,
  '10:30'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Emily Davis'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Check weather forecast for beach maternity session',
  '2025-09-10 15:00:00'::timestamptz,
  '15:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Lisa Thompson'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Prepare family portrait shot list and location permits',
  '2025-09-16 14:00:00'::timestamptz,
  '14:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Robert Wilson'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Final wedding timeline review and vendor coordination call',
  '2025-09-20 16:00:00'::timestamptz,
  '16:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Amanda Brown'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Send corporate headshot style guide and wardrobe recommendations',
  '2025-09-26 11:00:00'::timestamptz,
  '11:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Jennifer Martinez'
LIMIT 1;

-- Add reminders for October 2025
INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Scout Griffith Observatory location and check sunset timing',
  '2025-10-01 12:00:00'::timestamptz,
  '12:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'David Garcia'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Confirm family reunion attendee list and group photo arrangements',
  '2025-10-06 13:30:00'::timestamptz,
  '13:30'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Karen Anderson'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Prepare milestone props and toys for 6-month baby session',
  '2025-10-13 09:30:00'::timestamptz,
  '09:30'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Christopher Lee'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Check Santa Monica Pier operating hours and crowd levels',
  '2025-10-18 15:30:00'::timestamptz,
  '15:30'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Michelle Taylor'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Coordinate with wedding DJ for reception photo timing',
  '2025-10-23 14:00:00'::timestamptz,
  '14:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Steven Clark'
LIMIT 1;

INSERT INTO public.activities (user_id, lead_id, type, content, reminder_date, reminder_time, project_id, organization_id)
SELECT 
  l.user_id,
  l.id as lead_id,
  'reminder',
  'Source Halloween costume props for themed family session',
  '2025-10-28 10:00:00'::timestamptz,
  '10:00'::time,
  p.id as project_id,
  l.organization_id
FROM public.leads l
JOIN public.projects p ON l.id = p.lead_id
WHERE l.name = 'Nancy Lewis'
LIMIT 1;