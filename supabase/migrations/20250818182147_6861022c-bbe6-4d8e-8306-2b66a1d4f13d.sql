-- Revert notification preferences and working hours back to user-based
-- since these should be personal settings, not organization-wide

-- Working hours should remain personal (users have different schedules)
-- Notification preferences should remain personal 
-- User profiles should remain personal

-- The organization_id columns we added are correct for:
-- - project_types (organization setting)
-- - project_statuses (organization setting) 
-- - lead_statuses (organization setting)
-- - session_statuses (organization setting)
-- - services (organization setting)
-- - packages (organization setting)
-- - sessions (organization setting)

-- Let's also ensure we have proper defaults for organization settings
-- Update any existing user settings to have proper organization structure