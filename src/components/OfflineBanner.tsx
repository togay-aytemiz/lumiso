import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, Loader2 } from 'lucide-react';
import { useConnectivity } from '@/contexts/useConnectivity';
import { useTranslation } from 'react-i18next';

export const OfflineBanner: React.FC = () => {
  const { isOffline, isRetrying, runRetryAll, issueCause } = useConnectivity();
  const { t } = useTranslation('common');

  if (!isOffline) return null;

  const cause = issueCause ?? 'network';
  const titleKey = cause === 'service' ? 'network.serviceIssueTitle' : 'network.offlineTitle';
  const descriptionKey =
    cause === 'service' ? 'network.serviceIssueDescription' : 'network.offlineDescription';
  const hintKey = cause === 'service' ? 'network.serviceIssueHint' : 'network.offlineHint';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 sm:px-6 pt-6 pointer-events-none">
        <Alert className="pointer-events-auto max-w-2xl w-full border-amber-500/50 bg-amber-50 text-amber-900 shadow-xl dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-50">
        <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-200" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <AlertTitle className="text-amber-900 dark:text-amber-100">
              {t(titleKey)}
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-100/80">
              {t(descriptionKey)}
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-200/80">
                {t(hintKey)}
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
    </>
  );
};

export default OfflineBanner;
