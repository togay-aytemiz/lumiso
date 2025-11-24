import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConnectivityContext, type ConnectivityContextValue, type ConnectivityIssueCause, type RetryFn } from './connectivityShared';

interface ConnectivityProviderProps {
  children: ReactNode;
}

export function ConnectivityProvider({ children }: ConnectivityProviderProps) {
  // Default to online; rely on real network errors or offline events to flip state.
  // navigator.onLine can be unreliable on some platforms at startup.
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [issueCause, setIssueCause] = useState<ConnectivityIssueCause | null>(null);
  const retryCallbacksRef = useRef<Map<string, RetryFn>>(new Map());

  const deriveCause = useCallback((cause?: ConnectivityIssueCause): ConnectivityIssueCause => {
    if (cause) return cause;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
    return 'service';
  }, []);

  // Window online/offline listeners keep our state accurate even if no requests are made
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIssueCause(null);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setIssueCause('network');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const reportNetworkError = useCallback((_error?: unknown, cause?: ConnectivityIssueCause) => {
    setIsOffline(true);
    setIssueCause(deriveCause(cause));
  }, [deriveCause]);

  const reportRecovery = useCallback(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      setIsOffline(false);
      setIssueCause(null);
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
          console.error('Retry action failed', err);
        }
      }
      // If device is online and retries did not throw hard, clear offline
      if (typeof navigator === 'undefined' || navigator.onLine) {
        setIsOffline(false);
        setIssueCause(null);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying]);

  const value = useMemo<ConnectivityContextValue>(() => ({
    isOffline,
    isRetrying,
    issueCause,
    reportNetworkError,
    reportRecovery,
    registerRetry,
    runRetryAll,
  }), [isOffline, isRetrying, issueCause, registerRetry, reportNetworkError, reportRecovery, runRetryAll]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export default ConnectivityProvider;
