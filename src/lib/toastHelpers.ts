import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

/**
 * Hook that provides internationalized toast notifications
 * Uses common.json translations for consistent toast titles
 */
export const useI18nToast = () => {
  const { t } = useTranslation('common');
  
  return {
    success: (description: string) => 
      toast({ 
        title: t('toast.success'), 
        description 
      }),
    
    error: (description: string) => 
      toast({ 
        title: t('toast.error'), 
        description, 
        variant: 'destructive' 
      }),
    
    warning: (description: string) => 
      toast({ 
        title: t('toast.warning'), 
        description 
      }),
    
    info: (description: string) => 
      toast({ 
        title: t('toast.info'), 
        description 
      })
  };
};
