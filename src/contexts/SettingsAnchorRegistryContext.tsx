import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SettingsAnchor } from "@/theme/settingsTokens";

type RegistryValue = {
  anchors: SettingsAnchor[];
  registerAnchor: (anchor: SettingsAnchor) => () => void;
};

const SettingsAnchorRegistryContext =
  createContext<RegistryValue | null>(null);

export function SettingsAnchorRegistryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [anchors, setAnchors] = useState<SettingsAnchor[]>([]);

  const registerAnchor = useCallback((anchor: SettingsAnchor) => {
    if (!anchor.id) {
      return () => undefined;
    }

    setAnchors((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === anchor.id);
      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        if (existing.label === anchor.label) {
          return prev;
        }
        const next = [...prev];
        next[existingIndex] = anchor;
        return next;
      }
      return [...prev, anchor];
    });

    return () => {
      setAnchors((prev) =>
        prev.some((item) => item.id === anchor.id)
          ? prev.filter((item) => item.id !== anchor.id)
          : prev
      );
    };
  }, []);

  const value = useMemo(
    () => ({
      anchors,
      registerAnchor,
    }),
    [anchors, registerAnchor]
  );

  return (
    <SettingsAnchorRegistryContext.Provider value={value}>
      {children}
    </SettingsAnchorRegistryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettingsAnchorRegistry(anchor?: SettingsAnchor | null) {
  const context = useContext(SettingsAnchorRegistryContext);

  useEffect(() => {
    if (!context || !anchor || !anchor.id) {
      return;
    }
    return context.registerAnchor(anchor);
  }, [context, anchor]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRegisteredSettingsAnchors(): SettingsAnchor[] {
  const context = useContext(SettingsAnchorRegistryContext);
  return context?.anchors ?? [];
}
