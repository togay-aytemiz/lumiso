type TelemetryPayload = Record<string, unknown> | undefined;

export const trackEvent = (eventName: string, payload?: TelemetryPayload) => {
  try {
    if (typeof window !== "undefined") {
      const analytics = (window as any).analytics;
      if (analytics && typeof analytics.track === "function") {
        analytics.track(eventName, payload ?? {});
        return;
      }

      const gtag = (window as any).gtag;
      if (typeof gtag === "function") {
        gtag("event", eventName, payload ?? {});
        return;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(`[telemetry] ${eventName}`, payload);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Telemetry tracking failed", error);
  }
};
