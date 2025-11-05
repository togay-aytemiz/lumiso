import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { checkStorageLimits } from './storageLimits';

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string, altText?: string) => void;
  templateId?: string;
  className?: string;
}

export function ImageUpload({ onImageUploaded, templateId, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();

  const uploadImage = async (file: File) => {
    if (!user?.id || !activeOrganization?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to upload images',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      // Check storage limits first
      const { data: currentUsage } = await supabase
        .from('template_image_usage')
        .select('total_images, total_storage_bytes')
        .eq('organization_id', activeOrganization.id)
        .single();

      const usage = currentUsage || { total_images: 0, total_storage_bytes: 0 };
      const { canUpload, reason } = checkStorageLimits(usage, file.size);

      if (!canUpload) {
        toast({
          title: 'Upload Limit Reached',
          description: reason,
          variant: 'destructive',
        });
        return;
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `template-images/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('template-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('template-images')
        .getPublicUrl(filePath);

      // Save asset record to database
      const { error: dbError } = await supabase
        .from('template_assets')
        .insert({
          user_id: user.id,
          organization_id: activeOrganization.id,
          template_id: templateId || null,
          file_name: file.name,
          file_path: filePath,
          content_type: file.type,
          file_size: file.size,
          alt_text: file.name.split('.')[0] // Use filename without extension as default alt text
        });

      if (dbError) throw dbError;

      onImageUploaded(publicUrl, file.name.split('.')[0]);

      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    uploadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary/50'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {uploading ? 'Uploading...' : 'Upload an image'}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag and drop or click to browse (max 5MB)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
