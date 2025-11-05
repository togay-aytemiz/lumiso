import { LeadService, type LeadWithCustomFields } from "../LeadService";

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

describe("LeadService.fetchLeadsWithCustomFields", () => {
  it("returns leads merged with custom fields", async () => {
    const leadsData = {
      data: [
        {
          id: "lead-1",
          name: "Alice",
          email: "a@example.com",
          phone: "123",
          status: "active",
          status_id: "status-1",
          organization_id: "org-1",
          lead_statuses: { id: "status-1", name: "New", color: "blue", is_system_final: false },
        },
      ],
      error: null,
    };

    const fieldValues = {
      data: [
        { lead_id: "lead-1", field_key: "source", value: "Instagram" },
      ],
      error: null,
    };

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "leads":
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve(leadsData)),
              })),
            })),
          };
        case "lead_field_values":
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve(fieldValues)),
            })),
          };
        default:
          return {};
      }
    });

    const service = new LeadService();
    const getOrganizationIdSpy = jest
      .spyOn(service as unknown as { getOrganizationId: () => Promise<string | null> }, "getOrganizationId")
      .mockResolvedValue("org-1");

    const leads = await service.fetchLeadsWithCustomFields();

    expect(leads).toHaveLength(1);
    expect(leads[0].custom_fields).toEqual({ source: "Instagram" });
    expect(leads[0].lead_statuses?.name).toBe("New");

    getOrganizationIdSpy.mockRestore();
  });

  it("returns empty array when organization missing", async () => {
    const service = new LeadService();
    const getOrganizationIdSpy = jest
      .spyOn(service as unknown as { getOrganizationId: () => Promise<string | null> }, "getOrganizationId")
      .mockResolvedValue(null);

    const leads = await service.fetchLeadsWithCustomFields();
    expect(leads).toEqual([]);
    expect(supabaseFromMock).not.toHaveBeenCalled();

    getOrganizationIdSpy.mockRestore();
  });
});

describe("LeadService.fetchLeads", () => {
  it("applies filters and sorting", async () => {
    const service = new LeadService();
    jest
      .spyOn(service, "fetchLeadsWithCustomFields")
      .mockResolvedValue([
        {
          id: "lead-1",
          name: "Alice",
          email: "alice@example.com",
          phone: "123",
          status: "active",
          status_id: "status-1",
          updated_at: "2024-05-12T00:00:00Z",
          created_at: "2024-05-01T00:00:00Z",
          due_date: "2024-05-10",
          custom_fields: {},
          lead_statuses: { id: "status-1", name: "Open", color: "blue", is_system_final: false },
          notes: "VIP",
        },
        {
          id: "lead-2",
          name: "Bob",
          email: "bob@example.com",
          phone: "456",
          status: "active",
          status_id: "status-2",
          updated_at: "2024-05-11T00:00:00Z",
          created_at: "2024-05-02T00:00:00Z",
          due_date: "2024-05-12",
          custom_fields: {},
          lead_statuses: { id: "status-2", name: "Closed", color: "gray", is_system_final: false },
          notes: "Follow up",
        },
      ] as LeadWithCustomFields[]);

    const filtered = await service.fetchLeads({ status: "Open", search: "alice" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("lead-1");

    const sorted = await service.fetchLeads(undefined, { field: "name", direction: "desc" });
    expect(sorted[0].name).toBe("Bob");
  });
});
