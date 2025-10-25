jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  keepPreviousData: Symbol("keepPreviousData"),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

import { keepPreviousData } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useOrganizationData,
  usePackages,
  useSessionTypes,
  useProjectStatuses,
} from "../useOrganizationData";

const reactQueryModule = jest.requireMock("@tanstack/react-query") as {
  useQuery: jest.Mock;
  keepPreviousData: symbol;
};

const useQueryMock = reactQueryModule.useQuery;

type UseOrganizationMock = jest.MockedFunction<typeof useOrganization>;

const useOrganizationMock = useOrganization as UseOrganizationMock;
const supabaseFromMock = supabase.from as jest.Mock;
const supabaseRpcMock = supabase.rpc as jest.Mock;
const supabaseGetUserMock = supabase.auth.getUser as jest.Mock;

function createQueryBuilder<T>(
  result: { data: T; error: unknown },
  resolveOnOrderCall = 1
) {
  let orderCalls = 0;
  const builder: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockImplementation((..._args: unknown[]) => {
    orderCalls += 1;
    if (orderCalls >= resolveOnOrderCall) {
      return Promise.resolve(result);
    }
    return builder;
  });

  return builder;
}

beforeEach(() => {
  useQueryMock.mockReset();
  useOrganizationMock.mockReset();
  supabaseFromMock.mockReset();
  supabaseRpcMock.mockReset();
  supabaseGetUserMock.mockReset();

  supabaseRpcMock.mockResolvedValue({ data: null, error: null });
  supabaseGetUserMock.mockResolvedValue({ data: { user: null }, error: null });
  useOrganizationMock.mockReturnValue({
    activeOrganizationId: "org-default",
    loading: false,
  } as unknown as ReturnType<typeof useOrganization>);
});

describe("useOrganizationData", () => {
  it("disables queries while the organization context is loading", () => {
    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-123",
      loading: true,
    } as unknown as ReturnType<typeof useOrganization>);

    useQueryMock.mockReturnValue({ data: null });

    useOrganizationData(["projects"], jest.fn());

    const config = useQueryMock.mock.calls[0]?.[0];
    expect(config).toBeDefined();
    expect(config!.enabled).toBe(false);
  });

  it("throws a descriptive error when queryFn runs without an active organization", () => {
    useOrganizationMock.mockReturnValue({
      activeOrganizationId: null,
      loading: false,
    } as unknown as ReturnType<typeof useOrganization>);

    const queryFn = jest.fn();
    let capturedConfig: Parameters<typeof useQueryMock>[0] | undefined;

    useQueryMock.mockImplementation((options) => {
      capturedConfig = options;
      return { data: null };
    });

    useOrganizationData(["leads"], queryFn);

    expect(capturedConfig).toBeDefined();
    expect(() => capturedConfig!.queryFn()).toThrow("No active organization");
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("appends the organization id to the query key and forwards options", async () => {
    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-42",
      loading: false,
    } as unknown as ReturnType<typeof useOrganization>);

    const customQuery = jest.fn().mockResolvedValue("result-value");
    let config: Parameters<typeof useQueryMock>[0] | undefined;

    useQueryMock.mockImplementation((options) => {
      config = options;
      return { data: null };
    });

    useOrganizationData(["leads"], customQuery, {
      staleTime: 123,
      gcTime: 456,
      enabled: true,
    });

    expect(config?.queryKey).toEqual(["leads", "org-42"]);
    expect(config?.staleTime).toBe(123);
    expect(config?.gcTime).toBe(456);
    expect(config?.enabled).toBe(true);

    expect(config).toBeDefined();
    await expect(config!.queryFn()).resolves.toBe("result-value");
    expect(customQuery).toHaveBeenCalledWith("org-42");
  });
});

describe("usePackages", () => {
  it("ensures default packages before returning results", async () => {
    const packages = [{ id: "pkg-1" }];
    const builder = createQueryBuilder({ data: packages, error: null });

    supabaseFromMock.mockReturnValueOnce(builder);
    supabaseGetUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-9" } },
      error: null,
    });

    let config: Parameters<typeof useQueryMock>[0] | undefined;
    useQueryMock.mockImplementation((options) => {
      config = options;
      return { data: packages };
    });

    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-77",
      loading: false,
    } as unknown as ReturnType<typeof useOrganization>);

    usePackages();

    expect(config).toBeDefined();
    expect(config!.queryKey).toEqual(["packages", "org-77"]);
    expect(config!.enabled).toBe(true);

    await expect(config!.queryFn()).resolves.toEqual(packages);

    expect(supabaseGetUserMock).toHaveBeenCalled();
    expect(supabaseRpcMock).toHaveBeenCalledWith(
      "ensure_default_packages_for_org",
      {
        user_uuid: "user-9",
        org_id: "org-77",
      }
    );
    expect(supabaseFromMock).toHaveBeenCalledWith("packages");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.eq).toHaveBeenCalledWith("organization_id", "org-77");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("short-circuits when no authenticated user is available", async () => {
    let config: Parameters<typeof useQueryMock>[0] | undefined;

    useQueryMock.mockImplementation((options) => {
      config = options;
      return { data: [] };
    });

    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-88",
      loading: false,
    } as unknown as ReturnType<typeof useOrganization>);

    supabaseGetUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    usePackages();

    expect(config).toBeDefined();
    await expect(config!.queryFn()).resolves.toEqual([]);
    expect(supabaseRpcMock).not.toHaveBeenCalled();
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });
});

describe("useSessionTypes", () => {
  it("ensures default session types and sorts results", async () => {
    const sessionTypes = [{ id: "s-1" }];
    const builder = createQueryBuilder(
      { data: sessionTypes, error: null },
      2
    );

    supabaseFromMock.mockReturnValueOnce(builder);
    supabaseGetUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-11" } },
      error: null,
    });

    let config: Parameters<typeof useQueryMock>[0] | undefined;
    useQueryMock.mockImplementation((options) => {
      config = options;
      return { data: sessionTypes };
    });

    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-55",
      loading: false,
    } as unknown as ReturnType<typeof useOrganization>);

    useSessionTypes();

    expect(config).toBeDefined();
    expect(config!.queryKey).toEqual(["session_types", "org-55"]);
    await expect(config!.queryFn()).resolves.toEqual(sessionTypes);

    expect(supabaseRpcMock).toHaveBeenCalledWith(
      "ensure_default_session_types_for_org",
      {
        user_uuid: "user-11",
        org_id: "org-55",
      }
    );
    expect(builder.order.mock.calls).toEqual([
      ["sort_order", { ascending: true }],
      ["name", { ascending: true }],
    ]);
  });
});

describe("useProjectStatuses", () => {
  it("uses keepPreviousData as placeholder while keeping org scoping", () => {
    const builder = createQueryBuilder({ data: [], error: null });
    supabaseFromMock.mockReturnValueOnce(builder);

    let config: Parameters<typeof useQueryMock>[0] | undefined;
    useQueryMock.mockImplementation((options) => {
      config = options;
      return { data: [] };
    });

    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-91",
      loading: false,
    } as unknown as ReturnType<typeof useOrganization>);

    useProjectStatuses();

    expect(config).toBeDefined();
    expect(config!.queryKey).toEqual(["project_statuses", "org-91"]);
    expect(config!.placeholderData).toBe(keepPreviousData);
    expect(config!.enabled).toBe(true);
  });
});
