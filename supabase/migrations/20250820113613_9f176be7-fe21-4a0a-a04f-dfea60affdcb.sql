-- Reset lead statuses to cleaner default set without "Not Interested"
DO $$
DECLARE
  org_id UUID;
  user_uuid UUID;
  leads_count INTEGER;
BEGIN
  -- Get current user and organization
  SELECT auth.uid() INTO user_uuid;
  SELECT get_user_active_organization_id() INTO org_id;
  
  IF org_id IS NULL THEN
    RAISE NOTICE 'No active organization found';
    RETURN;
  END IF;
  
  -- Check if there are any leads in this organization
  SELECT COUNT(*) INTO leads_count 
  FROM leads 
  WHERE organization_id = org_id;
  
  RAISE NOTICE 'Found % leads in organization %', leads_count, org_id;
  
  -- Delete existing lead statuses first
  DELETE FROM lead_statuses 
  WHERE organization_id = org_id;
  
  RAISE NOTICE 'Deleted existing lead statuses for organization %', org_id;
  
  -- Insert clean default lead statuses (without "Not Interested")
  INSERT INTO lead_statuses (user_id, organization_id, name, color, is_system_final, sort_order, is_default, lifecycle, is_system_required) VALUES
    (user_uuid, org_id, 'New', '#A0AEC0', false, 1, true, 'active', true),
    (user_uuid, org_id, 'Contacted', '#4299E1', false, 2, false, 'active', false),
    (user_uuid, org_id, 'Qualified', '#48BB78', false, 3, false, 'active', false),
    (user_uuid, org_id, 'Booked', '#9F7AEA', false, 4, false, 'active', false),
    (user_uuid, org_id, 'Completed', '#22c55e', true, 1000, false, 'completed', false),
    (user_uuid, org_id, 'Lost', '#ef4444', true, 1001, false, 'cancelled', false);
    
  RAISE NOTICE 'Inserted clean default lead statuses for organization %', org_id;
  
  -- If there are existing leads, update them to use the "New" status
  IF leads_count > 0 THEN
    UPDATE leads 
    SET status_id = (
      SELECT id FROM lead_statuses 
      WHERE organization_id = org_id 
      AND name = 'New' 
      LIMIT 1
    ),
    status = 'New'
    WHERE organization_id = org_id;
    
    RAISE NOTICE 'Updated % existing leads to use "New" status', leads_count;
  END IF;
  
END $$;