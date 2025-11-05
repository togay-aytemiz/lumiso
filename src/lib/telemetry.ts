type TelemetryPayload = Record<string, unknown> | undefined;

type AnalyticsWindow = Window & {
  analytics?: {
    track?: (eventName: string, payload?: Record<string, unknown>) => void;
  };
  gtag?: (command: string, eventName: string, payload?: Record<string, unknown>) => void;
};

export const trackEvent = (eventName: string, payload?: TelemetryPayload) => {
  try {
    if (typeof window !== "undefined") {
      const analyticsWindow = window as AnalyticsWindow;
      const analytics = analyticsWindow.analytics;
      if (analytics && typeof analytics.track === "function") {
        analytics.track(eventName, payload ?? {});
        return;
      }

      const gtag = analyticsWindow.gtag;
      if (typeof gtag === "function") {
        gtag("event", eventName, payload ?? {});
        return;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug(`[telemetry] ${eventName}`, payload);
    }
  } catch (error) {
    console.error("Telemetry tracking failed", error);
  }
};
