import {
  fetchOrganizationSettingsWithCache,
  setOrganizationSettingsCache,
  getOrganizationSettingsFromCache,
  clearOrganizationSettingsCache,
} from "../organizationSettingsCache";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

const { supabase: supabaseMock } = jest.requireMock("@/integrations/supabase/client") as {
  supabase: {
    auth: { getUser: jest.Mock };
    rpc: jest.Mock;
    from: jest.Mock;
  };
};

const setupLocalStorage = () => {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((key: string) => (key in store ? store[key] : null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
    },
    configurable: true,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  setupLocalStorage();
  clearOrganizationSettingsCache("org-1");
  supabaseMock.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "user@example.com" } },
    error: null,
  });
  supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
});

describe("organizationSettingsCache", () => {
  it("returns cached settings from memory", () => {
    const cachedSettings = { id: "settings-1" };
    setOrganizationSettingsCache("org-1", cachedSettings);

    const result = getOrganizationSettingsFromCache("org-1");
    expect(result).toEqual(cachedSettings);
  });

  it("reads settings from localStorage when memory empty", () => {
    const entry = { data: { id: "settings-2" }, cachedAt: Date.now() };
    window.localStorage.setItem("lumiso:organization_settings:org-1", JSON.stringify(entry));

    const result = getOrganizationSettingsFromCache("org-1");
    expect(result).toEqual(entry.data);
  });

  it("fetches from Supabase when cache cold", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "organization_settings") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: { id: "settings-3" }, error: null })),
            })),
          })),
        };
      }
      if (table === "user_settings") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
          update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
        };
      }
      return {};
    });

    const result = await fetchOrganizationSettingsWithCache("org-1");
    expect(result).toEqual({ id: "settings-3" });
    expect(getOrganizationSettingsFromCache("org-1")).toEqual({ id: "settings-3" });
  });

  it("dedupes inflight Supabase requests", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "organization_settings") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: { id: "settings-4" }, error: null })),
            })),
          })),
        };
      }
      return {};
    });

    const firstPromise = fetchOrganizationSettingsWithCache("org-1", { force: true });
    const secondPromise = fetchOrganizationSettingsWithCache("org-1", { force: true });

    await Promise.all([firstPromise, secondPromise]);

    const organizationCalls = supabaseMock.from.mock.calls.filter(([table]) => table === "organization_settings");
    expect(organizationCalls.length).toBe(1);
  });

  it("returns cached data without hitting Supabase when fresh", async () => {
    setOrganizationSettingsCache("org-1", { id: "settings-5" });

    const result = await fetchOrganizationSettingsWithCache("org-1");
    expect(result).toEqual({ id: "settings-5" });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("returns cached null without hitting Supabase when fresh", async () => {
    setOrganizationSettingsCache("org-1", null);

    const result = await fetchOrganizationSettingsWithCache("org-1");
    expect(result).toBeNull();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
