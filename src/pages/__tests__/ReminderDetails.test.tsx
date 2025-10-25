import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import ReminderDetails from "../ReminderDetails";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const mockNavigate = jest.fn();

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

type TranslationOptions = { [key: string]: any };

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: TranslationOptions) => {
      if (options?.returnObjects) {
        return [];
      }
      if (options?.count !== undefined) {
        return `${key}:${options.count}`;
      }
      if (options?.tomorrow !== undefined || options?.later !== undefined) {
        return `${key}:${options?.tomorrow ?? 0}/${options?.later ?? 0}`;
      }
      if (options?.today !== undefined || options?.allTime !== undefined) {
        return `${key}:${options?.today ?? 0}/${options?.allTime ?? 0}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/useThrottledRefetchOnFocus", () => ({
  useThrottledRefetchOnFocus: jest.fn(),
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  };
});

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

const sanitizeTestId = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

jest.mock("@/components/ui/kpi-card", () => ({
  KpiCard: ({ title, value, info }: any) => (
    <div data-testid={`kpi-${sanitizeTestId(String(title))}`}>
      <span data-testid={`kpi-${sanitizeTestId(String(title))}-value`}>{value}</span>
      {info?.content ? <span>{info.content}</span> : null}
    </div>
  ),
}));

jest.mock("@/components/ui/kpi-presets", () => ({
  getKpiIconPreset: () => ({}),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...rest }: any) => (
    <span {...rest}>{children}</span>
  ),
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ title, subtitle, children }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
  PageHeaderSearch: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/GlobalSearch", () => () => <div data-testid="global-search" />);

jest.mock("@/components/FilterBar", () => ({
  FilterBar: ({ quickFilters = [], onQuickFilterChange = () => {}, showCompleted, onShowCompletedChange = () => {}, hideOverdue, onHideOverdueChange = () => {} }: any) => (
    <div data-testid="filter-bar">
      {quickFilters.map((filter: any) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onQuickFilterChange(filter.key)}
        >
          {filter.label}:{filter.count}
        </button>
      ))}
      <button type="button" onClick={() => onShowCompletedChange(!showCompleted)}>
        toggle-completed
      </button>
      <button type="button" onClick={() => onHideOverdueChange(!hideOverdue)}>
        toggle-overdue
      </button>
    </div>
  ),
}));

jest.mock("@/components/ui/loading-presets", () => ({
  ListLoadingSkeleton: () => <div data-testid="loading-skeleton" />,
}));

jest.mock("@/components/ViewProjectDialog", () => ({
  ViewProjectDialog: ({ open, project, leadName }: any) =>
    open ? (
      <div data-testid="view-project-dialog">
        {project?.name} - {leadName}
      </div>
    ) : null,
}));

jest.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

const mockToast = toast as jest.Mock;
const mockSupabaseFrom = supabase.from as jest.Mock;

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string | null;
  type: string;
  lead_id: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  completed?: boolean;
}

interface Lead {
  id: string;
  name: string;
  status: string;
}

const createActivitiesQuery = (activities: Activity[], error?: Error) => {
  const query: any = {};
  let orderCalls = 0;
  query.select = jest.fn(() => query);
  query.not = jest.fn(() => query);
  query.order = jest.fn(() => {
    orderCalls += 1;
    if (orderCalls >= 2) {
      if (error) {
        return Promise.resolve({ data: null, error });
      }
      return Promise.resolve({ data: activities, error: null });
    }
    return query;
  });
  return query;
};

const createLeadsQuery = (leads: Lead[], error?: Error) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.in = jest.fn(() => Promise.resolve({ data: error ? null : leads, error: error ?? null }));
  query.eq = jest.fn(() => query);
  query.single = jest.fn(() => Promise.resolve({ data: error ? null : leads[0], error: error ?? null }));
  return query;
};

const createUpdateActivityQuery = (error?: Error) => {
  const query: any = {};
  query.update = jest.fn(() => query);
  query.eq = jest.fn(() => Promise.resolve({ error: error ?? null }));
  return query;
};

const createProjectQuery = (project: any, error?: Error) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.single = jest.fn(() => Promise.resolve({ data: error ? null : project, error: error ?? null }));
  return query;
};

const createLeadSingleQuery = (lead: Lead, error?: Error) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.single = jest.fn(() => Promise.resolve({ data: error ? null : lead, error: error ?? null }));
  return query;
};

const iso = (value: string) => new Date(value).toISOString();

describe("ReminderDetails page", () => {
  const RealDate = Date;
  const fixedDate = new RealDate("2024-05-20T12:00:00.000Z");

  beforeAll(() => {
    class FixedDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixedDate.toISOString());
        } else {
          super(...args);
        }
      }

      static now() {
        return fixedDate.getTime();
      }
    }

    global.Date = FixedDate as unknown as DateConstructor;
  });

  afterAll(() => {
    global.Date = RealDate;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockToast.mockReset();
    mockNavigate.mockReset();
  });

  it("renders reminder metrics and timeline from fetched data", async () => {
    const activities: Activity[] = [
      {
        id: "activity-overdue",
        content: "Follow up overdue",
        reminder_date: iso("2024-05-18T00:00:00.000Z"),
        reminder_time: null,
        type: "call",
        lead_id: "lead-1",
        created_at: iso("2024-05-01T00:00:00.000Z"),
        updated_at: iso("2024-05-01T00:00:00.000Z"),
      },
      {
        id: "activity-today",
        content: "Call prospect",
        reminder_date: iso("2024-05-20T00:00:00.000Z"),
        reminder_time: "09:30",
        type: "call",
        lead_id: "lead-2",
        created_at: iso("2024-05-02T00:00:00.000Z"),
        updated_at: iso("2024-05-02T00:00:00.000Z"),
      },
      {
        id: "activity-upcoming",
        content: "Prep materials",
        reminder_date: iso("2024-05-21T00:00:00.000Z"),
        reminder_time: "13:00",
        type: "task",
        lead_id: "lead-1",
        project_id: "project-7",
        created_at: iso("2024-05-03T00:00:00.000Z"),
        updated_at: iso("2024-05-03T00:00:00.000Z"),
      },
      {
        id: "activity-completed",
        content: "Send recap",
        reminder_date: iso("2024-05-20T00:00:00.000Z"),
        reminder_time: null,
        type: "email",
        lead_id: "lead-2",
        created_at: iso("2024-05-04T00:00:00.000Z"),
        updated_at: iso("2024-05-04T00:00:00.000Z"),
        completed: true,
      },
    ];

    const leads: Lead[] = [
      { id: "lead-1", name: "Alice Johnson", status: "active" },
      { id: "lead-2", name: "Bob Smith", status: "active" },
    ];

    mockSupabaseFrom
      .mockImplementationOnce(() => createActivitiesQuery(activities))
      .mockImplementationOnce(() => createLeadsQuery(leads));

    render(<ReminderDetails />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument();
    });

    expect(await screen.findByTestId("kpi-reminders-stats-overdue-value")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-reminders-stats-today-value")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-reminders-stats-upcoming-value")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-reminders-stats-completed-value")).toHaveTextContent("1");

    expect(await screen.findByText("Call prospect")).toBeInTheDocument();
    expect(screen.getByText("Follow up overdue")).toBeInTheDocument();

    const allFilterButtons = screen.getAllByRole("button", { name: /reminders\.filters\.all/ });
    fireEvent.click(allFilterButtons[0]);

    expect(await screen.findByText("Prep materials")).toBeInTheDocument();

    const aliceNames = screen.getAllByText("Alice Johnson");
    const bobNames = screen.getAllByText("Bob Smith");
    expect(aliceNames.length).toBeGreaterThan(0);
    expect(bobNames.length).toBeGreaterThan(0);

    const openLeadButtons = screen.getAllByRole("button", { name: "reminders.timeline.openLead" });
    fireEvent.click(openLeadButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/leads/lead-1");
    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(1, "activities");
    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(2, "leads");
  });

  it("surfaces a destructive toast when reminder fetching fails", async () => {
    const error = new Error("network down");
    mockSupabaseFrom.mockImplementationOnce(() => createActivitiesQuery([], error));

    render(<ReminderDetails />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error fetching reminders",
          description: "network down",
          variant: "destructive",
        })
      );
    });
  });

  it("toggles reminder completion state and shows success feedback", async () => {
    const activity: Activity = {
      id: "activity-1",
      content: "Confirm booking",
      reminder_date: iso("2024-05-20T00:00:00.000Z"),
      reminder_time: "11:00",
      type: "call",
      lead_id: "lead-1",
      created_at: iso("2024-05-01T00:00:00.000Z"),
      updated_at: iso("2024-05-01T00:00:00.000Z"),
    };

    const leads: Lead[] = [{ id: "lead-1", name: "Jordan Ray", status: "active" }];

    const updateQuery = createUpdateActivityQuery();

    mockSupabaseFrom
      .mockImplementationOnce(() => createActivitiesQuery([activity]))
      .mockImplementationOnce(() => createLeadsQuery(leads))
      .mockImplementationOnce(() => updateQuery);

    render(<ReminderDetails />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument();
    });

    const completeButton = await screen.findByRole("button", { name: "reminders.markComplete" });
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(updateQuery.update).toHaveBeenCalledWith({ completed: true });
      expect(updateQuery.eq).toHaveBeenCalledWith("id", "activity-1");
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Reminder marked as completed",
        description: "Reminder status updated successfully.",
      })
    );

    fireEvent.click(screen.getByText("toggle-completed"));

    expect(await screen.findByRole("button", { name: "reminders.markIncomplete" })).toBeInTheDocument();
  });

  it("loads project details when project navigation is requested", async () => {
    const activity: Activity = {
      id: "activity-with-project",
      content: "Review proposal",
      reminder_date: iso("2024-05-21T00:00:00.000Z"),
      reminder_time: null,
      type: "task",
      lead_id: "lead-1",
      project_id: "project-42",
      created_at: iso("2024-05-01T00:00:00.000Z"),
      updated_at: iso("2024-05-01T00:00:00.000Z"),
    };

    const initialLeads: Lead[] = [{ id: "lead-1", name: "Devon Lane", status: "active" }];

    const project = {
      id: "project-42",
      name: "Project Phoenix",
      description: "High priority",
      lead_id: "lead-2",
      user_id: "user-1",
      created_at: iso("2024-05-01T00:00:00.000Z"),
      updated_at: iso("2024-05-01T00:00:00.000Z"),
      status_id: "status-1",
      previous_status_id: null,
      project_type_id: "type-1",
    };

    const projectLead: Lead = { id: "lead-2", name: "Taylor Bright", status: "active" };

    mockSupabaseFrom
      .mockImplementationOnce(() => createActivitiesQuery([activity]))
      .mockImplementationOnce(() => createLeadsQuery(initialLeads))
      .mockImplementationOnce(() => createProjectQuery(project))
      .mockImplementationOnce(() => createLeadSingleQuery(projectLead));

    render(<ReminderDetails />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument();
    });

    const allFilterButtons = await screen.findAllByRole("button", { name: /reminders\.filters\.all/ });
    fireEvent.click(allFilterButtons[0]);

    const openProjectButton = await screen.findByRole("button", { name: "reminders.timeline.openProject" });
    fireEvent.click(openProjectButton);

    await waitFor(() => {
      expect(screen.getByTestId("view-project-dialog")).toHaveTextContent("Project Phoenix - Taylor Bright");
    });

    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(3, "projects");
    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(4, "leads");
  });
});
