import React from "react";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AllSessions from "../UpcomingSessions";
import { supabase } from "@/integrations/supabase/client";
import { mockSupabaseClient } from "@/utils/testUtils";
import type { KpiCardProps } from "@/components/ui/kpi-card";
import type SessionSheetView from "@/components/SessionSheetView";
import type { SegmentedControlProps } from "@/components/ui/segmented-control";
import type { AdvancedTableColumn } from "@/components/data-table";

type TranslationOptions = {
  returnObjects?: boolean;
  metric?: string;
  total?: number;
  today?: number;
  upcoming?: number;
  time?: string;
  count?: number;
};

interface SessionRow {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  created_at: string;
  leads: {
    id: string;
    name: string;
    status: string;
  };
  project_id: string | null;
  projects:
    | null
    | {
        id: string;
        name: string;
        status_id?: string | null;
        project_status?: { id: string; name: string; color: string } | null;
      };
}

type SessionRows = SessionRow[];

interface ProjectStatusRecord {
  id: string;
  name: string;
}

type SessionsQueryResult = Promise<{ data: SessionRows; error: null }>;

interface SessionsQuery {
  select: jest.Mock<SessionsQuery, [string]>;
  eq: jest.Mock<SessionsQuery, [string, unknown]>;
  order: jest.Mock<SessionsQuery | SessionsQueryResult, [string, { ascending?: boolean }?]>;
}

interface MaybeSingleQuery<T> {
  select: jest.Mock<MaybeSingleQuery<T>, [string]>;
  eq: jest.Mock<MaybeSingleQuery<T>, [string, unknown]>;
  ilike: jest.Mock<MaybeSingleQuery<T>, [string, string]>;
  maybeSingle: jest.Mock<Promise<{ data: T; error: null }>, []>;
}

interface SingleQuery<T> {
  select: jest.Mock<SingleQuery<T>, [string]>;
  eq: jest.Mock<SingleQuery<T>, [string, unknown]>;
  single: jest.Mock<Promise<{ data: T; error: null }>, []>;
}

type SessionStatusResult = {
  id: string;
  name: string;
  color?: string;
  lifecycle?: string | null;
  is_system_initial?: boolean;
};

type SessionSheetViewProps = ComponentProps<typeof SessionSheetView>;
type SessionTableColumn = AdvancedTableColumn<SessionRow>;

interface ViewProjectDialogProps {
  open: boolean;
  project?: { id?: string | null } | null;
}
jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: TranslationOptions) => {
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
  useThrottledRefetchOnFocus: jest.fn<
    void,
    [() => void | Promise<void>, number?]
  >(),
}));

jest.mock("@/hooks/useOrganizationData", () => ({
  useSessionStatuses: jest.fn<{ data?: SessionStatusResult[] }, []>(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn<Promise<string | null>, []>(),
}));

const { useThrottledRefetchOnFocus: useThrottledRefetchOnFocusMock } =
  jest.requireMock("@/hooks/useThrottledRefetchOnFocus") as {
    useThrottledRefetchOnFocus: jest.Mock<
      void,
      [() => void | Promise<void>, number?]
    >;
  };

const { useSessionStatuses: useSessionStatusesMock } = jest.requireMock(
  "@/hooks/useOrganizationData"
) as {
  useSessionStatuses: jest.Mock<{ data?: SessionStatusResult[] }, []>;
};

const { getUserOrganizationId: getUserOrganizationIdMock } = jest.requireMock(
  "@/lib/organizationUtils"
) as {
  getUserOrganizationId: jest.Mock<Promise<string | null>, []>;
};

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...rest}>
      {children}
    </button>
  ),
}));

const sanitizeTestId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

jest.mock("@/components/ui/kpi-card", () => ({
  KpiCard: ({ title, value, footer }: KpiCardProps) => (
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
  SegmentedControl: ({ value, onValueChange, options }: SegmentedControlProps) => (
    <div data-testid="segment-control" data-value={value}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`segment-${option.value}`}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          onClick={() => {
            if (!option.disabled) {
              onValueChange(option.value);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({
    title,
    subtitle,
    children,
  }: PropsWithChildren<{ title?: ReactNode; subtitle?: ReactNode }>) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
  PageHeaderSearch: ({ children }: PropsWithChildren<ReactNode>) => <div>{children}</div>,
  PageHeaderActions: ({ children }: PropsWithChildren<ReactNode>) => <div>{children}</div>,
}));

jest.mock("@/components/GlobalSearch", () => () => <div data-testid="global-search" />);

jest.mock("@/components/NewSessionDialog", () => ({
  __esModule: true,
  default: ({ children }: PropsWithChildren<ReactNode>) => <div>{children}</div>,
}));

jest.mock("@/components/ViewProjectDialog", () => ({
  ViewProjectDialog: ({ open, project }: ViewProjectDialogProps) =>
    open ? <div data-testid="view-project-dialog">{project?.id}</div> : null,
}));

const sessionSheetMock = jest.fn(
  ({ sessionId, isOpen, onOpenChange }: SessionSheetViewProps) =>
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
  default: (props: SessionSheetViewProps) => sessionSheetMock(props),
}));

jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: PropsWithChildren<ReactNode>) => <div>{children}</div>,
  PopoverTrigger: ({ children }: PropsWithChildren<ReactNode>) => <div>{children}</div>,
  PopoverContent: ({ children }: PropsWithChildren<ReactNode>) => <div>{children}</div>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: PropsWithChildren<ReactNode>) => <span>{children}</span>,
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({
    data,
    columns,
    onRowClick,
    emptyState,
    actions,
  }: {
    data: SessionRow[];
    columns: SessionTableColumn[];
    onRowClick?: (row: SessionRow) => void;
    emptyState?: ReactNode;
    actions?: ReactNode;
  }) => (
    <div>
      <div data-testid="table-actions">{actions}</div>
      <div data-testid="table-rows">
        {data.length === 0
          ? emptyState
          : data.map((row) => (
              <div
                key={row.id}
                data-testid={`row-${row.id}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => {
                  const key = (column.accessorKey ?? column.id) as keyof SessionRow;
                  const fallbackValue =
                    key in row ? (row as Record<string, unknown>)[key] ?? "" : "";
                  const cellContent = column.render ? column.render(row) : fallbackValue;
                  return (
                    <div key={column.id} data-testid={`cell-${row.id}-${column.id}`}>
                      {cellContent as ReactNode}
                    </div>
                  );
                })}
              </div>
            ))}
      </div>
    </div>
  ),
}));

jest.mock("xlsx/xlsx.mjs", () => ({
  writeFileXLSX: jest.fn<void, [unknown, unknown?, unknown?]>(),
  utils: {
    json_to_sheet: jest.fn<Record<string, unknown>, [unknown?]>(() => ({})),
    book_new: jest.fn<Record<string, unknown>, []>(() => ({})),
    book_append_sheet: jest.fn<void, [unknown, unknown, string?]>(),
  },
}));

const mockSupabaseFrom = supabase.from as unknown as jest.MockedFunction<
  typeof supabase["from"]
>;

const createSessionsQuery = (sessions: SessionRows): SessionsQuery => {
  let orderCalls = 0;

  const selectMock: SessionsQuery["select"] = jest.fn();
  const eqMock: SessionsQuery["eq"] = jest.fn();
  const orderMock: SessionsQuery["order"] = jest.fn();

  const query: SessionsQuery = {
    select: selectMock,
    eq: eqMock,
    order: orderMock,
  };

  selectMock.mockReturnValue(query);
  eqMock.mockReturnValue(query);
  orderMock.mockImplementation(() => {
    orderCalls += 1;
    if (orderCalls >= 2) {
      return Promise.resolve({ data: sessions, error: null });
    }
    return query;
  });

  return query;
};

const createMaybeSingleQuery = (
  data: ProjectStatusRecord | null
): MaybeSingleQuery<ProjectStatusRecord | null> => {
  const selectMock: MaybeSingleQuery<ProjectStatusRecord | null>["select"] = jest.fn();
  const eqMock: MaybeSingleQuery<ProjectStatusRecord | null>["eq"] = jest.fn();
  const ilikeMock: MaybeSingleQuery<ProjectStatusRecord | null>["ilike"] = jest.fn();
  const maybeSingleMock: MaybeSingleQuery<ProjectStatusRecord | null>["maybeSingle"] =
    jest.fn().mockResolvedValue({ data, error: null });

  const query: MaybeSingleQuery<ProjectStatusRecord | null> = {
    select: selectMock,
    eq: eqMock,
    ilike: ilikeMock,
    maybeSingle: maybeSingleMock,
  };

  selectMock.mockReturnValue(query);
  eqMock.mockReturnValue(query);
  ilikeMock.mockReturnValue(query);

  return query;
};

const createSingleQuery = (): SingleQuery<null> => {
  const selectMock: SingleQuery<null>["select"] = jest.fn();
  const eqMock: SingleQuery<null>["eq"] = jest.fn();
  const singleMock: SingleQuery<null>["single"] = jest.fn().mockResolvedValue({
    data: null,
    error: null,
  });

  const query: SingleQuery<null> = {
    select: selectMock,
    eq: eqMock,
    single: singleMock,
  };

  selectMock.mockReturnValue(query);
  eqMock.mockReturnValue(query);

  return query;
};

const setSupabaseResponses = (
  sessions: SessionRows,
  archivedStatus: ProjectStatusRecord | null = null
) => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "sessions") {
      return createSessionsQuery(sessions);
    }
    if (table === "project_statuses") {
      return createMaybeSingleQuery(archivedStatus);
    }
    return createSingleQuery();
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
      constructor(...args: ConstructorParameters<typeof RealDate>) {
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
    useSessionStatusesMock.mockReturnValue({ data: [] });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
  });

  const buildSessions = (): SessionRows => [
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
