import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/integrations/supabase/client", () => {
  const from = jest.fn();
  return {
    supabase: {
      from,
      rpc: jest.fn(),
      auth: {
        getUser: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
      },
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import type {
  Payment,
  PaymentStatusFilter,
  PaymentTypeFilter,
  SortDirection,
  SortField,
} from "../../types";
import { PROJECT_SELECT_FIELDS } from "../../constants";
import { usePaymentsData } from "../usePaymentsData";

const supabaseFromMock = supabase.from as jest.Mock;

type QueryResult = {
  data: unknown;
  error: unknown;
  count?: number | null;
};

type QueryBuilder<T extends QueryResult> = PromiseLike<T> & {
  select: jest.Mock<QueryBuilder<T>, [string?]>;
  ilike: jest.Mock<QueryBuilder<T>, [string, string]>;
  in: jest.Mock<QueryBuilder<T>, [string, unknown[]]>;
  or: jest.Mock<QueryBuilder<T>, [string]>;
  gte: jest.Mock<QueryBuilder<T>, [string, unknown]>;
  lte: jest.Mock<QueryBuilder<T>, [string, unknown]>;
  order: jest.Mock<QueryBuilder<T>, [string, { ascending?: boolean }?]>;
  range: jest.Mock<QueryBuilder<T>, [number, number]>;
  eq: jest.Mock<QueryBuilder<T>, [string, unknown]>;
  catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  [Symbol.toStringTag]: string;
};

const createQueryBuilder = <T extends QueryResult>(result: T): QueryBuilder<T> => {
  const builder = {
    select: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    in: jest.fn(() => builder),
    or: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    [Symbol.toStringTag]: "Promise" as const,
  } satisfies QueryBuilder<T>;

  return builder;
};

type QueueMap = Record<"payments" | "projects" | "leads", QueryBuilder<QueryResult>[]>;

describe("usePaymentsData", () => {
  const baseProps = {
    page: 1,
    pageSize: 2,
    sortField: "project_name" as SortField,
    sortDirection: "asc" as SortDirection,
    statusFilters: [] as PaymentStatusFilter[],
    typeFilters: [] as PaymentTypeFilter[],
    amountMinFilter: null,
    amountMaxFilter: null,
    searchTerm: "",
    activeDateRange: null,
  };

  let queues: QueueMap;
  let onError: jest.Mock;

  const enqueue = (table: keyof QueueMap, builder: QueryBuilder<QueryResult>) => {
    queues[table].push(builder);
    return builder;
  };

  beforeEach(() => {
    queues = {
      payments: [],
      projects: [],
      leads: [],
    };
    onError = jest.fn();
    supabaseFromMock.mockReset();
    supabaseFromMock.mockImplementation((table: string) => {
      const key = table as keyof QueueMap;
      const queue = queues[key];
      if (!queue?.length) {
        throw new Error(`No mock registered for table ${table}`);
      }
      return queue.shift()!;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("fetches payments, hydrates related entities, and appends subsequent pages", async () => {
    const tablePayments: Payment[] = [
      {
        id: "payment-b",
        amount: 220,
        date_paid: "2024-04-10T00:00:00Z",
        status: "paid",
        description: "Second",
        type: "manual",
        project_id: "project-b",
        created_at: "2024-04-01T00:00:00Z",
        projects: null,
      },
      {
        id: "payment-a",
        amount: 120,
        date_paid: "2024-04-08T00:00:00Z",
        status: "due",
        description: "First",
        type: "balance_due",
        project_id: "project-a",
        created_at: "2024-03-01T00:00:00Z",
        projects: null,
      },
    ];

    const metricsPayments: Payment[] = [
      {
        id: "metric-1",
        amount: 220,
        date_paid: "2024-04-10T00:00:00Z",
        status: "paid",
        description: null,
        type: "manual",
        project_id: "project-b",
        created_at: "2024-04-01T00:00:00Z",
        projects: null,
      },
    ];

    const projectsResult = [
      {
        id: "project-a",
        name: "Alpha Project",
        base_price: 100,
        lead_id: "lead-a",
        status_id: null,
        previous_status_id: null,
        project_type_id: null,
        description: null,
        updated_at: "2024-03-05T00:00:00Z",
        created_at: "2024-02-01T00:00:00Z",
        user_id: "user-a",
      },
      {
        id: "project-b",
        name: "Beta Project",
        base_price: 200,
        lead_id: "lead-b",
        status_id: null,
        previous_status_id: null,
        project_type_id: null,
        description: null,
        updated_at: "2024-04-09T00:00:00Z",
        created_at: "2024-02-15T00:00:00Z",
        user_id: "user-b",
      },
    ];

    const leadsResult = [
      { id: "lead-a", name: "Alice" },
      { id: "lead-b", name: "Bob" },
    ];

    const tableBuilder = enqueue(
      "payments",
      createQueryBuilder({ data: tablePayments, error: null, count: 2 })
    );
    const metricsBuilder = enqueue(
      "payments",
      createQueryBuilder({ data: metricsPayments, error: null })
    );
    const hydrationProjectsBuilder = enqueue(
      "projects",
      createQueryBuilder({ data: projectsResult, error: null })
    );
    const hydrationLeadsBuilder = enqueue(
      "leads",
      createQueryBuilder({ data: leadsResult, error: null })
    );

    const { result, rerender } = renderHook(
      (props: typeof baseProps & { onError: (error: Error) => void }) =>
        usePaymentsData(props),
      {
        initialProps: { ...baseProps, onError },
      }
    );

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    await waitFor(() => expect(result.current.tableLoading).toBe(false));

    expect(result.current.totalCount).toBe(2);
    expect(result.current.metricsPayments).toEqual(metricsPayments);
    expect(result.current.paginatedPayments.map((payment) => payment.projects?.name)).toEqual([
      "Alpha Project",
      "Beta Project",
    ]);
    expect(result.current.paginatedPayments[0]?.projects?.leads?.name).toBe("Alice");
    expect(result.current.paginatedPayments[1]?.projects?.leads?.name).toBe("Bob");

    expect(tableBuilder.select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(tableBuilder.range).toHaveBeenCalledWith(0, 1);
    expect(tableBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(metricsBuilder.select).toHaveBeenCalledWith(
      "id, amount, status, type, date_paid, created_at, project_id"
    );
    expect(hydrationProjectsBuilder.select).toHaveBeenCalledWith(PROJECT_SELECT_FIELDS);
    expect(hydrationProjectsBuilder.in).toHaveBeenCalledWith("id", [
      "project-b",
      "project-a",
    ]);
    expect(hydrationLeadsBuilder.select).toHaveBeenCalledWith("id, name");
    expect(hydrationLeadsBuilder.in).toHaveBeenCalledWith("id", ["lead-a", "lead-b"]);

    const nextPayments: Payment[] = [
      {
        id: "payment-c",
        amount: 320,
        date_paid: "2024-04-12T00:00:00Z",
        status: "paid",
        description: "Third",
        type: "manual",
        project_id: "project-c",
        created_at: "2024-04-11T00:00:00Z",
        projects: null,
      },
    ];

    const nextMetrics: Payment[] = [
      {
        id: "metric-2",
        amount: 320,
        date_paid: "2024-04-12T00:00:00Z",
        status: "paid",
        description: null,
        type: "manual",
        project_id: "project-c",
        created_at: "2024-04-11T00:00:00Z",
        projects: null,
      },
    ];

    const nextTableBuilder = enqueue(
      "payments",
      createQueryBuilder({ data: nextPayments, error: null, count: 3 })
    );
    const nextMetricsBuilder = enqueue(
      "payments",
      createQueryBuilder({ data: nextMetrics, error: null })
    );
    enqueue(
      "projects",
      createQueryBuilder({
        data: [
          {
            id: "project-c",
            name: "Delta Project",
            base_price: 300,
            lead_id: "lead-c",
            status_id: null,
            previous_status_id: null,
            project_type_id: null,
            description: null,
            updated_at: "2024-04-12T00:00:00Z",
            created_at: "2024-04-10T00:00:00Z",
            user_id: "user-c",
          },
        ],
        error: null,
      })
    );
    enqueue(
      "leads",
      createQueryBuilder({ data: [{ id: "lead-c", name: "Charlie" }], error: null })
    );

    rerender({ ...baseProps, page: 2, onError });

    await waitFor(() => expect(result.current.tableLoading).toBe(false));
    await waitFor(() => expect(result.current.paginatedPayments).toHaveLength(1));

    expect(result.current.paginatedPayments[0]?.projects?.name).toBe("Delta Project");
    expect(result.current.paginatedPayments[0]?.projects?.leads?.name).toBe("Charlie");
    expect(result.current.totalCount).toBe(3);
    expect(result.current.metricsPayments).toEqual(nextMetrics);
    expect(nextMetricsBuilder.select).toHaveBeenCalledWith(
      "id, amount, status, type, date_paid, created_at, project_id"
    );
    expect(nextTableBuilder.range).toHaveBeenCalledWith(2, 3);
    expect(queues.payments).toHaveLength(0);
  });

  it("applies search, type, and amount filters when fetching data", async () => {
    const searchProjectsBuilder = enqueue(
      "projects",
      createQueryBuilder({
        data: [
          {
            id: "project-30",
            name: "Omega",
            base_price: 100,
            lead_id: "lead-30",
            status_id: null,
            previous_status_id: null,
            project_type_id: null,
            description: null,
            updated_at: "2024-03-01T00:00:00Z",
            created_at: "2024-02-01T00:00:00Z",
            user_id: "user-30",
          },
          {
            id: "project-40",
            name: "Sigma",
            base_price: 120,
            lead_id: "lead-40",
            status_id: null,
            previous_status_id: null,
            project_type_id: null,
            description: null,
            updated_at: "2024-03-02T00:00:00Z",
            created_at: "2024-02-02T00:00:00Z",
            user_id: "user-40",
          },
        ],
        error: null,
      })
    );
    const searchLeadsBuilder = enqueue(
      "leads",
      createQueryBuilder({
        data: [
          { id: "lead-30", name: "Olive" },
          { id: "lead-40", name: "Orion" },
        ],
        error: null,
      })
    );
    const projectsForLeadsBuilder = enqueue(
      "projects",
      createQueryBuilder({
        data: [
          {
            id: "project-50",
            name: "Tau",
            base_price: 200,
            lead_id: "lead-50",
            status_id: null,
            previous_status_id: null,
            project_type_id: null,
            description: null,
            updated_at: "2024-03-03T00:00:00Z",
            created_at: "2024-02-03T00:00:00Z",
            user_id: "user-50",
          },
        ],
        error: null,
      })
    );
    const hydrationSearchLeadsBuilder = enqueue(
      "leads",
      createQueryBuilder({
        data: [{ id: "lead-50", name: "Tessa" }],
        error: null,
      })
    );

    const tableBuilder = enqueue(
      "payments",
      createQueryBuilder({
        data: [
          {
            id: "payment-newer",
            amount: 400,
            date_paid: "2024-05-05T00:00:00Z",
            status: "paid",
            description: "Newest",
            type: "manual",
            project_id: "project-40",
            created_at: "2024-05-01T00:00:00Z",
            projects: null,
          },
          {
            id: "payment-older",
            amount: 80,
            date_paid: "2024-04-01T00:00:00Z",
            status: "paid",
            description: "Older",
            type: "manual",
            project_id: "project-30",
            created_at: "2024-03-01T00:00:00Z",
            projects: null,
          },
        ],
        error: null,
        count: 2,
      })
    );

    const metricsBuilder = enqueue(
      "payments",
      createQueryBuilder({
        data: [
          {
            id: "payment-metric",
            amount: 400,
            date_paid: "2024-05-05T00:00:00Z",
            status: "paid",
            description: null,
            type: "manual",
            project_id: "project-40",
            created_at: "2024-05-01T00:00:00Z",
            projects: null,
          },
        ],
        error: null,
      })
    );

    const { result } = renderHook(
      (props: typeof baseProps & { onError: (error: Error) => void }) =>
        usePaymentsData(props),
      {
        initialProps: {
          ...baseProps,
          pageSize: 25,
          sortField: "date_paid",
          sortDirection: "desc",
          statusFilters: ["paid"],
          typeFilters: ["extra"],
          amountMinFilter: 50,
          amountMaxFilter: 500,
          searchTerm: 'Pro "Alpha"',
          onError,
        },
      }
    );

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    await waitFor(() => expect(result.current.tableLoading).toBe(false));

    expect(searchProjectsBuilder.select).toHaveBeenCalledWith(PROJECT_SELECT_FIELDS);
    expect(searchProjectsBuilder.ilike).toHaveBeenCalledWith("name", "%Pro \"Alpha\"%");
    expect(searchLeadsBuilder.select).toHaveBeenCalledWith("id, name");
    expect(searchLeadsBuilder.ilike).toHaveBeenCalledWith("name", "%Pro \"Alpha\"%");
    expect(projectsForLeadsBuilder.select).toHaveBeenCalledWith(PROJECT_SELECT_FIELDS);
    expect(projectsForLeadsBuilder.in).toHaveBeenCalledWith("lead_id", ["lead-30", "lead-40"]);
    expect(hydrationSearchLeadsBuilder.select).toHaveBeenCalledWith("id, name");
    expect(hydrationSearchLeadsBuilder.in).toHaveBeenCalledWith("id", ["lead-50"]);

    expect(tableBuilder.select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(tableBuilder.ilike).toHaveBeenCalledWith("status", "paid");
    expect(tableBuilder.in).toHaveBeenCalledWith("type", ["extra"]);
    expect(tableBuilder.gte).toHaveBeenCalledWith("amount", 50);
    expect(tableBuilder.lte).toHaveBeenCalledWith("amount", 500);
    expect(tableBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("project_id.in.(project-30,project-40,project-50)")
    );
    expect(tableBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining('description.ilike."%Pro ""Alpha""%"')
    );
    expect(tableBuilder.order).toHaveBeenNthCalledWith(1, "date_paid", {
      ascending: false,
      nullsLast: true,
    });
    expect(tableBuilder.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: false,
    });
    expect(tableBuilder.range).toHaveBeenCalledWith(0, 24);

    expect(metricsBuilder.select).toHaveBeenCalledWith(
      "id, amount, status, type, date_paid, created_at, project_id"
    );
    expect(metricsBuilder.ilike).toHaveBeenCalledWith("status", "paid");
    expect(metricsBuilder.in).toHaveBeenCalledWith("type", ["extra"]);
    expect(metricsBuilder.gte).toHaveBeenCalledWith("amount", 50);
    expect(metricsBuilder.lte).toHaveBeenCalledWith("amount", 500);
    expect(metricsBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("project_id.in.(project-30,project-40,project-50)")
    );

    await waitFor(() => expect(result.current.paginatedPayments).toHaveLength(2));
    expect(result.current.paginatedPayments[0]?.id).toBe("payment-newer");
    expect(result.current.totalCount).toBe(2);
  });

  it("surfaces Supabase errors through the provided handler", async () => {
    const failingBuilder = enqueue(
      "payments",
      createQueryBuilder({
        data: null,
        error: new Error("payments fetch failed"),
      })
    );

    const { result } = renderHook(
      (props: typeof baseProps & { onError: (error: Error) => void }) =>
        usePaymentsData(props),
      {
        initialProps: { ...baseProps, onError },
      }
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "payments fetch failed" }));
    expect(result.current.initialLoading).toBe(false);
    expect(result.current.tableLoading).toBe(false);
    expect(result.current.paginatedPayments).toHaveLength(0);
    expect(failingBuilder.range).toHaveBeenCalledWith(0, 1);
  });
});
