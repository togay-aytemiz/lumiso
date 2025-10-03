import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Trash2, Edit3, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useMessagesTranslation } from '@/hooks/useTypedTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TemplateAsset {
  id: string;
  file_name: string;
  file_path: string;
  content_type: string;
  file_size: number;
  alt_text: string | null;
  created_at: string;
}

interface ImageManagerProps {
  onImageSelect: (imageUrl: string, altText?: string) => void;
  templateId?: string;
  className?: string;
}

export function ImageManager({ onImageSelect, templateId, className }: ImageManagerProps) {
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAlt, setEditingAlt] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const { toast } = useToast();
  const { t: tMessages } = useMessagesTranslation();
  const { activeOrganization } = useOrganization();

  const loadAssets = async () => {
    if (!activeOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('template_assets')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [activeOrganization?.id]);

  const deleteAsset = async (asset: TemplateAsset) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('template-images')
        .remove([asset.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('template_assets')
        .delete()
        .eq('id', asset.id);

      if (dbError) throw dbError;

      setAssets(prev => prev.filter(a => a.id !== asset.id));
      
      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  const updateAltText = async (assetId: string, newAltText: string) => {
    try {
      const { error } = await supabase
        .from('template_assets')
        .update({ alt_text: newAltText })
        .eq('id', assetId);

      if (error) throw error;

      setAssets(prev => prev.map(asset => 
        asset.id === assetId ? { ...asset, alt_text: newAltText } : asset
      ));

      toast({
        title: 'Success',
        description: 'Alt text updated successfully',
      });
    } catch (error) {
      console.error('Error updating alt text:', error);
      toast({
        title: 'Error',
        description: 'Failed to update alt text',
        variant: 'destructive',
      });
    }
  };

  const getImageUrl = (filePath: string) => {
    const { data: { publicUrl } } = supabase.storage
      .from('template-images')
      .getPublicUrl(filePath);
    return publicUrl;
  };

  const copyImageUrl = (filePath: string) => {
    const url = getImageUrl(filePath);
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied',
      description: 'Image URL copied to clipboard',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          <h3 className="font-medium">Loading images...</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5" />
        <h3 className="font-medium">Image Library ({assets.length})</h3>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No images uploaded yet</p>
          <p className="text-sm">Upload your first image to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative bg-card border rounded-lg overflow-hidden">
              <div className="aspect-square relative">
                <img
                  src={getImageUrl(asset.file_path)}
                  alt={asset.alt_text || asset.file_name}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => onImageSelect(getImageUrl(asset.file_path), asset.alt_text || undefined)}
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onImageSelect(getImageUrl(asset.file_path), asset.alt_text || undefined)}
                  >
                    Insert
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyImageUrl(asset.file_path)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Image</AlertDialogTitle>
                        <AlertDialogDescription>
                          {tMessages('confirm.deleteImage')} {tMessages('confirm.cannotUndo')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAsset(asset)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Image info */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{asset.file_name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingAlt(asset.id);
                      setAltText(asset.alt_text || '');
                    }}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
                
                {editingAlt === asset.id ? (
                  <div className="flex gap-1">
                    <Input
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Alt text"
                      className="text-xs h-7"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateAltText(asset.id, altText);
                          setEditingAlt(null);
                        }
                        if (e.key === 'Escape') {
                          setEditingAlt(null);
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        updateAltText(asset.id, altText);
                        setEditingAlt(null);
                      }}
                      className="h-7 px-2"
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">
                    {asset.alt_text || 'No alt text'}
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(asset.file_size)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}