import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import GlobalSearch from "../GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

type SupabaseResponse<TData> = { data: TData; error: Error | null };

type SupabaseResponses = {
  lead_statuses: SupabaseResponse<Array<{ id: string; name: string; sort_order: number }>>;
  project_statuses: SupabaseResponse<Array<{ id: string; name: string; sort_order: number }>>;
  lead_field_definitions: SupabaseResponse<Array<{ field_key: string; label: string }>>;
  leads: SupabaseResponse<Array<Record<string, unknown>>>;
  lead_field_values: SupabaseResponse<Array<Record<string, unknown>>>;
  activities: SupabaseResponse<Array<Record<string, unknown>>>;
  sessions: SupabaseResponse<Array<Record<string, unknown>>>;
  projects: SupabaseResponse<Array<Record<string, unknown>>>;
  [key: string]: SupabaseResponse<unknown>;
};

const leadStatusBadgeMock = jest.fn();
const projectStatusBadgeMock = jest.fn();
const navigateMock = jest.fn();

jest.mock("@/components/LeadStatusBadge", () => ({
  LeadStatusBadge: (props: unknown) => {
    leadStatusBadgeMock(props);
    return <div data-testid="lead-status-badge" />;
  },
}));

jest.mock("@/components/ProjectStatusBadge", () => ({
  ProjectStatusBadge: (props: unknown) => {
    projectStatusBadgeMock(props);
    return <div data-testid="project-status-badge" />;
  },
}));

jest.mock("@/components/ui/loading-presets", () => ({
  SearchLoadingSkeleton: () => <div data-testid="search-loading" />,
}));

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

const createQueryBuilder = (table: keyof SupabaseResponses, responses: SupabaseResponses) => {
  const response = responses[table] ?? { data: [], error: null };
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    in: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    then: (
      onFulfilled: (value: SupabaseResponse<unknown>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).catch(onRejected),
    finally: (onFinally?: () => void) =>
      Promise.resolve(response).finally(onFinally),
  };
  return builder;
};

const setupSupabase = (overrides: Partial<SupabaseResponses> = {}) => {
  const responses: SupabaseResponses = {
    ...baseResponses,
    ...overrides,
  };
  supabaseFromMock.mockImplementation((table: keyof SupabaseResponses) =>
    createQueryBuilder(table, responses)
  );
  return responses;
};

const flushPromises = async (times: number = 12) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
};

const runDebouncedSearch = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await flushPromises(4);
    });
    await act(async () => {
      jest.runAllTimers();
    });
    await act(async () => {
      await flushPromises(20);
    });
  }
};

describe("GlobalSearch", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    jest.clearAllMocks();
    navigateMock.mockReset();
    window.localStorage.clear();
    (getUserOrganizationId as jest.Mock).mockResolvedValue("org-123");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("performs a debounced search and renders lead statuses", async () => {
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

    render(<GlobalSearch variant="page" initialQuery="Jane" />);

    await waitFor(() =>
      expect(
        supabaseFromMock.mock.calls.some((call) => call[0] === "lead_statuses")
      ).toBe(true)
    );

    await runDebouncedSearch();

    expect(supabaseFromMock.mock.calls.map((call) => call[0])).toContain(
      "lead_field_values"
    );
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    await waitFor(() => expect(leadStatusBadgeMock).toHaveBeenCalled());

    const leadBadgeProps = leadStatusBadgeMock.mock.calls[0][0];
    expect(leadBadgeProps.statuses).toEqual(baseResponses.lead_statuses.data);

  });

  it("supports keyboard navigation to select a result", async () => {
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

    render(<GlobalSearch variant="page" initialQuery="Jane" />);

    await waitFor(() =>
      expect(
        supabaseFromMock.mock.calls.some((call) => call[0] === "lead_statuses")
      ).toBe(true)
    );

    const input = screen.getByPlaceholderText("search.placeholder");

    await runDebouncedSearch();

    expect(supabaseFromMock.mock.calls.map((call) => call[0])).toContain(
      "lead_field_values"
    );
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(await screen.findByText("Project One")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(navigateMock).toHaveBeenCalledWith("/leads/lead-1");

  });
});
