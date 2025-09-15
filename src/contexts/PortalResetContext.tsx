import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface PortalResetContextValue {
  resetKey: number;
  reset: () => void;
}

const PortalResetContext = createContext<PortalResetContextValue | undefined>(undefined);

export function PortalResetProvider({ children }: { children: React.ReactNode }) {
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => setResetKey((k) => k + 1), []);
  const value = useMemo(() => ({ resetKey, reset }), [resetKey, reset]);
  return <PortalResetContext.Provider value={value}>{children}</PortalResetContext.Provider>;
}

export function usePortalReset(): PortalResetContextValue {
  const ctx = useContext(PortalResetContext);
  return ctx ?? { resetKey: 0, reset: () => {} };
}
