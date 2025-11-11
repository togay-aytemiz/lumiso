import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTranslation } from 'react-i18next';

interface StorageUsage {
  total_images: number;
  total_storage_bytes: number;
}

const STORAGE_LIMITS = {
  MAX_IMAGES: 50,
  MAX_STORAGE_BYTES: 50 * 1024 * 1024, // 50MB
};

interface CompactStorageIndicatorProps {
  onManageImages?: () => void;
  usageOverride?: StorageUsage;
  isLoadingOverride?: boolean;
}

export function CompactStorageIndicator({
  onManageImages,
  usageOverride,
  isLoadingOverride,
}: CompactStorageIndicatorProps) {
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({ total_images: 0, total_storage_bytes: 0 });
  const [loading, setLoading] = useState(true);
  const { activeOrganization } = useOrganization();
  const { t } = useTranslation('pages');

  const fetchStorageUsage = useCallback(async () => {
    if (!activeOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('template_image_usage')
        .select('total_images, total_storage_bytes')
        .eq('organization_id', activeOrganization.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching storage usage:', error);
        return;
      }

      setStorageUsage(data || { total_images: 0, total_storage_bytes: 0 });
    } catch (error) {
      console.error('Error fetching storage usage:', error);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    if (usageOverride) {
      return;
    }

    setLoading(true);
    void fetchStorageUsage();
  }, [fetchStorageUsage, usageOverride]);

  const effectiveUsage = usageOverride ?? storageUsage;
  const effectiveLoading = usageOverride ? isLoadingOverride ?? false : loading;

  if (effectiveLoading) {
    return <div className="h-4 w-32 bg-muted animate-pulse rounded" />;
  }

  const imageProgress = (effectiveUsage.total_images / STORAGE_LIMITS.MAX_IMAGES) * 100;
  const storageProgress = (effectiveUsage.total_storage_bytes / STORAGE_LIMITS.MAX_STORAGE_BYTES) * 100;
  const isNearLimit = imageProgress > 80 || storageProgress > 80;
  const isAtLimit = imageProgress >= 100 || storageProgress >= 100;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t('templateBuilder.imageManager.storage.usage', {
                count: effectiveUsage.total_images,
                max: STORAGE_LIMITS.MAX_IMAGES,
              })}
            </span>
            {isAtLimit && <AlertTriangle className="h-3 w-3 text-destructive" />}
            {isNearLimit && !isAtLimit && <AlertTriangle className="h-3 w-3 text-warning" />}
          </div>
          <div className="flex items-center gap-2">
            <Progress value={Math.min(imageProgress, 100)} className="w-20 h-1" />
            <span className="text-xs text-muted-foreground">
              {t('templateBuilder.imageManager.storage.size', {
                used: formatFileSize(effectiveUsage.total_storage_bytes),
                limit: formatFileSize(STORAGE_LIMITS.MAX_STORAGE_BYTES),
              })}
            </span>
          </div>
        </div>
      </div>

      {onManageImages && (
        <Button variant="ghost" size="sm" onClick={onManageImages} className="text-xs">
          {t('templateBuilder.imageManager.storage.manage')}
        </Button>
      )}

      {isAtLimit && (
        <Badge variant="destructive" className="text-xs">
          {t('templateBuilder.imageManager.storage.limitReached')}
        </Badge>
      )}
      {isNearLimit && !isAtLimit && (
        <Badge variant="secondary" className="text-xs">
          {t('templateBuilder.imageManager.storage.nearLimit')}
        </Badge>
      )}
    </div>
  );
}
