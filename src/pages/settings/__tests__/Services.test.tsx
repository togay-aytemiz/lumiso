import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Services from "../Services";
const mockSettingsHeader = jest.fn();
const mockUseOnboarding = jest.fn();
const mockNavigate = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: (props: any) => {
    mockSettingsHeader(props);
    return null;
  },
}));

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/SessionTypesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="session-types-section" />,
}));

jest.mock("@/components/PackagesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="packages-section" />,
}));

jest.mock("@/components/ServicesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="services-section" />,
}));

const mockOnboardingTutorial = jest.fn(
  ({ isVisible, onComplete, onExit }: any) => (
    <div data-testid="onboarding-tutorial" data-visible={isVisible}>
      <button type="button" data-testid="complete-tutorial" onClick={onComplete}>
        complete
      </button>
      <button type="button" data-testid="exit-tutorial" onClick={onExit}>
        exit
      </button>
    </div>
  )
);

jest.mock("@/components/shared/OnboardingTutorial", () => ({
  OnboardingTutorial: (props: any) => mockOnboardingTutorial(props),
}));

describe("Services settings page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOnboarding.mockReturnValue({
      currentStep: 6,
      completeCurrentStep: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows all service management sections and starts the tutorial when on step six", () => {
    render(<Services />);

    expect(screen.getByTestId("settings-page-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("session-types-section")).toBeInTheDocument();
    expect(screen.getByTestId("packages-section")).toBeInTheDocument();
    expect(screen.getByTestId("services-section")).toBeInTheDocument();

    expect(mockSettingsHeader).not.toHaveBeenCalled();

    expect(mockOnboardingTutorial).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
    );
    expect(screen.getByTestId("onboarding-tutorial")).toHaveAttribute(
      "data-visible",
      "true"
    );
  });

  it("completes the tutorial and navigates to getting started", async () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    const completeCurrentStep = jest
      .fn()
      .mockResolvedValue(undefined);

    mockUseOnboarding.mockReturnValue({
      currentStep: 6,
      completeCurrentStep,
    });

    render(<Services />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("complete-tutorial"));
    });

    await waitFor(() => expect(completeCurrentStep).toHaveBeenCalled());

    expect(mockOnboardingTutorial).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false })
    );

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/getting-started");
  });

  it("hides the tutorial without completing when exiting", async () => {
    const completeCurrentStep = jest
      .fn()
      .mockResolvedValue(undefined);

    mockUseOnboarding.mockReturnValue({
      currentStep: 6,
      completeCurrentStep,
    });

    render(<Services />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("exit-tutorial"));
    });

    await waitFor(() =>
      expect(mockOnboardingTutorial).toHaveBeenCalledWith(
        expect.objectContaining({ isVisible: false })
      )
    );
    expect(completeCurrentStep).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
