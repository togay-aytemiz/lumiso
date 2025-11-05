import { createContext, useContext } from "react";

export type RetryFn = () => Promise<void> | void;

export interface ConnectivityContextValue {
  isOffline: boolean;
  isRetrying: boolean;
  reportNetworkError: (error?: unknown) => void;
  reportRecovery: () => void;
  registerRetry: (key: string, fn: RetryFn) => () => void;
  runRetryAll: () => Promise<void>;
}

export const ConnectivityContext = createContext<
  ConnectivityContextValue | undefined
>(undefined);

export const useConnectivity = (): ConnectivityContextValue => {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error(
      "useConnectivity must be used within a ConnectivityProvider"
    );
  }
  return ctx;
};
