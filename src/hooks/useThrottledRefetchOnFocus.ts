import { useCallback, useEffect, useRef } from "react";

/**
 * Calls the provided refetch function when the window gains focus or
 * the document becomes visible, but no more than once per `minIntervalMs`.
 *
 * Use this to avoid request storms caused by rapid focus/visibility toggles.
 */
export function useThrottledRefetchOnFocus(
  refetch: () => void | Promise<void>,
  minIntervalMs: number = 30_000
) {
  const lastAtRef = useRef(0);

  const maybeRefetch = useCallback(() => {
    const now = Date.now();
    if (now - lastAtRef.current < minIntervalMs) return;
    lastAtRef.current = now;
    try {
      const result = refetch();
      // Ignore unhandled promise intentionally
      void result;
    } catch {
      // no-op
    }
  }, [minIntervalMs, refetch]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        maybeRefetch();
      }
    };
    const onFocus = () => {
      maybeRefetch();
    };
    // Event listeners removed to prevent auto-refresh on tab switch
    // document.addEventListener("visibilitychange", onVisibility);
    // window.addEventListener("focus", onFocus);
    return () => {
      // document.removeEventListener("visibilitychange", onVisibility);
      // window.removeEventListener("focus", onFocus);
    };
  }, [maybeRefetch]);
}

