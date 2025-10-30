import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToastActionElement } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';

type ToastOptions = {
  action?: ToastActionElement;
  duration?: number;
  className?: string;
};

/**
 * Hook that provides internationalized toast notifications
 * Uses common.json translations for consistent toast titles
 */
export const useI18nToast = () => {
  const { t } = useTranslation('common');
  
  return {
    success: (description: ReactNode, options?: ToastOptions) => 
      toast({ 
        title: t('toast.success'), 
        description,
        ...options
      }),
    
    error: (description: ReactNode) => 
      toast({ 
        title: t('toast.error'), 
        description, 
        variant: 'destructive' 
      }),
    
    warning: (description: ReactNode) => 
      toast({ 
        title: t('toast.warning'), 
        description 
      }),
    
    info: (description: ReactNode) => 
      toast({ 
        title: t('toast.info'), 
        description 
      })
  };
};
