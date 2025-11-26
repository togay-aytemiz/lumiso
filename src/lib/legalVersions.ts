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

/**
 * Fetches legal version metadata from the marketing site and caches it
 * in-memory for the lifetime of the page.
 */
export const getLegalVersions = async (): Promise<LegalVersionsMap> => {
  if (cachedVersions) {
    return cachedVersions;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetch(LEGAL_VERSIONS_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch legal versions: ${response.status}`);
      }

      return response.json() as Promise<LegalVersionsMap>;
    })
    .then((data) => {
      cachedVersions = data;
      return data;
    })
    .catch((error) => {
      console.error("Unable to load legal versions", error);
      throw error;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
};

// For tests or explicit cache resets if needed.
export const __resetLegalVersionsCache = () => {
  cachedVersions = null;
  pendingRequest = null;
};
