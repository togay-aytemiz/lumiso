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
  clearOrganizationCache();
  jest.clearAllMocks();
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
    mockSupabase.fromMock.mockImplementationOnce(() => orgResponse.chain);

    await expect(getUserOrganizationId()).resolves.toBe("org-1");
    expect(mockSupabase.fromMock).toHaveBeenCalledTimes(1);

    mockSupabase.fromMock.mockClear();
    dateNowSpy.mockReturnValue(MOCK_NOW + 60_000);

    await expect(getUserOrganizationId()).resolves.toBe("org-1");
    expect(mockSupabase.fromMock).not.toHaveBeenCalled();
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

    mockSupabase.fromMock
      .mockImplementationOnce(() => selectChain.chain)
      .mockImplementationOnce(() => insertChain.chain);

    mockSupabase.rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(getUserOrganizationId()).resolves.toBe("org-123");
    expect(mockSupabase.rpcMock).toHaveBeenCalledTimes(6);
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
