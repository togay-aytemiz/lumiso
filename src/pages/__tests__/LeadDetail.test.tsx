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
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }));
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

const createTranslator = () =>
  jest.fn((key: string, options?: Record<string, unknown>) => {
    if (options && (options as any).returnObjects) {
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

const entityHeaderSpy = jest.fn();
const projectsSectionSpy = jest.fn();
const leadActivitySpy = jest.fn();
let markAsCompletedMock: jest.Mock;
let markAsLostMock: jest.Mock;

jest.mock("@/components/EntityHeader", () => ({
  EntityHeader: (props: any) => {
    entityHeaderSpy(props);
    return (
      <div data-testid="entity-header">
        <div data-testid="entity-actions">{props.actions}</div>
      </div>
    );
  },
}));

jest.mock("@/components/ProjectsSection", () => ({
  ProjectsSection: (props: any) => {
    projectsSectionSpy(props);
    return <div data-testid="projects-section" />;
  },
}));

jest.mock("@/components/LeadActivitySection", () => ({
  LeadActivitySection: (props: any) => {
    leadActivitySpy(props);
    return <div data-testid="lead-activity" />;
  },
}));

jest.mock("@/components/ScheduleSessionDialog", () => ({
  __esModule: true,
  default: (props: any) => {
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
  default: ({ left, sections, rightFooter }: any) => (
    <div data-testid="project-details-layout">
      <div data-testid="layout-left">{left}</div>
      <div data-testid="layout-sections">
        {sections.map((section: any) => (
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
  overrides: Partial<ReturnType<typeof useLeadDetailData>> = {}
) {
  const base = {
    lead: {
      id: "lead-1",
      name: "Test Lead",
      status: "New",
      status_id: "status-1",
      created_at: "2024-01-01T00:00:00Z",
    },
    leadQuery: { isError: false, isSuccess: true, error: null, refetch: jest.fn() },
    sessions: [] as any[],
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
  } as any;

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

    fireEvent.click(screen.getByTestId("schedule-session"));
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
