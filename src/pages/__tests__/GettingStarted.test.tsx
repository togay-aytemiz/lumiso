import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/utils/testUtils";
import GettingStarted from "../GettingStarted";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useNavigate } from "react-router-dom";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/components/SampleDataModal", () => ({
  SampleDataModal: ({ open, onClose }: any) =>
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
  GuidedStepProgress: (props: any) => (
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

  it("redirects to dashboard when onboarding already complete", () => {
    const completeState = buildOnboardingState({
      loading: false,
      isInGuidedSetup: false,
      isOnboardingComplete: true,
    });
    mockUseOnboarding.mockReturnValue(completeState);

    render(<GettingStarted />);

    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("renders current step info and allows navigation to tutorial routes", async () => {
    const state = buildOnboardingState({
      completedSteps: [
        { id: 99, route: "/completed" },
      ],
      currentStepInfo: { id: 1, route: "/projects", title: "Projects" },
      nextStepInfo: { id: 3, route: "/calendar", title: "Calendar" },
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
      name: "onboarding.steps.step_1.button",
    });
    await user.click(primaryButton);

    expect(navigate).toHaveBeenCalledWith("/projects?tutorial=true");

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

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
