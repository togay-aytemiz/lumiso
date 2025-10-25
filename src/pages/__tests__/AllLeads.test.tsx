import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AllLeads from "../AllLeads";
import { mockSupabaseClient } from "@/utils/testUtils";
import { toast } from "@/hooks/use-toast";
import { useLeadTableColumns } from "@/hooks/useLeadTableColumns";
import { useLeadsFilters } from "@/pages/leads/hooks/useLeadsFilters";
import { useLeadsData } from "@/pages/leads/hooks/useLeadsData";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/components/GlobalSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="global-search" />,
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header">{children}</div>
  ),
  PageHeaderSearch: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header-search">{children}</div>
  ),
}));

jest.mock("@/components/ui/button", () => {
  const React = require("react");
  const states: boolean[] = (globalThis as any).__buttonStates || [];
  (globalThis as any).__buttonStates = states;
  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => {
      states.push(Boolean(props.disabled));
      return (
        <button ref={ref} {...props}>
          {children}
        </button>
      );
    }
  );
  Button.displayName = "Button";
  return {
    __esModule: true,
    Button,
    buttonStates: states,
  };
});
const buttonStates: boolean[] = (globalThis as any).__buttonStates;

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="skeleton">{children}</div>
  ),
}));

jest.mock("@/components/ui/kpi-card", () => ({
  KpiCard: ({ title, value, actions }: any) => (
    <div data-testid="kpi-card">
      <span>{title}</span>
      <span>{value}</span>
      {actions}
    </div>
  ),
}));

jest.mock("@/components/ui/loading-presets", () => ({
  TableLoadingSkeleton: () => <div data-testid="table-loading" />,
}));

jest.mock("@/components/EnhancedAddLeadDialog", () => ({
  EnhancedAddLeadDialog: ({ onSuccess, onOpenChange, open }: any) => (
    <div data-testid="enhanced-add-lead-dialog" data-open={open}>
      <button onClick={() => onOpenChange(false)}>close-dialog</button>
      <button onClick={() => onSuccess?.()}>success-dialog</button>
    </div>
  ),
}));

jest.mock("@/components/data-table", () => ({
  AdvancedDataTable: ({ actions, data, onRowClick }: any) => (
    <div data-testid="advanced-data-table">
      <div data-testid="data-table-actions">{actions}</div>
      <button
        type="button"
        onClick={() => onRowClick?.(data[0])}
        disabled={!data?.length}
      >
        open-row
      </button>
    </div>
  ),
}));

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: ({ isVisible, onComplete }: any) => (
    isVisible ? (
      <button onClick={onComplete}>complete-tutorial</button>
    ) : null
  ),
}));

jest.mock("@/hooks/useLeadTableColumns", () => ({
  useLeadTableColumns: jest.fn(),
}));

jest.mock("@/pages/leads/hooks/useLeadsFilters", () => ({
  useLeadsFilters: jest.fn(),
}));

jest.mock("@/pages/leads/hooks/useLeadsData", () => ({
  useLeadsData: jest.fn(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/useThrottledRefetchOnFocus", () => ({
  useThrottledRefetchOnFocus: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && "count" in options) {
        return `${key}:${options.count}`;
      }
      if (options && "visible" in options && "total" in options) {
        return `${key}:${options.visible}/${options.total}`;
      }
      if (options && "status" in options) {
        return `${key}:${options.status}`;
      }
      if (options && "statuses" in options) {
        return `${key}:${options.statuses}`;
      }
      return key;
    },
  }),
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock("lucide-react", () => {
  const Icon = ({ name }: { name: string }) => <span data-icon={name} />;
  const createIcon = (name: string) => (props: any) => <Icon name={name} {...props} />;
  return {
    Plus: createIcon("Plus"),
    Filter: createIcon("Filter"),
    FileDown: createIcon("FileDown"),
    Loader2: createIcon("Loader2"),
    Calendar: createIcon("Calendar"),
    MessageSquare: createIcon("MessageSquare"),
    Users: createIcon("Users"),
    FileText: createIcon("FileText"),
    TrendingUp: createIcon("TrendingUp"),
    AlertCircle: createIcon("AlertCircle"),
    XCircle: createIcon("XCircle"),
  };
});

jest.mock("xlsx/xlsx.mjs", () => ({
  writeFileXLSX: jest.fn(),
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
}));

jest.mock("date-fns", () => ({
  format: () => "2023-05-01_1200",
}));

const mockUseLeadTableColumns = useLeadTableColumns as jest.Mock;
const mockUseLeadsFilters = useLeadsFilters as jest.Mock;
const mockUseLeadsData = useLeadsData as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseOrganization = useOrganization as jest.Mock;
const mockUseThrottledRefetchOnFocus = useThrottledRefetchOnFocus as jest.Mock;
const mockToast = toast as jest.Mock;

describe("AllLeads", () => {
  let fetchLeadsDataMock: jest.Mock;
  let refetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          { id: "status-1", name: "New", color: "#111" },
          { id: "status-2", name: "Warm", color: "#222" },
        ],
        error: null,
      }),
    }));

    buttonStates.length = 0;

    mockUseLeadTableColumns.mockReturnValue({
      advancedColumns: [
        {
          id: "name",
          label: "Name",
          accessor: (lead: any) => lead.name,
        },
      ],
      fieldDefinitions: [
        {
          field_key: "custom_field",
          label: "Custom Field",
          type: "text",
        },
      ],
      sortAccessors: {
        updated_at: (lead: any) => lead.updated_at ?? "",
      },
      loading: false,
    });

    mockUseLeadsFilters.mockReturnValue({
      state: {
        status: ["New"],
        customFields: {},
      },
      filtersConfig: { onReset: jest.fn() },
      activeCount: 1,
    });

    fetchLeadsDataMock = jest.fn().mockResolvedValue({ leads: [] });
    refetchMock = jest.fn().mockResolvedValue(undefined);

    mockUseLeadsData.mockImplementation((args) => ({
      pageLeads: [
        {
          id: "lead-1",
          name: "Lead One",
          created_at: "2023-04-01T00:00:00Z",
          updated_at: "2023-04-02T00:00:00Z",
          status: "New",
          lead_statuses: { name: "New", is_system_final: false },
        },
      ],
      metricsLeads: [
        {
          id: "lead-1",
          name: "Lead One",
          created_at: "2023-04-01T00:00:00Z",
          updated_at: "2023-04-02T00:00:00Z",
          status: "New",
          lead_statuses: { name: "New", is_system_final: false },
        },
      ],
      totalCount: 1,
      initialLoading: false,
      tableLoading: false,
      refetch: refetchMock,
      fetchLeadsData: fetchLeadsDataMock,
    }));

    mockUseOnboarding.mockReturnValue({
      currentStep: 0,
      completeCurrentStep: jest.fn().mockResolvedValue(undefined),
    });

    mockUseOrganization.mockReturnValue({
      activeOrganizationId: "org-1",
    });

    mockUseThrottledRefetchOnFocus.mockImplementation(() => {});

    mockToast.mockReset();

    (mockSupabaseClient.from as jest.Mock).mockClear();
  });

  it("passes selected status ids from filters into the leads data request", async () => {
    render(<AllLeads />);

    await waitFor(() => {
      expect(
        mockUseLeadsData.mock.calls.some(([args]) =>
          Array.isArray(args.statusIds) && args.statusIds.includes("status-1")
        )
      ).toBe(true);
    });

    expect(mockUseLeadsData.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        customFieldFilters: {},
      })
    );
  });

  it("disables the export button while exporting and re-enables after completion", async () => {
    fetchLeadsDataMock.mockResolvedValue({ leads: [] });

    render(<AllLeads />);

    const exportButton = await screen.findByRole("button", { name: "leads.export.button" });

    expect(buttonStates[0]).toBe(false);
    expect(exportButton).not.toBeDisabled();

    act(() => {
      fireEvent.click(exportButton);
    });

    expect(fetchLeadsDataMock).toHaveBeenCalledWith({ from: 0, to: 0, includeCount: false });
    expect(buttonStates).toContain(true);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "leads.export.successTitle" })
      )
    );

    await waitFor(() => expect(buttonStates[buttonStates.length - 1]).toBe(false));
  });

  it("completes the tutorial and navigates back to getting started", async () => {
    const completeCurrentStep = jest.fn().mockResolvedValue(undefined);
    mockUseOnboarding.mockReturnValue({
      currentStep: 2,
      completeCurrentStep,
    });

    render(<AllLeads />);

    const completeButton = await screen.findByText("complete-tutorial");
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(completeCurrentStep).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/getting-started");
    });
  });
});
