const FEATURE_FLAG_PREFIX = "VITE_FEATURE_";

const toEnvKey = (flag: string) => {
  const normalized = flag.replace(/[^a-z0-9]/gi, "_").toUpperCase();
  return `${FEATURE_FLAG_PREFIX}${normalized}`;
};

const resolveEnv = (): Record<string, string | undefined> => {
  // Accessing import.meta breaks under Jest (CommonJS). Eval keeps bundlers happy.
  try {
    const meta = (0, eval)("import.meta");
    if (meta && typeof meta === "object" && "env" in meta) {
      return (meta as Record<string, unknown>).env as Record<string, string | undefined>;
    }
  } catch {
    // ignore, fall back to process.env below
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string | undefined>;
  }

  return {};
};

export const isFeatureEnabled = (flag: string, defaultValue = false): boolean => {
  const key = toEnvKey(flag);
  const env = resolveEnv();
  const raw = env[key];

  if (raw === "true") return true;
  if (raw === "false") return false;

  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(`flag:${flag}`);
      if (override === "true") return true;
      if (override === "false") return false;
    } catch (error) {
      console.warn("Feature flag localStorage lookup failed", error);
    }
  }

  return defaultValue;
};

export const FEATURE_FLAGS = {
  sessionWizardV1: "session_wizard_v1",
  settingsModalOverlayV1: "settings_modal_overlay_v1",
  galleryBulkDownload: "gallery_bulk_download",
} as const;
