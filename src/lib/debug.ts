// Simple developer-only logging helpers for timing and grouping
// Uses Vite's import.meta.env.DEV to avoid noise in production builds

export const DEV: boolean = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;

export type Timer = {
  end: (extra?: Record<string, unknown>) => number; // returns elapsed ms
};

export function startTimer(label: string, meta?: Record<string, unknown>): Timer {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (DEV) {
    try {
      // Use collapsed groups for compact logs
      // eslint-disable-next-line no-console
      console.groupCollapsed(`⏱️ ${label}`);
      if (meta) {
        // eslint-disable-next-line no-console
        console.log('meta', meta);
      }
    } catch {}
  }
  return {
    end: (extra?: Record<string, unknown>) => {
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = Math.round(t1 - t0);
      if (DEV) {
        try {
          if (extra) {
            // eslint-disable-next-line no-console
            console.log('result', extra);
          }
          // eslint-disable-next-line no-console
          console.log('elapsed_ms', elapsed);
          // eslint-disable-next-line no-console
          console.groupEnd();
        } catch {}
      }
      return elapsed;
    },
  };
}

export function logInfo(label: string, data?: Record<string, unknown>) {
  if (!DEV) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`🔎 ${label}`, data || '');
  } catch {}
}

