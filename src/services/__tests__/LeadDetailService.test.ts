const supabaseFromMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseFromMock(...args),
  },
}));

import {
  fetchLeadById,
  fetchLeadSessions,
  fetchLeadProjectSummary,
  fetchLatestLeadActivity,
} from "../LeadDetailService";

beforeEach(() => {
  supabaseFromMock.mockReset();
});

const createSelectEqMaybeSingleChain = (result: { data: unknown; error: unknown }) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
};

describe("fetchLeadById", () => {
  it("returns lead detail with status data", async () => {
    const leadRecord = {
      id: "lead-1",
      name: "Taylor",
      status: "Qualified",
      status_id: "status-1",
    };

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "leads") {
        return createSelectEqMaybeSingleChain({ data: leadRecord, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await fetchLeadById("lead-1");
    expect(result).toEqual(leadRecord);
  });

  it("propagates Supabase errors", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "leads") {
        return createSelectEqMaybeSingleChain({
          data: null,
          error: new Error("database down"),
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(fetchLeadById("lead-1")).rejects.toThrow("database down");
  });
});

const createSessionsChain = (result: { data: unknown; error: unknown }) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
};

const createProjectStatusesChain = (result: { data: unknown; error: unknown }) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
};

describe("fetchLeadSessions", () => {
  it("filters sessions tied to archived projects while preserving project names", async () => {
    const sessions = [
      {
        id: "session-1",
        project_id: "proj-active",
        session_date: "2025-01-10",
        session_time: "08:00:00",
        status: "Planned",
        projects: { name: "Active Project", status_id: "status-active" },
      },
      {
        id: "session-2",
        project_id: "proj-archived",
        session_date: "2025-01-08",
        session_time: null,
        status: "Planned",
        projects: { name: "Archived Project", status_id: "status-archived" },
      },
      {
        id: "session-3",
        project_id: null,
        session_date: null,
        session_time: null,
        status: "Completed",
        project_name: null,
        projects: null,
      },
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "sessions":
          return createSessionsChain({ data: sessions, error: null });
        case "project_statuses":
          return createProjectStatusesChain({
            data: { id: "status-archived" },
            error: null,
          });
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const result = await fetchLeadSessions("lead-1", "org-1");

    expect(result.map((session) => session.id)).toEqual(["session-1", "session-3"]);
    expect(result[0].project_name).toBe("Active Project");
    expect(result[1].project_name).toBeNull();
  });

  it("returns all sessions when organization ID missing", async () => {
    const sessions = [
      { id: "session-1", projects: null },
      { id: "session-2", projects: null },
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        return createSessionsChain({ data: sessions, error: null });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await fetchLeadSessions("lead-1");
    expect(result).toHaveLength(2);
  });
});

const createProjectsChain = (result: { data: unknown; error: unknown }) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => {
      chain.__eqCalls = (chain.__eqCalls || 0) + 1;
      if (chain.__eqCalls >= 2) {
        return Promise.resolve(result);
      }
      return chain;
    }),
  };
  return chain;
};

const createTodosChain = (result: { data: unknown; error: unknown }) => {
  const chain: any = {
    select: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
};

const createPaymentsChain = (result: { data: unknown; error: unknown }) => ({
  select: jest.fn(() => ({
    in: jest.fn(() => Promise.resolve(result)),
  })),
});

describe("fetchLeadProjectSummary", () => {
  it("aggregates project count, payments, and latest updates excluding archived projects", async () => {
    const projects = [
      {
        id: "proj-1",
        updated_at: "2025-05-10T12:00:00Z",
        base_price: 1000,
        status_id: "status-active",
        project_services: [
          { services: { selling_price: 400, price: 300 } },
          { services: { selling_price: null, price: 200 } },
        ],
      },
      {
        id: "proj-arch",
        updated_at: "2025-05-08T10:00:00Z",
        base_price: 500,
        status_id: "status-archived",
        project_services: [],
      },
      {
        id: "proj-2",
        updated_at: null,
        base_price: null,
        status_id: "status-active",
        project_services: [],
      },
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createProjectsChain({ data: projects, error: null });
        case "project_statuses":
          return createProjectStatusesChain({
            data: { id: "status-archived" },
            error: null,
          });
        case "todos":
          return createTodosChain({
            data: { updated_at: "2025-05-11T09:00:00Z" },
            error: null,
          });
        case "payments":
          return createPaymentsChain({
            data: [
              { project_id: "proj-1", amount: 500, status: "paid" },
              { project_id: "proj-1", amount: 200, status: "pending" },
              { project_id: "proj-2", amount: 100, status: "paid" },
            ],
            error: null,
          });
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const result = await fetchLeadProjectSummary("lead-1", "org-2");

    expect(result.hasProjects).toBe(true);
    expect(result.summary).toEqual({
      count: 2,
      latestUpdate: "2025-05-11T09:00:00Z",
    });
    expect(result.payments).toEqual({
      totalPaid: 600,
      total: 1600,
      remaining: 1000,
      currency: "TRY",
    });
  });

  it("handles empty project list gracefully", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createProjectsChain({ data: [], error: null });
        case "project_statuses":
          return createProjectStatusesChain({ data: null, error: null });
        default:
          return createSelectEqMaybeSingleChain({ data: null, error: null });
      }
    });

    const result = await fetchLeadProjectSummary("lead-1", "org-empty");

    expect(result).toEqual({
      hasProjects: false,
      summary: { count: 0, latestUpdate: null },
      payments: { totalPaid: 0, total: 0, remaining: 0, currency: "TRY" },
    });
  });
});

const createActivitiesChain = (result: { data: unknown; error: unknown }) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
};

describe("fetchLatestLeadActivity", () => {
  it("returns latest updated_at or created_at value", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "activities") {
        return createActivitiesChain({
          data: [
            { updated_at: "2025-05-12T10:00:00Z", created_at: "2025-05-11T10:00:00Z" },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const latest = await fetchLatestLeadActivity("lead-1");
    expect(latest).toBe("2025-05-12T10:00:00Z");
  });

  it("throws when Supabase returns an error", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "activities") {
        return createActivitiesChain({
          data: null,
          error: new Error("activities unavailable"),
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(fetchLatestLeadActivity("lead-1")).rejects.toThrow("activities unavailable");
  });
});
