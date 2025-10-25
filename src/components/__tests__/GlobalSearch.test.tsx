import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import GlobalSearch from "../GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

type SupabaseResponse = { data: any; error: any };

type SupabaseResponses = Record<string, SupabaseResponse>;

const leadStatusBadgeMock = jest.fn();
const projectStatusBadgeMock = jest.fn();
const navigateMock = jest.fn();

jest.mock("@/components/LeadStatusBadge", () => {
  const React = require("react");
  return {
    LeadStatusBadge: (props: any) => {
      leadStatusBadgeMock(props);
      return React.createElement("div", { "data-testid": "lead-status-badge" });
    },
  };
});

jest.mock("@/components/ProjectStatusBadge", () => {
  const React = require("react");
  return {
    ProjectStatusBadge: (props: any) => {
      projectStatusBadgeMock(props);
      return React.createElement("div", { "data-testid": "project-status-badge" });
    },
  };
});

jest.mock("@/components/ui/loading-presets", () => {
  const React = require("react");
  return {
    SearchLoadingSkeleton: () =>
      React.createElement("div", { "data-testid": "search-loading" }),
  };
});

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${Object.values(params).join(" ")}`;
      }
      return key;
    },
  }),
  useCommonTranslation: () => ({ t: (key: string) => key }),
  useMessagesTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

const supabaseFromMock = supabase.from as jest.Mock;

const baseResponses: SupabaseResponses = {
  lead_statuses: {
    data: [
      { id: "status-1", name: "Active", sort_order: 1 },
      { id: "status-2", name: "Archived", sort_order: 2 },
    ],
    error: null,
  },
  project_statuses: {
    data: [
      { id: "project-status-1", name: "In Progress", sort_order: 1 },
      { id: "project-status-2", name: "Archived", sort_order: 2 },
    ],
    error: null,
  },
  lead_field_definitions: {
    data: [
      { field_key: "custom_field", label: "Custom Field" },
      { field_key: "secondary", label: "Secondary" },
    ],
    error: null,
  },
  leads: { data: [], error: null },
  lead_field_values: { data: [], error: null },
  activities: { data: [], error: null },
  sessions: { data: [], error: null },
  projects: { data: [], error: null },
};

const createQueryBuilder = (table: string, responses: SupabaseResponses) => {
  const response = responses[table] ?? { data: [], error: null };
  const builder: any = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.or = jest.fn(() => Promise.resolve(response));
  builder.order = jest.fn(() => Promise.resolve(response));
  builder.ilike = jest.fn(() => Promise.resolve(response));
  builder.in = jest.fn(() => Promise.resolve(response));
  builder.limit = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve(response));
  builder.insert = jest.fn(() => Promise.resolve(response));
  builder.update = jest.fn(() => Promise.resolve(response));
  builder.delete = jest.fn(() => Promise.resolve(response));
  return builder;
};

const setupSupabase = (overrides: Partial<SupabaseResponses> = {}) => {
  const responses: SupabaseResponses = {
    ...baseResponses,
    ...overrides,
  };
  supabaseFromMock.mockImplementation((table: string) =>
    createQueryBuilder(table, responses)
  );
  return responses;
};

describe("GlobalSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigateMock.mockReset();
    (getUserOrganizationId as jest.Mock).mockResolvedValue("org-123");
  });

  it("performs a debounced search and renders lead statuses", async () => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    const lead = {
      id: "lead-1",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-5555",
      status: "Active",
      status_id: "status-1",
    };

    setupSupabase({
      leads: { data: [lead], error: null },
    });

    render(<GlobalSearch />);

    const input = screen.getByPlaceholderText("search.placeholder");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Jane" } });

    const leadsCallsBefore = supabaseFromMock.mock.calls.filter(
      (call) => call[0] === "leads"
    ).length;
    expect(leadsCallsBefore).toBe(0);

    await act(async () => {
      jest.advanceTimersByTime(299);
    });

    expect(
      supabaseFromMock.mock.calls.filter((call) => call[0] === "leads").length
    ).toBe(0);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    await waitFor(() => expect(leadStatusBadgeMock).toHaveBeenCalled());

    const leadBadgeProps = leadStatusBadgeMock.mock.calls[0][0];
    expect(leadBadgeProps.statuses).toEqual(baseResponses.lead_statuses.data);

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("supports keyboard navigation to select a result", async () => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    const lead = {
      id: "lead-1",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-5555",
      status: "Active",
      status_id: "status-1",
    };
    const project = {
      id: "project-1",
      name: "Project One",
      description: "Jane project description",
      lead_id: "lead-1",
      status_id: "project-status-1",
    };

    setupSupabase({
      leads: { data: [lead], error: null },
      projects: { data: [project], error: null },
    });

    render(<GlobalSearch />);

    const input = screen.getByPlaceholderText("search.placeholder");
    fireEvent.change(input, { target: { value: "Jane" } });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Project One")).toBeInTheDocument());

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(navigateMock).toHaveBeenCalledWith("/leads/lead-1");

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });
});
