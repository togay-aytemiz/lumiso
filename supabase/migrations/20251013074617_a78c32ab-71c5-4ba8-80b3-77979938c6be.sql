-- Phase 2: Add multi-select support to lead field definitions
ALTER TABLE lead_field_definitions 
ADD COLUMN IF NOT EXISTS allow_multiple boolean DEFAULT false;

COMMENT ON COLUMN lead_field_definitions.allow_multiple IS 
'Whether this select field allows multiple selections. Only applicable when field_type = select. Values stored as comma-separated strings.';