export type EnvRecord = Record<string, string | undefined>;

export const resolveEnv = (): EnvRecord => {
  // Accessing import.meta breaks under Jest (CommonJS). Eval keeps bundlers happy.
  try {
    const meta = (0, eval)("import.meta") as { env?: EnvRecord } | undefined;
    if (meta && typeof meta === "object" && "env" in meta) {
      return meta.env ?? {};
    }
  } catch {
    // ignore, fall back to process.env below
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env as EnvRecord;
  }

  return {};
};

export const getEnvValue = (key: string, fallback?: string): string | undefined => {
  const env = resolveEnv();
  const value = env[key];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
};
