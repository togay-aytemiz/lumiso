import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrganizationSettings } from "../useOrganizationSettings";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchOrganizationSettingsWithCache,
  getOrganizationSettingsFromCache,
  setOrganizationSettingsCache,
  ORGANIZATION_SETTINGS_CACHE_TTL,
} from "@/lib/organizationSettingsCache";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/lib/organizationSettingsCache", () => ({
  fetchOrganizationSettingsWithCache: jest.fn(),
  getOrganizationSettingsFromCache: jest.fn(),
  setOrganizationSettingsCache: jest.fn(),
  ORGANIZATION_SETTINGS_CACHE_TTL: 12345,
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: actual.useQuery,
    useQueryClient: jest.fn().mockImplementation(() => ({
      setQueryData: jest.fn(),
    })),
  };
});

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

const mockedUseOrganization = useOrganization as jest.Mock;
const mockedUseToast = useToast as jest.Mock;
const mockedFetchWithCache = fetchOrganizationSettingsWithCache as jest.Mock;
const mockedGetFromCache = getOrganizationSettingsFromCache as jest.Mock;
const mockedSetCache = setOrganizationSettingsCache as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;
const mockedUseQueryClient = require("@tanstack/react-query").useQueryClient as jest.Mock;
const mockQueryClient = {
  setQueryData: jest.fn(),
};
let consoleErrorSpy: jest.SpyInstance;

const createQueryBuilder = (response: { data: unknown; error: unknown }) => {
  const builder: any = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  return builder;
};


const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderHookWithProviders = () => {
  const { result } = renderHook(() => useOrganizationSettings(), {
    wrapper: createWrapper(),
  });
  return { result };
};

beforeEach(() => {
  mockedUseOrganization.mockReturnValue({
    activeOrganizationId: "org-1",
  });
  mockedUseToast.mockReturnValue({
    toast: jest.fn(),
  });
  mockedGetFromCache.mockReturnValue(null);
  mockedFetchWithCache.mockResolvedValue({
    id: "settings-1",
    organization_id: "org-1",
    logo_url: null,
    social_channels: null,
  });
  mockedGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mockedUseQueryClient.mockReturnValue(mockQueryClient);
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  mockQueryClient.setQueryData.mockReset();
  consoleErrorSpy.mockRestore();
});

describe("useOrganizationSettings", () => {
  it("loads settings and normalizes social channels", async () => {
    const snapshot = {
      id: "settings-1",
      organization_id: "org-1",
      social_channels: {
        instagram: {
          name: "Instagram",
          url: "https://instagram.com",
          platform: "instagram",
          enabled: true,
          order: 1,
        },
      },
    };
    mockedGetFromCache.mockReturnValue(snapshot);
    mockedFetchWithCache.mockResolvedValue(snapshot);

    const { result } = renderHookWithProviders();
    await waitFor(() => result.current.loading === false);
    expect(result.current.settings?.socialChannels?.instagram?.name).toBe("Instagram");
  });

  it("returns null settings when organization missing", async () => {
    mockedUseOrganization.mockReturnValue({
      activeOrganizationId: null,
    });

    const { result } = renderHookWithProviders();
    expect(result.current.settings).toBeNull();
    expect(mockedFetchWithCache).not.toHaveBeenCalled();
  });

  it("updates settings via supabase update when record exists", async () => {
    mockedFetchWithCache.mockResolvedValue({
      id: "settings-1",
      organization_id: "org-1",
    });
    const updatePayloads: unknown[] = [];
    const builder = createQueryBuilder({
      data: { id: "settings-1", organization_id: "org-1", logo_url: "logo.png" },
      error: null,
    });
    (supabase.from as jest.Mock).mockImplementation(() => ({
      update: (payload: unknown) => {
        updatePayloads.push(payload);
        return builder;
      },
      upsert: jest.fn(),
    }));

    const { result } = renderHookWithProviders();
    await waitFor(() => mockedFetchWithCache.mock.calls.length > 0);
    await waitFor(() => result.current.loading === false);
    expect(result.current.settings?.id).toBe("settings-1");

    const response = await result.current.updateSettings({ logo_url: "new-logo.png" });
    expect(builder.eq).toHaveBeenCalledWith("id", "settings-1");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(response.success).toBe(true);
    expect(mockedSetCache).toHaveBeenCalledWith("org-1", { id: "settings-1", organization_id: "org-1", logo_url: "logo.png" });
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(["organization_settings", "org-1"], { id: "settings-1", organization_id: "org-1", logo_url: "logo.png" });
    expect(updatePayloads[0]).toEqual({ logo_url: "new-logo.png" });
  });

  it("upserts settings when record absent", async () => {
    mockedFetchWithCache.mockResolvedValue(null);
    const upsertCalls: Array<[unknown, unknown]> = [];
    const builder = createQueryBuilder({
      data: { id: "settings-2", organization_id: "org-1", logo_url: "logo.png" },
      error: null,
    });
    (supabase.from as jest.Mock).mockImplementation(() => ({
      update: jest.fn(),
      upsert: (payload: unknown, options: unknown) => {
        upsertCalls.push([payload, options]);
        return builder;
      },
    }));

    const { result } = renderHookWithProviders();
    await waitFor(() => mockedFetchWithCache.mock.calls.length > 0);
    await waitFor(() => result.current.loading === false);
    await act(async () => {
      await result.current.updateSettings({ logo_url: "logo.png" });
    });

    expect(upsertCalls[0]).toEqual([
      { organization_id: "org-1", logo_url: "logo.png" },
      { onConflict: "organization_id" },
    ]);
    expect(mockedSetCache).toHaveBeenCalledWith("org-1", { id: "settings-2", organization_id: "org-1", logo_url: "logo.png" });
    expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(["organization_settings", "org-1"], { id: "settings-2", organization_id: "org-1", logo_url: "logo.png" });
  });

  it("handles update failure by toasting error", async () => {
    mockedFetchWithCache.mockResolvedValue({
      id: "settings-1",
      organization_id: "org-1",
    });
    mockedGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const builder = createQueryBuilder({ data: null, error: new Error("update failed") });
    (supabase.from as jest.Mock).mockImplementation(() => ({
      update: () => builder,
      upsert: jest.fn(),
    }));

    const toastSpy = jest.fn();
    mockedUseToast.mockReturnValue({ toast: toastSpy });

    const { result } = renderHookWithProviders();
    await waitFor(() => mockedFetchWithCache.mock.calls.length > 0);
    await waitFor(() => result.current.loading === false);
    await act(async () => {
      const response = await result.current.updateSettings({ logo_url: "logo.png" });
      expect(response.success).toBe(false);
    });
    expect(toastSpy).toHaveBeenCalledWith({
      title: "Error",
      description: "update failed",
      variant: "destructive",
    });
  });
});
