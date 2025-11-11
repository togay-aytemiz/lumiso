import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useMessagesTranslation } from '@/hooks/useTypedTranslation';

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
  const { t } = useTranslation('pages');
  const { t: tCommon } = useTranslation('common');
  const { t: tMessages } = useMessagesTranslation();
  const { activeOrganization } = useOrganization();

  const loadAssets = useCallback(async () => {
    if (!activeOrganization?.id) {
      setAssets([]);
      setLoading(false);
      return;
    }

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
        title: tCommon('toast.error'),
        description: t('templateBuilder.imageManager.messages.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, toast]);

  useEffect(() => {
    if (open) {
      void loadAssets();
    }
  }, [open, loadAssets]);

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
        title: tCommon('toast.success'),
        description: t('templateBuilder.imageManager.messages.copySuccess'),
      });
    } catch (error) {
      toast({
        title: tCommon('toast.error'),
        description: t('templateBuilder.imageManager.messages.copyError'),
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
        title: tCommon('toast.success'),
        description: t('templateBuilder.imageManager.messages.deleteSuccess'),
      });

      // Refresh the list
      await loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast({
        title: tCommon('toast.error'),
        description: t('templateBuilder.imageManager.messages.deleteError'),
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
        title: tCommon('toast.success'),
        description: t('templateBuilder.imageManager.messages.altSuccess'),
      });
    } catch (error) {
      console.error('Error updating alt text:', error);
      toast({
        title: tCommon('toast.error'),
        description: t('templateBuilder.imageManager.messages.altError'),
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

  const storageUsage = useMemo(
    () => ({
      total_images: assets.length,
      total_storage_bytes: assets.reduce((total, asset) => total + asset.file_size, 0),
    }),
    [assets]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden w-full sm:max-w-[640px] lg:max-w-[50vw] xl:max-w-[720px]">
        <SheetHeader>
          <SheetTitle>{t('templateBuilder.imageManager.title')}</SheetTitle>
          <SheetDescription>
            {t('templateBuilder.imageManager.sheetDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <CompactStorageIndicator usageOverride={storageUsage} isLoadingOverride={loading} />
        </div>

        <div className="flex-1 overflow-y-auto mt-6">
          {loading && assets.length === 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-medium">
                {t('templateBuilder.imageManager.empty.title')}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                {t('templateBuilder.imageManager.empty.description')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-sm transition-shadow hover:shadow-md"
                >
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
                        type="button"
                        onClick={() => copyImageUrl(asset.file_path)}
                        className="h-8 w-8 p-0"
                        aria-label={t('templateBuilder.imageManager.actions.copyUrl')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            type="button"
                            className="h-8 w-8 p-0"
                            aria-label={t('templateBuilder.imageManager.actions.deleteAria')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t('templateBuilder.imageManager.actions.deleteTitle')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {tMessages('confirm.deleteWithName', { name: asset.file_name })} {tMessages('confirm.cannotUndo')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('buttons.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteAsset(asset)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {tCommon('buttons.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
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
                            placeholder={t('templateBuilder.imageManager.actions.altPlaceholder')}
                            className="h-8 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => handleSaveAltText(asset.id)}
                            className="h-8 w-8 p-0"
                            aria-label={t('templateBuilder.imageManager.actions.confirmAlt')}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={handleCancelEditAltText}
                            className="h-8 w-8 p-0"
                            aria-label={t('templateBuilder.imageManager.actions.cancelAlt')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-1">
                          <p className="text-xs text-muted-foreground flex-1 truncate">
                            {t('templateBuilder.imageManager.labels.alt', {
                              text: asset.alt_text || t('templateBuilder.imageManager.messages.noAltText'),
                            })}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => handleEditAltText(asset.id, asset.alt_text || '')}
                            className="h-8 w-8 p-0"
                            aria-label={t('templateBuilder.imageManager.actions.editAlt')}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {onImageSelect && (
                      <Button
                        size="sm"
                        variant="pill"
                        type="button"
                        className="w-full h-9 text-xs justify-center"
                        onClick={() => {
                          onImageSelect(getImageUrl(asset.file_path), asset.alt_text);
                          onOpenChange(false);
                        }}
                      >
                        {t('templateBuilder.imageManager.actions.insert')}
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
