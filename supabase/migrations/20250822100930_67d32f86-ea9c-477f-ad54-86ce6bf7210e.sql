-- Run migration to populate custom field values for existing leads
-- This will extract data from the standard lead columns and populate the new custom field system
SELECT public.initialize_all_organization_field_definitions();