import { ProjectService } from "../ProjectService";

const supabaseFromMock = jest.fn();
const supabaseAuthGetUserMock = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseFromMock(...args),
    auth: {
      getUser: (...args: unknown[]) => supabaseAuthGetUserMock(...args),
    },
  },
}));

type QueryResult<TData> = {
  data: TData;
  error: unknown | null;
};

type OrderChain<TData> = {
  select: jest.Mock<OrderChain<TData>, []>;
  eq: jest.Mock<OrderChain<TData>, [string, unknown]>;
  order: jest.Mock<OrderChain<TData> | Promise<QueryResult<TData>>, [string, unknown?]>;
  __orderCalls?: number;
};

const createOrderChain = <TData>(result: QueryResult<TData>, requiredOrders = 1): OrderChain<TData> => {
  const chain: Partial<OrderChain<TData>> & { __orderCalls?: number } = {};

  chain.select = jest.fn(() => chain as OrderChain<TData>);
  chain.eq = jest.fn(() => chain as OrderChain<TData>);
  chain.order = jest.fn(() => {
    chain.__orderCalls = (chain.__orderCalls || 0) + 1;
    if (chain.__orderCalls >= requiredOrders) {
      return Promise.resolve(result);
    }
    return chain as OrderChain<TData>;
  });

  return chain as OrderChain<TData>;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id: string;
  project_type_id: string;
  base_price: number;
  organization_id: string;
};

const createProjectsChain = (projectsData: ProjectRow[]) =>
  createOrderChain<ProjectRow[]>({ data: projectsData, error: null }, 2);

const createSelectEqOrderChain = <TData>(result: QueryResult<TData>, requiredOrders = 1) =>
  createOrderChain(result, requiredOrders);

const createSelectInChain = <TData>(result: QueryResult<TData>) => ({
  select: jest.fn(() => ({
    in: jest.fn(async () => result),
  })),
});

type ProjectServiceWithOrg = ProjectService & {
  getOrganizationId: jest.Mock<Promise<string | null>, []>;
};

beforeEach(() => {
  supabaseFromMock.mockReset();
  supabaseAuthGetUserMock.mockReset();
});

describe("ProjectService.fetchProjects", () => {
  it("returns aggregated active and archived projects", async () => {
    const projectsData = [
      {
        id: "proj-1",
        name: "Wedding Album",
        description: "Classic album",
        lead_id: "lead-1",
        user_id: "user-1",
        created_at: "2024-01-01",
        updated_at: "2024-01-02",
        status_id: "status-open",
        project_type_id: "type-1",
        base_price: 1000,
        organization_id: "org-1",
      },
      {
        id: "proj-2",
        name: "Archived Shoot",
        description: "Old project",
        lead_id: "lead-2",
        user_id: "user-1",
        created_at: "2023-05-01",
        updated_at: "2023-05-02",
        status_id: "status-archived",
        project_type_id: "type-2",
        base_price: 500,
        organization_id: "org-1",
      },
    ];

    const sessionsData = {
      data: [
        { project_id: "proj-1", status: "upcoming" },
        { project_id: "proj-1", status: "planned" },
        { project_id: "proj-2", status: "planned" },
      ],
      error: null,
    };

    const todosData = {
      data: [
        { project_id: "proj-1", is_completed: true },
        { project_id: "proj-1", is_completed: false },
        { project_id: "proj-2", is_completed: false },
      ],
      error: null,
    };

    const servicesData = {
      data: [
        { project_id: "proj-1", service: { id: "service-1", name: "Album" } },
      ],
      error: null,
    };

    const paymentsData = {
      data: [
        { project_id: "proj-1", amount: 200, status: "paid" },
        { project_id: "proj-1", amount: 100, status: "pending" },
      ],
      error: null,
    };

    const leadsData = {
      data: [
        { id: "lead-1", name: "Alice", status: "active", email: "a@example.com", phone: "123" },
      ],
      error: null,
    };

    const statusesData = {
      data: [
        { id: "status-open", name: "Open", color: "blue", sort_order: 1 },
        { id: "status-archived", name: "Archived", color: "gray", sort_order: 2 },
      ],
      error: null,
    };

    const typesData = {
      data: [
        { id: "type-1", name: "Wedding" },
        { id: "type-2", name: "Portrait" },
      ],
      error: null,
    };

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "projects":
          return createProjectsChain(projectsData);
        case "sessions":
          return createSelectInChain(sessionsData);
        case "todos":
          return createSelectInChain(todosData);
        case "project_services":
          return createSelectInChain(servicesData);
        case "payments":
          return createSelectInChain(paymentsData);
        case "leads":
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve(leadsData)),
            })),
          };
        case "project_statuses":
          return createSelectEqOrderChain(statusesData, 1);
        case "project_types":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve(typesData)),
            })),
          };
        default:
          return {};
      }
    });

    const service = new ProjectService() as ProjectServiceWithOrg;
    service.getOrganizationId = jest.fn().mockResolvedValue("org-1");

    const result = await service.fetchProjects();

    expect(result.active).toHaveLength(1);
    expect(result.archived).toHaveLength(1);

    const activeProject = result.active[0];
    expect(activeProject.lead?.name).toBe("Alice");
    expect(activeProject.project_status?.name).toBe("Open");
    expect(activeProject.project_type?.name).toBe("Wedding");
    expect(activeProject.session_count).toBe(2);
    expect(activeProject.upcoming_session_count).toBe(1);
    expect(activeProject.planned_session_count).toBe(1);
    expect(activeProject.todo_count).toBe(2);
    expect(activeProject.completed_todo_count).toBe(1);
    expect(activeProject.paid_amount).toBe(200);
    expect(activeProject.remaining_amount).toBe(800);
    expect(activeProject.services).toEqual([{ id: "service-1", name: "Album" }]);
  });

  it("returns empty arrays when organization is missing", async () => {
    const service = new ProjectService() as ProjectServiceWithOrg;
    service.getOrganizationId = jest.fn().mockResolvedValue(null);

    const result = await service.fetchProjects();
    expect(result).toEqual({ active: [], archived: [] });
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });
});

describe("ProjectService.fetchFilteredProjects", () => {
  it("filters and sorts projects", async () => {
    const service = new ProjectService();
    jest.spyOn(service, "fetchProjects").mockResolvedValue({
      active: [
        {
          id: "proj-1",
          name: "Alpha",
          description: "First",
          lead_id: "lead-1",
          lead: { name: "Zoe" },
          project_type: { name: "Wedding" },
          project_status: { name: "Open" },
          status_id: "status-open",
          project_type_id: "type-1",
          created_at: "2024-01-02",
          updated_at: "2024-01-03",
        },
        {
          id: "proj-2",
          name: "Bravo",
          description: "Second",
          lead_id: "lead-2",
          lead: { name: "Amy" },
          project_type: { name: "Portrait" },
          project_status: { name: "Closed" },
          status_id: "status-closed",
          project_type_id: "type-2",
          created_at: "2024-01-01",
          updated_at: "2024-01-04",
        },
      ],
      archived: [
        {
          id: "proj-3",
          name: "Zulu",
          description: "Archived",
          lead_id: "lead-3",
          lead: { name: "Ben" },
          project_status: { name: "Closed" },
          status_id: "status-closed",
          project_type: { name: "Wedding" },
          project_type_id: "type-1",
          created_at: "2023-12-01",
          updated_at: "2023-12-02",
        },
      ],
    });

    const result = await service.fetchFilteredProjects(
      { status: "Closed", projectTypeId: "type-1", archived: true },
      { field: "name", direction: "asc" }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("proj-3");

    const sorted = await service.fetchFilteredProjects(
      undefined,
      { field: "lead_name", direction: "desc" }
    );

    expect(sorted[0].lead?.name).toBe("Zoe");
  });
});
