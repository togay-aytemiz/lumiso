import { useState, useEffect, useCallback, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { STORAGE_LIMITS, type StorageUsage } from './storageLimits';

interface TemplateAsset {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

export function StorageQuotaDisplay() {
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const { activeOrganization } = useOrganization();
  const { toast } = useToast();
  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const fetchStorageUsage = useCallback(async () => {
    if (!activeOrganization?.id) return;

    try {
      const { data: usage } = await supabase
        .from('template_image_usage')
        .select('total_images, total_storage_bytes')
        .eq('organization_id', activeOrganization.id)
        .single();

      if (!isMountedRef.current) return;
      setStorageUsage(usage || { total_images: 0, total_storage_bytes: 0 });
    } catch (error: unknown) {
      console.error('Error fetching storage usage:', error);
      if (isMountedRef.current) {
        setStorageUsage({ total_images: 0, total_storage_bytes: 0 });
      }
    }
  }, [activeOrganization?.id]);

  const fetchAssets = useCallback(async () => {
    if (!activeOrganization?.id) return;

    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      const { data: assetList } = await supabase
        .from('template_assets')
        .select('id, file_name, file_path, file_size, created_at')
        .eq('organization_id', activeOrganization.id)
        .order('created_at', { ascending: false });

      if (isMountedRef.current) {
        setAssets(assetList || []);
      }
    } catch (error: unknown) {
      console.error('Error fetching assets:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeOrganization?.id]);

  const deleteAsset = async (asset: TemplateAsset) => {
    try {
      // Delete from storage
      await supabase.storage
        .from('template-images')
        .remove([asset.file_path]);

      // Delete from database (this will trigger the usage update)
      await supabase
        .from('template_assets')
        .delete()
        .eq('id', asset.id);

      // Refresh data
      await fetchStorageUsage();
      await fetchAssets();

      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
    } catch (error: unknown) {
      console.error('Error deleting asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      void fetchStorageUsage();
      void fetchAssets();
    }
  }, [activeOrganization?.id, fetchAssets, fetchStorageUsage]);

  if (loading || !storageUsage) {
    return (
      <div className="p-4 bg-muted rounded-lg">
        <div className="text-sm text-muted-foreground">Loading storage info...</div>
      </div>
    );
  }

  const storagePercentage = (storageUsage.total_storage_bytes / STORAGE_LIMITS.MAX_STORAGE_BYTES) * 100;
  const imagesPercentage = (storageUsage.total_images / STORAGE_LIMITS.MAX_IMAGES) * 100;
  const storageInMB = storageUsage.total_storage_bytes / (1024 * 1024);

  const isStorageNearLimit = storagePercentage > 80;
  const isImagesNearLimit = imagesPercentage > 80;
  const isStorageAtLimit = storagePercentage >= 100;
  const isImagesAtLimit = imagesPercentage >= 100;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Storage Usage</h3>
          <Dialog open={isImageLibraryOpen} onOpenChange={setIsImageLibraryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <ImageIcon className="w-4 h-4 mr-2" />
                Manage Images
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Image Library</DialogTitle>
                <DialogDescription>
                  Manage your uploaded template images
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh] space-y-3">
                {assets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No images uploaded yet
                  </div>
                ) : (
                  assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{asset.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(asset.file_size / 1024).toFixed(1)} KB • {new Date(asset.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAsset(asset)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Images ({storageUsage.total_images}/{STORAGE_LIMITS.MAX_IMAGES})</span>
              {(isImagesNearLimit || isImagesAtLimit) && (
                <Badge variant={isImagesAtLimit ? "destructive" : "secondary"} className="text-xs">
                  {isImagesAtLimit ? <AlertTriangle className="w-3 h-3 mr-1" /> : null}
                  {isImagesAtLimit ? 'Limit Reached' : 'Near Limit'}
                </Badge>
              )}
            </div>
            <Progress value={imagesPercentage} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Storage ({storageInMB.toFixed(1)}/50 MB)</span>
              {(isStorageNearLimit || isStorageAtLimit) && (
                <Badge variant={isStorageAtLimit ? "destructive" : "secondary"} className="text-xs">
                  {isStorageAtLimit ? <AlertTriangle className="w-3 h-3 mr-1" /> : null}
                  {isStorageAtLimit ? 'Limit Reached' : 'Near Limit'}
                </Badge>
              )}
            </div>
            <Progress value={storagePercentage} className="h-2" />
          </div>
        </div>

        {(isStorageAtLimit || isImagesAtLimit) && (
          <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Upload limit reached. Delete some images to free up space.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StorageQuotaDisplay;
