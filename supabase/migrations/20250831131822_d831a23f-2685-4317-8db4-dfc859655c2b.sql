-- Create storage bucket policy for template-images to allow users to upload
INSERT INTO storage.buckets (id, name, public) VALUES ('template-images', 'template-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for template-images bucket
CREATE POLICY "Users can view template images in their organization" ON storage.objects
FOR SELECT USING (
  bucket_id = 'template-images' 
  AND EXISTS (
    SELECT 1 FROM template_assets ta 
    WHERE ta.file_path = name 
    AND ta.organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY "Users can upload template images to their organization" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'template-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their organization's template images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'template-images' 
  AND EXISTS (
    SELECT 1 FROM template_assets ta 
    WHERE ta.file_path = name 
    AND ta.organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY "Users can delete their organization's template images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'template-images' 
  AND EXISTS (
    SELECT 1 FROM template_assets ta 
    WHERE ta.file_path = name 
    AND ta.organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);