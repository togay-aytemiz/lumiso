import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type RetryFn = () => Promise<void> | void;

interface ConnectivityContextValue {
  isOffline: boolean;
  isRetrying: boolean;
  reportNetworkError: (error?: unknown) => void;
  reportRecovery: () => void;
  registerRetry: (key: string, fn: RetryFn) => () => void;
  runRetryAll: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return !navigator.onLine;
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCallbacksRef = useRef<Map<string, RetryFn>>(new Map());

  // Window online/offline listeners keep our state accurate even if no requests are made
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const reportNetworkError = useCallback((_error?: unknown) => {
    setIsOffline(true);
  }, []);

  const reportRecovery = useCallback(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      setIsOffline(false);
    }
  }, []);

  const registerRetry = useCallback((key: string, fn: RetryFn) => {
    retryCallbacksRef.current.set(key, fn);
    return () => {
      retryCallbacksRef.current.delete(key);
    };
  }, []);

  const runRetryAll = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const fns = Array.from(retryCallbacksRef.current.values());
      for (const fn of fns) {
        try {
          await fn();
        } catch (err) {
          // Intentionally swallow individual errors here
          // Offline banner will remain if we are still offline
          // and pages can surface context-specific errors/toasts.
          // eslint-disable-next-line no-console
          console.error('Retry action failed', err);
        }
      }
      // If device is online and retries did not throw hard, clear offline
      if (typeof navigator === 'undefined' || navigator.onLine) {
        setIsOffline(false);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying]);

  const value = useMemo<ConnectivityContextValue>(() => ({
    isOffline,
    isRetrying,
    reportNetworkError,
    reportRecovery,
    registerRetry,
    runRetryAll,
  }), [isOffline, isRetrying, registerRetry, reportNetworkError, reportRecovery, runRetryAll]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = (): ConnectivityContextValue => {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity must be used within a ConnectivityProvider');
  return ctx;
};

