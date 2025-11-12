import { supabase } from "@/integrations/supabase/client";

export interface OrganizationTaxProfile {
  legalEntityType: "individual" | "company" | "freelance";
  companyName: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  billingAddress: string | null;
  defaultVatRate: number;
  defaultVatMode: "inclusive" | "exclusive";
  pricesIncludeVat: boolean;
  vatExempt: boolean;
}

export interface CachedOrganizationSettings {
  id?: string;
  organization_id?: string;
  photography_business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  primary_brand_color?: string | null;
  date_format?: string | null;
  time_format?: string | null;
  timezone?: string | null;
  preferred_project_types?: string[] | null;
  service_focus?: string[] | null;
  profile_intake_completed_at?: string | null;
  seed_sample_data_onboarding?: boolean;
  preferred_locale?: string | null;
  social_channels?: Record<string, unknown> | null;
  tax_profile?: OrganizationTaxProfile | null;
  [key: string]: unknown;
}

export const DEFAULT_ORGANIZATION_TAX_PROFILE: OrganizationTaxProfile = {
  legalEntityType: "freelance",
  companyName: null,
  taxOffice: null,
  taxNumber: null,
  billingAddress: null,
  defaultVatRate: 0,
  defaultVatMode: "exclusive",
  pricesIncludeVat: false,
  vatExempt: true,
};

interface CacheEntry {
  data: CachedOrganizationSettings | null;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_PREFIX = "lumiso:organization_settings:";

const memoryCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<CachedOrganizationSettings | null>>();

const now = () => Date.now();

const readFromStorage = (organizationId: string): CacheEntry | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${organizationId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeToStorage = (organizationId: string, entry: CacheEntry) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${organizationId}`,
      JSON.stringify(entry)
    );
  } catch {
    // Ignore storage failures (e.g., quota exceeded, private mode)
  }
};

export const getOrganizationSettingsFromCache = (
  organizationId: string,
  ttl: number = CACHE_TTL_MS
): CachedOrganizationSettings | null => {
  const existing = memoryCache.get(organizationId);
  const expiresAt = now() - ttl;

  if (existing && existing.cachedAt >= expiresAt) {
    return existing.data;
  }

  const stored = readFromStorage(organizationId);
  if (stored && stored.cachedAt >= expiresAt) {
    memoryCache.set(organizationId, stored);
    return stored.data;
  }

  return null;
};

export const setOrganizationSettingsCache = (
  organizationId: string,
  data: CachedOrganizationSettings | null
) => {
  const entry: CacheEntry = { data, cachedAt: now() };
  memoryCache.set(organizationId, entry);
  writeToStorage(organizationId, entry);
};

const fetchOrganizationSettingsFromSupabase = async (
  organizationId: string,
  detectedTimezone?: string,
  detectedHourFormat?: "12-hour" | "24-hour",
  detectedLocale?: string
): Promise<CachedOrganizationSettings | null> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("User not authenticated");

  const { data: existingSettings, error: fetchError } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existingSettings) {
    return existingSettings as CachedOrganizationSettings;
  }

  const rpcPayload: Record<string, unknown> = { org_id: organizationId };
  if (detectedTimezone) {
    rpcPayload.detected_timezone = detectedTimezone;
  }
  if (detectedHourFormat) {
    rpcPayload.detected_time_format = detectedHourFormat;
  }
  if (detectedLocale) {
    rpcPayload.detected_locale = detectedLocale;
  }

  await supabase.rpc("ensure_organization_settings", rpcPayload);

  if (user.email) {
    await supabase
      .from("organization_settings")
      .update({ email: user.email })
      .eq("organization_id", organizationId);
  }

  const { data: ensuredSettings, error: ensuredError } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (ensuredError) throw ensuredError;
  if (ensuredSettings) {
    return ensuredSettings as CachedOrganizationSettings;
  }

  const { data: userSettings } = await supabase
    .from("user_settings")
    .select(
      "photography_business_name, logo_url, primary_brand_color, date_format"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (userSettings) {
    return {
      organization_id: organizationId,
      social_channels: {},
      preferred_project_types: [],
      service_focus: [],
      profile_intake_completed_at: null,
      seed_sample_data_onboarding: false,
      preferred_locale: "tr",
      ...userSettings,
    } as CachedOrganizationSettings;
  }

  return null;
};

interface FetchOptions {
  force?: boolean;
  ttl?: number;
  detectedTimezone?: string;
  detectedHourFormat?: "12-hour" | "24-hour";
  detectedLocale?: string;
}

export const fetchOrganizationSettingsWithCache = async (
  organizationId: string,
  options: FetchOptions = {}
): Promise<CachedOrganizationSettings | null> => {
  const ttl = options.ttl ?? CACHE_TTL_MS;

  if (!options.force) {
    const cached = getOrganizationSettingsFromCache(organizationId, ttl);
    if (cached !== null) {
      return cached;
    }
  }

  if (inflightRequests.has(organizationId)) {
    return inflightRequests.get(organizationId)!;
  }

  const requestPromise = fetchOrganizationSettingsFromSupabase(
    organizationId,
    options.detectedTimezone,
    options.detectedHourFormat,
    options.detectedLocale
  )
    .then((data) => {
      setOrganizationSettingsCache(organizationId, data);
      return data;
    })
    .finally(() => {
      inflightRequests.delete(organizationId);
    });

  inflightRequests.set(organizationId, requestPromise);
  return requestPromise;
};

export const clearOrganizationSettingsCache = (organizationId: string) => {
  memoryCache.delete(organizationId);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${organizationId}`);
    } catch {
      // ignore storage errors
    }
  }
};

export const ORGANIZATION_SETTINGS_CACHE_TTL = CACHE_TTL_MS;
