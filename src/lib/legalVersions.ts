export type LegalDocumentId =
  | "terms"
  | "privacy"
  | "kvkk"
  | "cookie-policy"
  | "communication-consent"
  | "dpa";

export type LegalVersionInfo = {
  version: string;
  last_updated: string;
};

export type LegalVersionsMap = Record<LegalDocumentId | string, LegalVersionInfo>;

const LEGAL_VERSIONS_URL = "https://www.lumiso.app/legal_versions.json";

let cachedVersions: LegalVersionsMap | null = null;
let pendingRequest: Promise<LegalVersionsMap> | null = null;
let lastFetchedAt: number | null = null;
const MAX_CACHE_AGE_MS = 1000 * 60 * 30; // 30 minutes

/**
 * Fetches legal version metadata from the marketing site and caches it
 * in-memory for a short period. Pass forceRefresh to always pull the
 * latest copy (bypasses cache and adds a cache-buster).
 */
export const getLegalVersions = async (
  options?: { forceRefresh?: boolean; timeoutMs?: number }
): Promise<LegalVersionsMap> => {
  const { forceRefresh = false, timeoutMs = 8000 } = options || {};
  const now = Date.now();
  const cacheFresh =
    cachedVersions && lastFetchedAt
      ? now - lastFetchedAt < MAX_CACHE_AGE_MS
      : false;

  if (cachedVersions && cacheFresh && !forceRefresh) {
    return cachedVersions;
  }

  if (pendingRequest && !forceRefresh) {
    return pendingRequest;
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `${LEGAL_VERSIONS_URL}?ts=${now}`;
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch legal versions: ${response.status}`);
      }

      const data = (await response.json()) as LegalVersionsMap;
      cachedVersions = data;
      lastFetchedAt = now;
      return data;
    } finally {
      clearTimeout(timer);
      pendingRequest = null;
    }
  })();

  pendingRequest = fetchPromise;

  return fetchPromise;
};

// For tests or explicit cache resets if needed.
export const __resetLegalVersionsCache = () => {
  cachedVersions = null;
  pendingRequest = null;
  lastFetchedAt = null;
};
