import { renderHook, act, waitFor } from "@testing-library/react";
import {
  OrganizationProvider,
  useOrganization,
} from "../OrganizationContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

jest.mock("@/hooks/use-toast", () => {
  const toast = jest.fn();
  return {
    useToast: () => ({ toast }),
    __esModule: true,
    toastMock: toast,
  };
});

const { toastMock } = jest.requireMock("@/hooks/use-toast") as {
  toastMock: jest.Mock;
};

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/lib/dateFormatUtils", () => ({
  detectBrowserTimezone: jest.fn(() => "Europe/Istanbul"),
}));

jest.mock("@/lib/organizationSettingsCache", () => ({
  fetchOrganizationSettingsWithCache: jest.fn(),
  ORGANIZATION_SETTINGS_CACHE_TTL: 60_000,
}));

jest.mock("@/integrations/supabase/client", () => {
  const auth = {
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(),
  };

  return {
    supabase: {
      auth,
      from: jest.fn(),
      rpc: jest.fn(),
    },
  };
});

const mockGetUserOrganizationId =
  getUserOrganizationId as jest.MockedFunction<typeof getUserOrganizationId>;
const mockSupabaseFrom = supabase.from as jest.Mock;
const mockSupabaseAuthGetUser = supabase.auth.getUser as jest.Mock;
const mockSupabaseAuthOnChange = supabase.auth.onAuthStateChange as jest.Mock;

const createOrganizationChain = () => {
  const chain = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue({
    data: { id: "org-1", name: "Primary Org", owner_id: "user-1" },
    error: null,
  });

  return chain;
};

const createGenericChain = () => {
  const chain = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(Promise.resolve({ data: [], error: null }));
  chain.single.mockResolvedValue({ data: null, error: null });

  return chain;
};

const createUpdateChain = () => ({
  eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
});

const renderWithProviders = () => {
  const queryClient = new QueryClient();
  jest
    .spyOn(queryClient, "prefetchQuery")
    .mockImplementation(() => Promise.resolve());

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>{children}</OrganizationProvider>
    </QueryClientProvider>
  );

  const hook = renderHook(() => useOrganization(), { wrapper });

  return { hook, queryClient };
};

describe("OrganizationContext", () => {
  beforeEach(() => {
    mockGetUserOrganizationId.mockResolvedValue("org-1");
    mockSupabaseAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    type AuthChangeCallback = (event: unknown, session: unknown) => void;
    mockSupabaseAuthOnChange.mockImplementation((_callback: AuthChangeCallback) => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "organizations") {
        return createOrganizationChain();
      }
      if (table === "user_settings") {
        return { update: jest.fn(() => createUpdateChain()) };
      }
      return createGenericChain();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("initializes organization data from Supabase", async () => {
    const { hook } = renderWithProviders();

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.activeOrganizationId).toBe("org-1");
    expect(hook.result.current.activeOrganization).toMatchObject({
      name: "Primary Org",
    });
  });

  it("dedupes inflight organization detail fetches", async () => {
    mockGetUserOrganizationId.mockResolvedValue("org-inflight");

    let resolveSingle:
      | ((value: { data: { id: string; name: string; owner_id: string; membership_status: string }; error: null }) => void)
      | null = null;
    const singlePromise = new Promise<{
      data: { id: string; name: string; owner_id: string; membership_status: string };
      error: null;
    }>((resolve) => {
      resolveSingle = resolve;
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "organizations") {
        const chain = {
          select: jest.fn(),
          eq: jest.fn(),
          single: jest.fn(),
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        chain.single.mockReturnValue(singlePromise);
        return chain;
      }
      if (table === "user_settings") {
        return { update: jest.fn(() => createUpdateChain()) };
      }
      return createGenericChain();
    });

    const { hook } = renderWithProviders();

    await waitFor(() => {
      const organizationCalls = mockSupabaseFrom.mock.calls.filter(
        ([table]) => table === "organizations"
      );
      expect(organizationCalls.length).toBe(1);
    });

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = hook.result.current.refreshOrganization();
    });

    const organizationCallsAfterRefresh = mockSupabaseFrom.mock.calls.filter(
      ([table]) => table === "organizations"
    );
    expect(organizationCallsAfterRefresh.length).toBe(1);

    resolveSingle?.({
      data: {
        id: "org-inflight",
        name: "Primary Org",
        owner_id: "user-1",
        membership_status: "trial",
      },
      error: null,
    });

    await act(async () => {
      await refreshPromise;
    });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.activeOrganizationId).toBe("org-inflight");
  });

  it("refreshes organization data and triggers toast on manual switch", async () => {
    const toastMock =
      (await import("@/hooks/use-toast")).toastMock as jest.Mock;
    const { hook } = renderWithProviders();

    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await act(async () => {
      await hook.result.current.setActiveOrganization("org-99");
    });

    expect(mockGetUserOrganizationId).toHaveBeenCalledTimes(2);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Organization data refreshed",
    });
  });

  it("throws when hook is used outside provider", () => {
    expect(() => renderHook(() => useOrganization())).toThrow(
      "useOrganization must be used within an OrganizationProvider"
    );
  });
});
