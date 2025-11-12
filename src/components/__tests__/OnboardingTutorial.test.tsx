import { render, screen, fireEvent, waitFor } from "@/utils/testUtils";
import { OnboardingTutorial, TutorialStep } from "../shared/OnboardingTutorial";
import { useTutorialExit } from "@/hooks/useTutorialExit";
import { useTranslation } from "react-i18next";
import React from "react";

type ModalActionMock = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

type BaseOnboardingModalProps = {
  actions: ModalActionMock[];
  children?: React.ReactNode;
} & Record<string, unknown>;

type FloatingCardProps = {
  onNext: () => void;
  onExit: () => void;
  children?: React.ReactNode;
} & Record<string, unknown>;

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: jest.fn(),
  };
});

jest.mock("@/hooks/useTutorialExit", () => ({
  useTutorialExit: jest.fn(),
}));

let latestModalProps: BaseOnboardingModalProps | undefined;
jest.mock("../shared/BaseOnboardingModal", () => ({
  __esModule: true,
  BaseOnboardingModal: (props: BaseOnboardingModalProps) => {
    latestModalProps = props;
    return (
      <div data-testid="base-onboarding-modal">
        {props.actions.map((action, index: number) => (
          <button
            key={index}
            data-testid={`modal-action-${index}`}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
        {props.children}
      </div>
    );
  },
}));

let latestFloatingProps: FloatingCardProps | undefined;
jest.mock("../shared/TutorialFloatingCard", () => ({
  __esModule: true,
  TutorialFloatingCard: (props: FloatingCardProps) => {
    latestFloatingProps = props;
    return (
      <div data-testid="floating-card">
        <button onClick={props.onNext}>Next</button>
        <button onClick={props.onExit}>Exit</button>
      </div>
    );
  },
}));

describe("OnboardingTutorial", () => {
  const navigateMock = jest.fn();
  const handleExitNow = jest.fn();

  const modalSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Welcome",
      description: "Intro content",
      content: <p>Step 1</p>,
      canProceed: true,
      mode: "modal",
    },
    {
      id: 2,
      title: "Next Steps",
      description: "More instructions",
      content: <p>Step 2</p>,
      canProceed: true,
      mode: "modal",
      route: "/dashboard",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    latestModalProps = undefined;
    latestFloatingProps = undefined;

    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, options?: Record<string, unknown>) => {
        const dictionary: Record<string, string> = {
          "onboarding.tutorial.exit_tutorial": "Exit Tutorial",
          "onboarding.tutorial.hold_to_exit": "Hold to exit",
          "onboarding.tutorial.exiting": "Exiting…",
          "onboarding.tutorial.next": "Next",
          "onboarding.tutorial.continue_setup": "Continue setup",
          "onboarding.tutorial.step_title": `Step ${options?.current}/${options?.total} · ${options?.title}`,
        };
        return dictionary[key] ?? key;
      },
    });

    (useTutorialExit as jest.Mock).mockReturnValue({
      isExiting: false,
      handleExitNow,
    });

    const { useNavigate } = jest.requireMock("react-router-dom");
    useNavigate.mockReturnValue(navigateMock);
  });

  it("returns null when tutorial is not visible", () => {
    render(
      <OnboardingTutorial
        steps={modalSteps}
        onComplete={jest.fn()}
        onExit={jest.fn()}
        isVisible={false}
      />
    );

    expect(screen.queryByTestId("base-onboarding-modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("floating-card")).not.toBeInTheDocument();
  });

  it("renders modal flow, handles exit, navigation, and completion", async () => {
    const onComplete = jest.fn();
    const onExit = jest.fn();

    render(
      <OnboardingTutorial
        steps={modalSteps}
        onComplete={onComplete}
        onExit={onExit}
        isVisible
      />
    );

    expect(useTutorialExit).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStepTitle: "Welcome",
        onExitComplete: onExit,
      })
    );

    expect(latestModalProps.title).toBe("Step 1/2 · Welcome");
    expect(screen.getByText("Step 1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("modal-action-0"));
    expect(handleExitNow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("modal-action-1"));

    await waitFor(() => {
      expect(latestModalProps.title).toBe("Step 2/2 · Next Steps");
    });

    expect(navigateMock).toHaveBeenCalledWith(
      "/dashboard?tutorial=true&step=2"
    );

    expect(screen.getByText("Step 2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("modal-action-0"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders floating card when step mode is floating", () => {
    const floatingSteps: TutorialStep[] = [
      {
        id: 1,
        title: "Floating Step",
        description: "Do this inline",
        content: <p>Inline content</p>,
        canProceed: false,
        mode: "floating",
        requiresAction: true,
        disabledTooltip: "Finish prerequisite",
      },
    ];

    render(
      <OnboardingTutorial
        steps={floatingSteps}
        onComplete={jest.fn()}
        onExit={jest.fn()}
        isVisible
      />
    );

    expect(screen.getByTestId("floating-card")).toBeInTheDocument();
    expect(latestFloatingProps.requiresAction).toBe(true);
    expect(latestFloatingProps.canProceed).toBe(false);
  });

  it("resets to provided initial step index", () => {
    render(
      <OnboardingTutorial
        steps={modalSteps}
        onComplete={jest.fn()}
        onExit={jest.fn()}
        isVisible
        initialStepIndex={1}
      />
    );

    expect(latestModalProps.title).toBe("Step 2/2 · Next Steps");
  });
});
