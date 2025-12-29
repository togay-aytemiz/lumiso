import { getUserOrganizationId, clearOrganizationCache } from "./organizationUtils";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/integrations/supabase/client", () => {
  const getUser = jest.fn();
  const fromMock = jest.fn();
  const rpcMock = jest.fn();
  return {
    supabase: {
      auth: {
        getUser,
      },
      from: fromMock,
      rpc: rpcMock,
      __mock: {
        getUser,
        fromMock,
        rpcMock,
      },
    },
  };
});

const mockSupabase = (supabase as unknown as {
  __mock: {
    getUser: jest.Mock;
    fromMock: jest.Mock;
    rpcMock: jest.Mock;
  };
}).__mock;

const MOCK_NOW = 1_715_773_200_000; // 2024-05-15T12:00:00Z
let dateNowSpy: jest.SpyInstance<number, []>;
let consoleLogSpy: jest.SpyInstance<void, [message?: unknown, ...optionalParams: unknown[]]>;
let consoleWarnSpy: jest.SpyInstance<void, [message?: unknown, ...optionalParams: unknown[]]>;
let consoleErrorSpy: jest.SpyInstance<void, [message?: unknown, ...optionalParams: unknown[]]>;

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
      key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
      get length() {
        return Object.keys(store).length;
      },
    },
    configurable: true,
  });
};

const createSelectChain = (result: { data: unknown; error: unknown }) => {
  const single = jest.fn().mockResolvedValue(result);
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single,
  };
  return { chain, single };
};

const createInsertChain = (result: { data: unknown; error: unknown }) => {
  const single = jest.fn().mockResolvedValue(result);
  const chain = {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single,
      }),
    }),
  };
  return { chain, single };
};

const createMembershipSelectChain = (result: { data: unknown; error: unknown }) => {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle,
  };
  return { chain, maybeSingle };
};

beforeAll(() => {
  dateNowSpy = jest.spyOn(Date, "now").mockImplementation(() => MOCK_NOW);
  consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  dateNowSpy.mockRestore();
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  setupLocalStorage();
  clearOrganizationCache();
});

afterEach(() => {
  dateNowSpy.mockReturnValue(MOCK_NOW);
});

describe("getUserOrganizationId", () => {
  it("returns cached organization without hitting Supabase when cache valid", async () => {
    mockSupabase.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const orgResponse = createSelectChain({
      data: { id: "org-1" },
      error: null,
    });
    const membershipResponse = createMembershipSelectChain({
      data: { id: "member-1", status: "active", role: "Owner", system_role: "Owner" },
      error: null,
    });
    mockSupabase.fromMock.mockImplementation((table: string) => {
      if (table === "organizations") {
        return orgResponse.chain;
      }
      if (table === "organization_members") {
        return membershipResponse.chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(getUserOrganizationId()).resolves.toBe("org-1");
    expect(mockSupabase.fromMock).toHaveBeenCalledWith("organizations");

    mockSupabase.fromMock.mockClear();
    dateNowSpy.mockReturnValue(MOCK_NOW + 60_000);

    await expect(getUserOrganizationId()).resolves.toBe("org-1");
    expect(mockSupabase.fromMock).toHaveBeenCalledTimes(1);
    expect(mockSupabase.fromMock).toHaveBeenCalledWith("organization_members");
  });

  it("uses stored organization id from localStorage when available", async () => {
    mockSupabase.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const membershipResponse = createMembershipSelectChain({
      data: { id: "member-1", status: "active", role: "Owner", system_role: "Owner" },
      error: null,
    });
    mockSupabase.fromMock.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return membershipResponse.chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    window.localStorage.setItem(
      "lumiso:organization_id:user-1",
      JSON.stringify({
        userId: "user-1",
        orgId: "org-local",
        cachedAt: MOCK_NOW,
      })
    );

    await expect(getUserOrganizationId()).resolves.toBe("org-local");
    expect(mockSupabase.fromMock).toHaveBeenCalledTimes(1);
    expect(mockSupabase.fromMock).toHaveBeenCalledWith("organization_members");
  });

  it("clears cache when user is not authenticated", async () => {
    mockSupabase.getUser.mockResolvedValue({ data: { user: null } });

    await expect(getUserOrganizationId()).resolves.toBeNull();
    await expect(getUserOrganizationId()).resolves.toBeNull();
  });

  it("creates organization when no rows returned", async () => {
    mockSupabase.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const selectChain = createSelectChain({
      data: null,
      error: { code: "PGRST116" },
    });
    const insertChain = createInsertChain({
      data: { id: "org-123" },
      error: null,
    });
    const membershipResponse = createMembershipSelectChain({
      data: { id: "member-1", status: "active", role: "Owner", system_role: "Owner" },
      error: null,
    });

    mockSupabase.fromMock
      .mockImplementationOnce(() => selectChain.chain)
      .mockImplementationOnce(() => insertChain.chain)
      .mockImplementationOnce(() => membershipResponse.chain);

    mockSupabase.rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(getUserOrganizationId()).resolves.toBe("org-123");
    expect(mockSupabase.rpcMock).toHaveBeenCalledTimes(6);
  });

  it("does not reuse cached organization across users", async () => {
    mockSupabase.getUser
      .mockResolvedValueOnce({
        data: { user: { id: "user-1" } },
      })
      .mockResolvedValueOnce({
        data: { user: { id: "user-2" } },
      });

    const orgUser1 = createSelectChain({
      data: { id: "org-1" },
      error: null,
    });
    const orgUser2 = createSelectChain({
      data: { id: "org-2" },
      error: null,
    });
    const membershipResponse = createMembershipSelectChain({
      data: { id: "member-1", status: "active", role: "Owner", system_role: "Owner" },
      error: null,
    });

    mockSupabase.fromMock
      .mockImplementationOnce(() => orgUser1.chain)
      .mockImplementationOnce(() => membershipResponse.chain)
      .mockImplementationOnce(() => orgUser2.chain)
      .mockImplementationOnce(() => membershipResponse.chain);

    await expect(getUserOrganizationId()).resolves.toBe("org-1");
    await expect(getUserOrganizationId()).resolves.toBe("org-2");

    const organizationCalls = mockSupabase.fromMock.mock.calls.filter(
      ([table]) => table === "organizations"
    );
    expect(organizationCalls).toHaveLength(2);
  });

  it("returns null and logs when organization creation fails", async () => {
    mockSupabase.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const selectChain = createSelectChain({
      data: null,
      error: { code: "PGRST116" },
    });
    const insertChain = createInsertChain({
      data: null,
      error: new Error("insert failed"),
    });

    mockSupabase.fromMock
      .mockImplementationOnce(() => selectChain.chain)
      .mockImplementationOnce(() => insertChain.chain);

    await expect(getUserOrganizationId()).resolves.toBeNull();
    expect(mockSupabase.rpcMock).not.toHaveBeenCalled();
  });

  it("returns null when supabase throws unexpected error", async () => {
    mockSupabase.getUser.mockRejectedValue(new Error("network"));

    await expect(getUserOrganizationId()).resolves.toBeNull();
  });
});
