-- Create storage bucket for business logos and assets
INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for business-assets bucket
CREATE POLICY "Organization members can view business assets" ON storage.objects
FOR SELECT USING (
  bucket_id = 'business-assets' 
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
    AND (storage.foldername(name))[1] = om.organization_id::text
  )
);

CREATE POLICY "Organization members can upload business assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'business-assets' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
    AND (storage.foldername(name))[1] = om.organization_id::text
  )
);

CREATE POLICY "Organization members can update their business assets" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'business-assets' 
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
    AND (storage.foldername(name))[1] = om.organization_id::text
  )
);

CREATE POLICY "Organization members can delete their business assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'business-assets' 
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.status = 'active'
    AND (storage.foldername(name))[1] = om.organization_id::text
  )
);