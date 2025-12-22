import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/utils/testUtils";
import GettingStarted from "../GettingStarted";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/useOnboarding";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useOrganizationTrialStatus } from "@/hooks/useOrganizationTrialStatus";
import { useToast } from "@/hooks/use-toast";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationTrialStatus", () => ({
  useOrganizationTrialStatus: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/components/SampleDataModal", () => ({
  SampleDataModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="sample-data-modal">
        <button onClick={onClose}>close-sample</button>
      </div>
    ) : null,
}));

jest.mock("@/components/RestartGuidedModeButton", () => ({
  RestartGuidedModeButton: () => <div data-testid="restart-guided" />,
}));

jest.mock("@/components/ExitGuidanceModeButton", () => ({
  ExitGuidanceModeButton: () => <div data-testid="exit-guided" />,
}));

jest.mock("@/components/GuidedStepProgress", () => ({
  GuidedStepProgress: (props: Record<string, unknown>) => (
    <div data-testid="guided-progress" data-props={JSON.stringify(props)} />
  ),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseOnboarding = useOnboarding as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseProfile = useProfile as jest.Mock;
const mockUseOrganization = useOrganization as jest.Mock;
const mockUseOrganizationSettings = useOrganizationSettings as jest.Mock;
const mockUseOrganizationTrialStatus = useOrganizationTrialStatus as jest.Mock;
const mockUseToast = useToast as jest.Mock;

const buildOnboardingState = (overrides: Partial<ReturnType<typeof mockUseOnboarding>> = {}) => ({
  loading: false,
  isInGuidedSetup: true,
  isOnboardingComplete: false,
  currentStepInfo: { id: 1, route: "/leads", title: "Lead" },
  nextStepInfo: { id: 2, route: "/projects", title: "Project" },
  completedSteps: [],
  isAllStepsComplete: false,
  totalSteps: 5,
  currentStep: 1,
  completeOnboarding: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("GettingStarted page", () => {
  const navigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockUseNavigate.mockReturnValue(navigate);
    mockUseProfile.mockReturnValue({ profile: { full_name: "Test User" } });
    mockUseOrganization.mockReturnValue({
      activeOrganizationId: "org-1",
      activeOrganization: { id: "org-1" },
      loading: false,
      refreshOrganization: jest.fn(),
      setActiveOrganization: jest.fn(),
    });
    mockUseOrganizationSettings.mockReturnValue({
      settings: { preferred_locale: "en" },
      updateSettings: jest.fn().mockResolvedValue({ success: true }),
      refreshSettings: jest.fn(),
    });
    mockUseOrganizationTrialStatus.mockReturnValue({ isTrial: false, daysLeft: null });
    mockUseToast.mockReturnValue({ toast: jest.fn() });
  });

  it("shows loading state while onboarding data is fetching", () => {
    mockUseOnboarding.mockReturnValue(
      buildOnboardingState({
        loading: true,
        completedSteps: [],
        currentStepInfo: null,
        nextStepInfo: null,
      })
    );

    render(<GettingStarted />);

    expect(
      screen.getByText("onboarding.getting_started.loading")
    ).toBeInTheDocument();
  });

  it("shows completion CTA when onboarding already complete", () => {
    const completeState = buildOnboardingState({
      loading: false,
      isInGuidedSetup: false,
      isOnboardingComplete: true,
      isAllStepsComplete: true,
    });
    mockUseOnboarding.mockReturnValue(completeState);

    render(<GettingStarted />);

    expect(
      screen.getByRole("button", {
        name: "onboarding.getting_started.go_to_dashboard",
      })
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("renders current step info and allows navigation to tutorial routes", async () => {
    const state = buildOnboardingState({
      completedSteps: [
        { id: 1, route: "/leads" },
      ],
      currentStepInfo: { id: 2, route: "/leads", title: "Projects" },
      nextStepInfo: { id: 3, route: "/projects", title: "Projects" },
      currentStep: 2,
    });
    mockUseOnboarding.mockReturnValue(state);

    render(<GettingStarted />);

    const progress = screen.getByTestId("guided-progress");
    expect(progress).toHaveAttribute(
      "data-props",
      expect.stringContaining('"currentValue":1')
    );

    const user = userEvent.setup();
    const primaryButton = screen.getByRole("button", {
      name: "onboarding.steps.step_2.button",
    });
    await user.click(primaryButton);

    expect(navigate).toHaveBeenCalledWith("/leads");

    expect(screen.queryByTestId("sample-data-modal")).not.toBeInTheDocument();
    const skipButton = screen.getByRole("button", {
      name: "onboarding.getting_started.skip_setup",
    });
    await user.click(skipButton);
    expect(screen.getByTestId("sample-data-modal")).toBeInTheDocument();

    await user.click(screen.getByText("close-sample"));
    await waitFor(() =>
      expect(screen.queryByTestId("sample-data-modal")).not.toBeInTheDocument()
    );
  });

  it("hides setup progress until the first step is completed", () => {
    const state = buildOnboardingState({
      completedSteps: [],
      currentStepInfo: { id: 1, route: "/leads", title: "Projects" },
      nextStepInfo: { id: 2, route: "/projects", title: "Projects" },
      currentStep: 1,
    });
    mockUseOnboarding.mockReturnValue(state);

    render(<GettingStarted />);

    expect(screen.queryByText("onboarding.getting_started.setup_progress")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guided-progress")).not.toBeInTheDocument();
  });

  it("completes onboarding when finishing guided steps", async () => {
    const completeOnboarding = jest.fn().mockResolvedValue(undefined);
    const state = buildOnboardingState({
      isAllStepsComplete: true,
      completeOnboarding,
    });
    mockUseOnboarding.mockReturnValue(state);

    render(<GettingStarted />);

    const user = userEvent.setup();
    const finishButton = screen.getByRole("button", {
      name: "onboarding.getting_started.go_to_dashboard",
    });

    await user.click(finishButton);

    const modal = await screen.findByRole("dialog");
    await user.click(
      within(modal).getByRole("button", {
        name: /onboarding\.sample_data\.options\.sample\.title/,
      })
    );
    await user.click(
      within(modal).getByRole("button", {
        name: "onboarding.getting_started.go_to_dashboard",
      })
    );

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
