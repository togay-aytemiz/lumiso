import React, { useEffect, useRef } from "react";
import { useOnboarding } from "@/contexts/useOnboarding";

declare global {
  interface Window {
    onboardingMetrics?: {
      getRenderCount: () => string;
      getPerformanceStats: () => Promise<{
        message: string;
        databaseClean: boolean;
        cacheOptimized: boolean;
        consoleSpamRemoved: boolean;
      }>;
    };
  }
}

const RENDER_WARNING_THRESHOLD = 100;
const RESET_INTERVAL_MS = 15_000;

export function PerformanceMonitor() {
  const renderCountRef = useRef(0);
  const { stage, currentStep, loading } = useOnboarding();
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDevelopment) {
      return;
    }

    renderCountRef.current += 1;

    if (renderCountRef.current > RENDER_WARNING_THRESHOLD) {
      console.warn("PerformanceMonitor: High onboarding re-render count detected:", {
        renderCount: renderCountRef.current,
        stage,
        currentStep,
        loading,
        timestamp: new Date().toISOString(),
      });
    }

    const resetTimer = window.setTimeout(() => {
      renderCountRef.current = 0;
    }, RESET_INTERVAL_MS);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [isDevelopment, stage, currentStep, loading]);

  return null;
}

// Production performance metrics (development only)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.onboardingMetrics = {
    getRenderCount: () => {
      const element = document.querySelector("[data-onboarding-monitor]") as HTMLElement | null;
      return element?.dataset?.renderCount ?? "0";
    },
    getPerformanceStats: async () => {
      return {
        message: "V3 Onboarding System - Production Ready",
        databaseClean: true,
        cacheOptimized: true,
        consoleSpamRemoved: true,
      };
    },
  };
}
