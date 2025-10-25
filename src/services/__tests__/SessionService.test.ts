import { SessionService } from "../SessionService";

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

beforeEach(() => {
  supabaseFromMock.mockReset();
  supabaseAuthGetUserMock.mockReset();
});

describe("SessionService.fetchSessions", () => {
  it("retrieves sessions and filters archived projects", async () => {
    const sessionsData = {
      data: [
        {
          id: "session-1",
          lead_id: "lead-1",
          project_id: "project-1",
          session_date: "2024-05-01",
          session_time: "10:00",
          notes: "Morning session",
          status: "planned",
          created_at: "2024-04-01",
          organization_id: "org-1",
          user_id: "user-1",
          leads: { id: "lead-1", name: "Alice", status: "active" },
          projects: { id: "project-1", name: "Main Project", status_id: "status-active" },
        },
        {
          id: "session-2",
          lead_id: "lead-2",
          project_id: "project-2",
          session_date: "2024-05-02",
          session_time: "12:00",
          notes: "Midday",
          status: "planned",
          created_at: "2024-04-02",
          organization_id: "org-1",
          user_id: "user-1",
          leads: { id: "lead-2", name: "Bob", status: "active" },
          projects: { id: "project-2", name: "Archived Project", status_id: "status-archived" },
        },
      ],
      error: null,
    };

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "sessions":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve(sessionsData)),
                })),
              })),
            })),
          };
        case "project_statuses":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                ilike: jest.fn(() => ({ maybeSingle: jest.fn(() => Promise.resolve({ data: { id: "status-archived" }, error: null })) })),
              })),
            })),
          };
        default:
          return {};
      }
    });

    supabaseAuthGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const service = new SessionService();
    (service as any).getOrganizationId = jest.fn().mockResolvedValue("org-1");

    const sessions = await service.fetchSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("session-1");
    expect(sessions[0].lead_name).toBe("Alice");
    expect(sessions[0].project_name).toBe("Main Project");
  });

  it("returns empty array when organization missing", async () => {
    const service = new SessionService();
    (service as any).getOrganizationId = jest.fn().mockResolvedValue(null);

    const sessions = await service.fetchSessions();
    expect(sessions).toEqual([]);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });
});

describe("SessionService.fetchFilteredSessions", () => {
  it("applies filters and sorts", async () => {
    const service = new SessionService();
    jest.spyOn(service, "fetchSessions").mockResolvedValue([
      {
        id: "session-1",
        lead_id: "lead-1",
        project_id: "project-1",
        session_date: "2024-05-01",
        session_time: "09:00",
        notes: "Morning",
        status: "planned",
        lead_name: "Alice",
        project_name: "Wedding",
        created_at: "2024-04-01",
      },
      {
        id: "session-2",
        lead_id: "lead-2",
        project_id: "project-2",
        session_date: "2024-05-01",
        session_time: "11:00",
        notes: "Lunch",
        status: "completed",
        lead_name: "Bob",
        project_name: "Portrait",
        created_at: "2024-04-02",
      },
    ] as any);

    const filtered = await service.fetchFilteredSessions({ status: "planned", leadId: "lead-1" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("session-1");

    const sorted = await service.fetchFilteredSessions(undefined, { field: "session_date", direction: "asc" });
    expect(sorted[0].session_time).toBe("09:00");
  });
});
