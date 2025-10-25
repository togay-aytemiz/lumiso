import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AllSessions from "../UpcomingSessions";
import { supabase } from "@/integrations/supabase/client";
import { useSessionStatuses } from "@/hooks/useOrganizationData";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options?.returnObjects) {
        return [];
      }
      if (options?.metric) {
        return `${key}:${options.metric}`;
      }
      if (options?.total !== undefined) {
        return `${key}:${options.total}`;
      }
      if (options?.today !== undefined || options?.upcoming !== undefined) {
        return `${key}:${options.today ?? 0}/${options?.upcoming ?? 0}`;
      }
      if (options?.time) {
        return `${key}:${options.time}`;
      }
      if (options?.count !== undefined) {
        return `${key}:${options.count}`;
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

jest.mock("@/hooks/useOrganizationData", () => ({
  useSessionStatuses: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

const sanitizeTestId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

jest.mock("@/components/ui/kpi-card", () => ({
  KpiCard: ({ title, value, footer }: any) => (
    <div data-testid={`kpi-${sanitizeTestId(String(title))}`}>
      <span data-testid={`kpi-${sanitizeTestId(String(title))}-value`}>{value}</span>
      {footer}
    </div>
  ),
}));

jest.mock("@/components/ui/kpi-presets", () => ({
  getKpiIconPreset: () => ({}),
  KPI_ACTION_BUTTON_CLASS: "kpi-action",
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: any) => (
    <div data-testid="segment-control" data-value={value}>
      {options.map((option: any) => (
        <button
          key={option.value}
          type="button"
          data-testid={`segment-${option.value}`}
          aria-label={option.ariaLabel}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
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
  PageHeaderActions: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/GlobalSearch", () => () => <div data-testid="global-search" />);

jest.mock("@/components/NewSessionDialog", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ViewProjectDialog", () => ({
  ViewProjectDialog: ({ open, project }: any) =>
    open ? <div data-testid="view-project-dialog">{project?.id}</div> : null,
}));

const sessionSheetMock = jest.fn(({ sessionId, isOpen, onOpenChange }: any) =>
  isOpen ? (
    <div data-testid="session-sheet">
      Session Sheet {sessionId}
      <button type="button" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ) : null,
);

jest.mock("@/components/SessionSheetView", () => ({
  __esModule: true,
  default: (props: any) => sessionSheetMock(props),
}));

jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({
    data,
    columns,
    onRowClick,
    emptyState,
    actions,
  }: any) => (
    <div>
      <div data-testid="table-actions">{actions}</div>
      <div data-testid="table-rows">
        {data.length === 0
          ? emptyState
          : data.map((row: any) => (
              <div
                key={row.id}
                data-testid={`row-${row.id}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column: any) => (
                  <div key={column.id} data-testid={`cell-${row.id}-${column.id}`}>
                    {column.render ? column.render(row) : row[column.accessorKey || column.id] || ""}
                  </div>
                ))}
              </div>
            ))}
      </div>
    </div>
  ),
}));

jest.mock("xlsx/xlsx.mjs", () => ({
  writeFileXLSX: jest.fn(),
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
}));

const mockSupabaseFrom = supabase.from as jest.Mock;
const mockUseSessionStatuses = useSessionStatuses as jest.Mock;

const createSessionsQuery = (sessions: any[]) => {
  let orderCalls = 0;
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.order = jest.fn(() => {
    orderCalls += 1;
    if (orderCalls >= 2) {
      return Promise.resolve({ data: sessions, error: null });
    }
    return query;
  });
  return query;
};

const createMaybeSingleQuery = (data: any) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.ilike = jest.fn(() => query);
  query.maybeSingle = jest.fn(() => Promise.resolve({ data, error: null }));
  return query;
};

const setSupabaseResponses = (sessions: any[], archivedStatus: any = null) => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "sessions") {
      return createSessionsQuery(sessions);
    }
    if (table === "project_statuses") {
      return createMaybeSingleQuery(archivedStatus);
    }
    const query: any = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => query);
    query.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
    return query;
  });
};

describe("Upcoming sessions page", () => {
  const RealDate = Date;
  const fixedDate = new RealDate("2024-05-20T12:00:00.000Z");
  const upcomingDate = new RealDate("2024-05-22T00:00:00.000Z").toISOString();
  const pendingDate = new RealDate("2024-05-18T00:00:00.000Z").toISOString();
  const todayDate = new RealDate("2024-05-20T00:00:00.000Z").toISOString();

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
    mockUseSessionStatuses.mockReturnValue({ data: [] });
  });

  const buildSessions = () => [
    {
      id: "session-upcoming",
      lead_id: "lead-1",
      session_date: upcomingDate,
      session_time: "15:00",
      notes: "Upcoming session",
      status: "planned",
      created_at: upcomingDate,
      leads: { id: "lead-1", name: "Alice", status: "active" },
      project_id: "project-1",
      projects: {
        id: "project-1",
        name: "Wedding",
        status_id: "status-active",
        project_status: { id: "status-active", name: "Active", color: "#2563eb" },
      },
    },
    {
      id: "session-pending",
      lead_id: "lead-2",
      session_date: pendingDate,
      session_time: "10:00",
      notes: "Pending session",
      status: "planned",
      created_at: pendingDate,
      leads: { id: "lead-2", name: "Bob", status: "active" },
      project_id: null,
      projects: null,
    },
    {
      id: "session-today",
      lead_id: "lead-3",
      session_date: todayDate,
      session_time: "09:00",
      notes: "Today session",
      status: "active",
      created_at: todayDate,
      leads: { id: "lead-3", name: "Carol", status: "active" },
      project_id: null,
      projects: null,
    },
  ];

  it("renders KPI metrics and table rows after loading sessions", async () => {
    setSupabaseResponses(buildSessions());

    render(<AllSessions />);

    await waitFor(() => {
      expect(screen.getByTestId("row-session-upcoming")).toBeInTheDocument();
      expect(screen.getByTestId("row-session-today")).toBeInTheDocument();
    });

    expect(screen.getByTestId("kpi-sessions-kpis-pastneedsaction-title-value")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-sessions-kpis-schedule-title-value")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-sessions-kpis-inprogress-title-value")).toHaveTextContent("1");
  });

  it("filters sessions when switching segments", async () => {
    setSupabaseResponses(buildSessions());

    render(<AllSessions />);

    await waitFor(() => {
      expect(screen.getByTestId("row-session-upcoming")).toBeInTheDocument();
      expect(screen.getByTestId("row-session-pending")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("segment-pending"));

    await waitFor(() => {
      expect(screen.getByTestId("row-session-pending")).toBeInTheDocument();
      expect(screen.queryByTestId("row-session-upcoming")).not.toBeInTheDocument();
    });
  });

  it("opens the session sheet when a row is clicked", async () => {
    setSupabaseResponses(buildSessions());

    render(<AllSessions />);

    const row = await screen.findByTestId("row-session-today");
    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByTestId("session-sheet")).toHaveTextContent("session-today");
    });
  });
});
