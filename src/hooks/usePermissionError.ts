import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PermissionErrorOptions {
  action?: string;
  redirectTo?: string;
}

export function usePermissionError() {
  const { toast } = useToast();

  const handlePermissionError = useCallback((
    error: unknown, 
    options: PermissionErrorOptions = {}
  ) => {
    console.error('Permission Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const { action = 'perform this action', redirectTo } = options;

    // Check for common permission-related error patterns
    const isPermissionError = 
      errorMessage.includes('permission') ||
      errorMessage.includes('access') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('row-level security');

    if (isPermissionError) {
      toast({
        title: "Access Denied",
        description: `You don't have permission to ${action}. Please contact your administrator if you believe this is an error.`,
        variant: "destructive",
      });
    } else {
      // Handle other types of errors
      toast({
        title: "Error",
        description: `Failed to ${action}. Please try again.`,
        variant: "destructive",
      });
    }

    // Optional redirect
    if (redirectTo) {
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 2000);
    }
  }, [toast]);

  const handleAsyncPermissionCheck = useCallback(async (
    permissionCheck: () => Promise<boolean>,
    action: string,
    fallback?: () => void
  ): Promise<boolean> => {
    try {
      const hasPermission = await permissionCheck();
      
      if (!hasPermission) {
        toast({
          title: "Access Denied",
          description: `You don't have permission to ${action}.`,
          variant: "destructive",
        });
        
        if (fallback) {
          fallback();
        }
        
        return false;
      }
      
      return true;
    } catch (error) {
      handlePermissionError(error, { action });
      return false;
    }
  }, [handlePermissionError, toast]);

  return {
    handlePermissionError,
    handleAsyncPermissionCheck
  };
}