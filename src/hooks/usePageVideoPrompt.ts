import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export type PageVideoStatus = "not_seen" | "snoozed" | "completed";

export interface PageVideoState {
  status: PageVideoStatus;
  lastPromptedAt?: string | null;
}

export type PageVideosMap = Record<string, PageVideoState>;

interface UsePageVideoPromptOptions {
  pageKey: string;
  snoozeDays?: number;
}

const SESSION_SNOOZE_KEY = (pageKey: string) =>
  `videoPrompt:${pageKey}:snoozedSession`;
const LOCAL_COMPLETED_KEY = (pageKey: string) =>
  `videoPrompt:${pageKey}:completedLocal`;

export function usePageVideoPrompt({ pageKey, snoozeDays = 7 }: UsePageVideoPromptOptions) {
  const { data: preferences, isLoading, updatePreferences } = useUserPreferences();
  const [isOpen, setIsOpen] = useState(false);

  const pageVideoState: PageVideoState = useMemo(() => {
    const status = preferences?.pageVideos?.[pageKey];
    return status ?? { status: "not_seen", lastPromptedAt: null };
  }, [preferences, pageKey]);

  const shouldShow = useMemo(() => {
    const sessionSnoozed =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_SNOOZE_KEY(pageKey)) === "true";
    const localCompleted =
      typeof window !== "undefined" &&
      window.localStorage.getItem(LOCAL_COMPLETED_KEY(pageKey)) === "true";

    if (!preferences || isLoading) return false;
    if (sessionSnoozed) return false;
    if (localCompleted) return false;

    if (pageVideoState.status === "completed") return false;
    if (pageVideoState.status === "not_seen") return true;

    if (pageVideoState.status === "snoozed") {
      if (!pageVideoState.lastPromptedAt) return true;
      const lastPrompted = new Date(pageVideoState.lastPromptedAt).getTime();
      const now = Date.now();
      const msSincePrompt = now - lastPrompted;
      return msSincePrompt > snoozeDays * 24 * 60 * 60 * 1000;
    }

    return false;
  }, [preferences, isLoading, pageVideoState, snoozeDays, pageKey]);

  useEffect(() => {
    if (shouldShow) {
      setIsOpen(true);
    }
  }, [shouldShow]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const markCompleted = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_COMPLETED_KEY(pageKey), "true");
      window.sessionStorage.removeItem(SESSION_SNOOZE_KEY(pageKey));
    }

    if (!preferences) {
      close();
      return;
    }

    const nextPageVideos: PageVideosMap = {
      ...(preferences.pageVideos || {}),
      [pageKey]: { status: "completed", lastPromptedAt: new Date().toISOString() }
    };

    try {
      await updatePreferences({ pageVideos: nextPageVideos });
    } catch (error) {
      console.error("usePageVideoPrompt: failed to mark completed", error);
    } finally {
      close();
    }
  }, [close, pageKey, preferences, updatePreferences]);

  const snooze = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_SNOOZE_KEY(pageKey), "true");
    }

    if (!preferences) {
      close();
      return;
    }

    const nextPageVideos: PageVideosMap = {
      ...(preferences.pageVideos || {}),
      [pageKey]: { status: "snoozed", lastPromptedAt: new Date().toISOString() }
    };

    try {
      await updatePreferences({ pageVideos: nextPageVideos });
    } catch (error) {
      console.error("usePageVideoPrompt: failed to snooze", error);
    } finally {
      close();
    }
  }, [close, pageKey, preferences, updatePreferences]);

  return {
    isOpen,
    shouldShow,
    status: pageVideoState.status,
    open: () => setIsOpen(true),
    close,
    markCompleted,
    snooze
  };
}
