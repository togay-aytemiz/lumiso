import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, Loader2 } from 'lucide-react';
import { useConnectivity } from '@/contexts/useConnectivity';
import { useTranslation } from 'react-i18next';

export const OfflineBanner: React.FC = () => {
  const { isOffline, isRetrying, runRetryAll } = useConnectivity();
  const { t } = useTranslation('common');

  if (!isOffline) return null;

  return (
    <div className="flex-shrink-0 px-4 sm:px-6">
      <Alert className="mb-4 border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-50">
        <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-200" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <AlertTitle className="text-amber-900 dark:text-amber-100">
              {t('network.offlineTitle')}
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-100/80">
              {t('network.offlineDescription')}
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-200/80">
                {t('network.offlineHint')}
              </div>
            </AlertDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runRetryAll}
            disabled={isRetrying}
            className="self-start sm:self-center"
          >
            {isRetrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('buttons.tryAgain')}
          </Button>
        </div>
      </Alert>
    </div>
  );
};

export default OfflineBanner;
