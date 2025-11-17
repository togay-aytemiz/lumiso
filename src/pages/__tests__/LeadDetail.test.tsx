import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import LeadDetail from "../LeadDetail";
import { useLeadDetailData } from "@/hooks/useLeadDetailData";
import { toast } from "@/hooks/use-toast";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import { useLeadStatusActions } from "@/hooks/useLeadStatusActions";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSessionActions } from "@/hooks/useSessionActions";
import { useParams, useNavigate, useLocation } from "react-router-dom";

jest.mock("@/hooks/useLeadDetailData");
jest.mock("@/hooks/use-toast", () => {
  const toastMock = jest.fn();
  return {
    toast: toastMock,
    useToast: () => ({ toast: toastMock }),
  };
});
jest.mock("@/hooks/useOrganizationQuickSettings", () => ({
  useOrganizationQuickSettings: jest.fn(),
}));
jest.mock("@/hooks/useLeadStatusActions", () => ({
  useLeadStatusActions: jest.fn(),
}));
jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));
jest.mock("@/hooks/useSessionActions", () => ({
  useSessionActions: jest.fn(),
}));

type TranslatorOptions = Record<string, unknown> & { returnObjects?: boolean };
type TranslatorFn = jest.Mock<string | unknown[] | string[], [string, TranslatorOptions?]>;

const createTranslator = (): TranslatorFn =>
  jest.fn((key: string, options?: TranslatorOptions) => {
    if (options?.returnObjects) {
      if (key.includes("intro.sections")) {
        return [
          { title: "Intro One", description: "Intro description" },
          { title: "Intro Two", description: "More intro" },
        ];
      }

      if (key.includes("exploreProjects.points")) {
        return ["point-a", "point-b"];
      }

      if (key.includes("scheduleSession.sections")) {
        return [
          { title: "Schedule", description: "Pick time" },
          { title: "Confirm", description: "Confirm details" },
        ];
      }

      if (key.includes("sessionScheduled.tips")) {
        return ["tip-a", "tip-b"];
      }
    }

    return options ? `${key}:${JSON.stringify(options)}` : key;
  });

const translatorMock = createTranslator();
const formsTranslatorMock = createTranslator();
const commonTranslatorMock = createTranslator();

jest.mock("@/hooks/useTypedTranslation", () => ({
  useMessagesTranslation: () => ({ t: translatorMock }),
  useFormsTranslation: () => ({ t: formsTranslatorMock }),
  useCommonTranslation: () => ({ t: commonTranslatorMock }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: createTranslator() }),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
}));

const mockUseLeadDetailData = useLeadDetailData as jest.MockedFunction<
  typeof useLeadDetailData
>;
const mockToast = toast as jest.Mock;
const mockUseOrganizationQuickSettings =
  useOrganizationQuickSettings as jest.MockedFunction<
    typeof useOrganizationQuickSettings
  >;
const mockUseLeadStatusActions = useLeadStatusActions as jest.MockedFunction<
  typeof useLeadStatusActions
>;
const mockUseOnboarding = useOnboarding as jest.MockedFunction<
  typeof useOnboarding
>;
const mockUseSessionActions = useSessionActions as jest.MockedFunction<
  typeof useSessionActions
>;

const mockUseParams = useParams as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseLocation = useLocation as jest.Mock;

type EntityHeaderMockProps = {
  actions?: ReactNode;
  summaryItems: Array<{ primary: string }>;
};

type ProjectsSectionMockProps = {
  leadId?: string;
  leadName?: string;
  [key: string]: unknown;
};

type LeadActivitySectionMockProps = {
  leadId?: string;
  leadName?: string;
  [key: string]: unknown;
};

type ScheduleSessionDialogProps = {
  onSessionScheduled?: () => void;
};

type LayoutSection = {
  id: string;
  title: ReactNode;
  content: ReactNode;
};

type ProjectDetailsLayoutMockProps = {
  left: ReactNode;
  sections: LayoutSection[];
  rightFooter?: ReactNode;
};

type LeadDetailHookResponse = {
  lead: {
    id: string;
    name: string;
    status: string;
    status_id: string;
    created_at: string;
  } | null;
  leadQuery: {
    isError: boolean;
    isSuccess: boolean;
    error: unknown;
    refetch: jest.Mock<unknown, []>;
  };
  sessions: Array<Record<string, unknown>>;
  sessionsQuery: {
    refetch: jest.Mock<unknown, []>;
    data: unknown[];
    isFetching: boolean;
  };
  projectSummary: { count: number; latestUpdate: string | null };
  aggregatedPayments: { total: number; totalPaid: number; remaining: number; currency: string };
  summaryQuery: { refetch: jest.Mock<unknown, []> };
  latestLeadActivity: unknown;
  latestActivityQuery: { refetch: jest.Mock<unknown, []> };
  leadStatuses: Array<{ id: string; name: string; is_system_final: boolean }>;
  sessionMetrics: {
    todayCount: number;
    todayNext: unknown;
    nextUpcoming: unknown;
    overdueCount: number;
  };
  latestSessionUpdate: unknown;
  hasProjects: boolean;
  isLoading: boolean;
  refetchAll: jest.Mock<unknown, []>;
};

const entityHeaderSpy = jest.fn<void, [EntityHeaderMockProps]>();
const projectsSectionSpy = jest.fn<void, [ProjectsSectionMockProps]>();
const leadActivitySpy = jest.fn<void, [LeadActivitySectionMockProps]>();
let markAsCompletedMock: jest.Mock<void, []>;
let markAsLostMock: jest.Mock<void, []>;

jest.mock("@/components/EntityHeader", () => ({
  EntityHeader: (props: EntityHeaderMockProps) => {
    entityHeaderSpy(props);
    return (
      <div data-testid="entity-header">
        <div data-testid="entity-actions">{props.actions}</div>
      </div>
    );
  },
}));

jest.mock("@/components/ProjectsSection", () => ({
  ProjectsSection: (props: ProjectsSectionMockProps) => {
    projectsSectionSpy(props);
    return <div data-testid="projects-section" />;
  },
}));

jest.mock("@/components/LeadActivitySection", () => ({
  LeadActivitySection: (props: LeadActivitySectionMockProps) => {
    leadActivitySpy(props);
    return <div data-testid="lead-activity" />;
  },
}));

jest.mock("@/components/ScheduleSessionDialog", () => ({
  __esModule: true,
  default: (props: ScheduleSessionDialogProps) => {
    return (
      <button
        data-testid="schedule-session"
        onClick={() => props.onSessionScheduled?.()}
      >
        schedule
      </button>
    );
  },
}));

jest.mock("@/components/EditSessionDialog", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/LeadStatusBadge", () => ({
  LeadStatusBadge: () => <div data-testid="lead-status-badge" />,
}));

jest.mock("@/components/UnifiedClientDetails", () => ({
  UnifiedClientDetails: () => <div data-testid="client-details" />,
}));

jest.mock("@/components/project-details/ProjectDetailsLayout", () => ({
  __esModule: true,
  default: ({ left, sections, rightFooter }: ProjectDetailsLayoutMockProps) => (
    <div data-testid="project-details-layout">
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-sections">
        {sections.map(section => (
          <div key={section.id} data-testid={`section-${section.id}`}>
            <div>{section.title}</div>
            <div>{section.content}</div>
          </div>
        ))}
      </div>
      <div data-testid="layout-footer">{rightFooter}</div>
    </div>
  ),
}));

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: () => null,
}));

jest.mock("@/components/ui/loading-presets", () => ({
  DetailPageLoadingSkeleton: () => <div data-testid="lead-detail-loading" />,
}));

function createLeadDetailResponse(
  overrides: Partial<LeadDetailHookResponse> = {}
): LeadDetailHookResponse {
  const base: LeadDetailHookResponse = {
    lead: {
      id: "lead-1",
      name: "Test Lead",
      status: "New",
      status_id: "status-1",
      created_at: "2024-01-01T00:00:00Z",
    },
    leadQuery: { isError: false, isSuccess: true, error: null, refetch: jest.fn() },
    sessions: [],
    sessionsQuery: { refetch: jest.fn(), data: [], isFetching: false },
    projectSummary: { count: 0, latestUpdate: null },
    aggregatedPayments: { total: 0, totalPaid: 0, remaining: 0, currency: "TRY" },
    summaryQuery: { refetch: jest.fn() },
    latestLeadActivity: null,
    latestActivityQuery: { refetch: jest.fn() },
    leadStatuses: [
      { id: "status-completed", name: "Completed", is_system_final: true },
      { id: "status-lost", name: "Lost", is_system_final: true },
    ],
    sessionMetrics: {
      todayCount: 0,
      todayNext: null,
      nextUpcoming: null,
      overdueCount: 0,
    },
    latestSessionUpdate: null,
    hasProjects: false,
    isLoading: false,
    refetchAll: jest.fn(),
  };

  return { ...base, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockUseParams.mockReturnValue({ id: "lead-1" });
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseLocation.mockReturnValue({ state: {} });

  mockUseOrganizationQuickSettings.mockReturnValue({
    settings: { show_quick_status_buttons: true },
    loading: false,
  });

  markAsCompletedMock = jest.fn();
  markAsLostMock = jest.fn();
  mockUseLeadStatusActions.mockReturnValue({
    markAsCompleted: markAsCompletedMock,
    markAsLost: markAsLostMock,
    isUpdating: false,
  });

  mockUseOnboarding.mockReturnValue({
    currentStep: 0,
    completeCurrentStep: jest.fn(),
    completeMultipleSteps: jest.fn(),
  });

  mockUseSessionActions.mockReturnValue({ deleteSession: jest.fn() });
});

describe("LeadDetail", () => {
  it("renders loading skeleton while data is loading", () => {
    mockUseLeadDetailData.mockReturnValue(
      createLeadDetailResponse({
        isLoading: true,
      })
    );

    render(<LeadDetail />);

    expect(screen.getByTestId("lead-detail-loading")).toBeInTheDocument();
    expect(entityHeaderSpy).not.toHaveBeenCalled();
  });

  it("renders lead content and summary once data loads", () => {
    const response = createLeadDetailResponse();
    mockUseLeadDetailData.mockReturnValue(response);

    render(<LeadDetail />);

    expect(screen.getByTestId("entity-header")).toBeInTheDocument();
    const summaryItems = entityHeaderSpy.mock.calls[0][0].summaryItems;
    expect(summaryItems).toHaveLength(4);
    expect(summaryItems[0].primary).toBe("leadDetail.header.projects.none");
    expect(summaryItems[1].primary).toBe("leadDetail.header.payments.primaryZero");
    expect(summaryItems[2].primary).toBe("leadDetail.header.sessions.none");
    expect(summaryItems[3].primary).toBe("leadDetail.header.activity.none");

    expect(projectsSectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-1", leadName: "Test Lead" })
    );
    expect(leadActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-1", leadName: "Test Lead" })
    );

    fireEvent.click(screen.getByText("Completed"));
    fireEvent.click(screen.getByText("Lost"));
    expect(markAsCompletedMock).toHaveBeenCalledTimes(1);
    expect(markAsLostMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByTestId("schedule-session")[0]);
    expect(response.refetchAll).toHaveBeenCalledTimes(1);
  });

  it("surfaces fetch errors and navigates back to lead list", async () => {
    const navigate = jest.fn();
    mockUseNavigate.mockReturnValue(navigate);
    mockUseLeadDetailData.mockReturnValue(
      createLeadDetailResponse({
        lead: null,
        isLoading: false,
        leadQuery: { isError: true, isSuccess: false, error: new Error("Boom") },
      })
    );

    render(<LeadDetail />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "leadDetail.toast.fetchLeadTitle" })
      );
      expect(navigate).toHaveBeenCalledWith("/leads");
    });
  });
});
