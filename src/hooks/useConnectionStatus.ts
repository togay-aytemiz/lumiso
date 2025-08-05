import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      // Simple query to test connection
      const { error } = await supabase
        .from('leads')
        .select('id')
        .limit(1);
      
      setIsConnected(!error);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();

    // Set up periodic checks every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsConnected(true);
      checkConnection();
    };
    
    const handleOffline = () => {
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isConnected,
    isChecking,
    lastChecked,
    checkConnection
  };
};