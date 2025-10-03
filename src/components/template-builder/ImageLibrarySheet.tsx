import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Copy, Trash2, Edit3, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CompactStorageIndicator } from './CompactStorageIndicator';

interface TemplateAsset {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  alt_text?: string;
  created_at: string;
}

interface ImageLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect?: (imageUrl: string, altText?: string) => void;
  templateId?: string;
}

export function ImageLibrarySheet({ open, onOpenChange, onImageSelect, templateId }: ImageLibrarySheetProps) {
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAltText, setEditingAltText] = useState<string | null>(null);
  const [tempAltText, setTempAltText] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
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
    if (open) {
      loadAssets();
    }
  }, [open, activeOrganization?.id]);

  const getImageUrl = (filePath: string) => {
    const { data: { publicUrl } } = supabase.storage
      .from('template-images')
      .getPublicUrl(filePath);
    return publicUrl;
  };

  const copyImageUrl = async (filePath: string) => {
    const imageUrl = getImageUrl(filePath);
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast({
        title: 'Success',
        description: 'Image URL copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL',
        variant: 'destructive',
      });
    }
  };

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

      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });

      // Refresh the list
      loadAssets();
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
        description: 'Alt text updated',
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

  const handleEditAltText = (assetId: string, currentAltText: string) => {
    setEditingAltText(assetId);
    setTempAltText(currentAltText || '');
  };

  const handleSaveAltText = (assetId: string) => {
    updateAltText(assetId, tempAltText);
    setEditingAltText(null);
    setTempAltText('');
  };

  const handleCancelEditAltText = () => {
    setEditingAltText(null);
    setTempAltText('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[700px] overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>Image Library</SheetTitle>
          <SheetDescription>
            Manage your uploaded images. Click on an image to select it for your template.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <CompactStorageIndicator />
        </div>

        <div className="flex-1 overflow-y-auto mt-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No images uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload an image using the image block to see it here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {assets.map((asset) => (
                <div key={asset.id} className="group relative bg-card border rounded-lg overflow-hidden">
                  <div className="aspect-video relative">
                    <img
                      src={getImageUrl(asset.file_path)}
                      alt={asset.alt_text || asset.file_name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => {
                        if (onImageSelect) {
                          onImageSelect(getImageUrl(asset.file_path), asset.alt_text);
                          onOpenChange(false);
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyImageUrl(asset.file_path)}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Image</AlertDialogTitle>
                            <AlertDialogDescription>
                              {tMessages('confirm.deleteWithName', { name: asset.file_name })} {tMessages('confirm.cannotUndo')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteAsset(asset)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{asset.file_name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(asset.file_size)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {editingAltText === asset.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={tempAltText}
                            onChange={(e) => setTempAltText(e.target.value)}
                            placeholder="Alt text"
                            className="h-7 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveAltText(asset.id)}
                            className="h-7 w-7 p-0"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEditAltText}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-1">
                          <p className="text-xs text-muted-foreground flex-1 truncate">
                            Alt: {asset.alt_text || 'No alt text'}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditAltText(asset.id, asset.alt_text || '')}
                            className="h-7 w-7 p-0"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {onImageSelect && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          onImageSelect(getImageUrl(asset.file_path), asset.alt_text);
                          onOpenChange(false);
                        }}
                      >
                        Insert
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}