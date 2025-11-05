import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { TutorialFloatingCard } from "../shared/TutorialFloatingCard";

const longPressMock = jest.fn();

type ButtonMockProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

type WithChildren = {
  children: ReactNode;
  className?: string;
};

type TooltipContentProps = {
  children: ReactNode;
};

type LongPressButtonProps = {
  onConfirm?: () => void;
  label: string;
  holdingLabel: string;
  completeLabel: string;
  className?: string;
  [key: string]: unknown;
};

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: ButtonMockProps) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: WithChildren) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: WithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: WithChildren) => <h3>{children}</h3>,
  CardContent: ({ children }: WithChildren) => <div>{children}</div>,
}));

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: WithChildren) => <>{children}</>,
  Tooltip: ({ children }: WithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: WithChildren) => <>{children}</>,
  TooltipContent: ({ children }: TooltipContentProps) => <div data-testid="tooltip-content">{children}</div>,
}));

jest.mock("@/components/ui/long-press-button", () => ({
  LongPressButton: (props: LongPressButtonProps) => {
    longPressMock(props);
    return (
      <button
        type="button"
        data-testid="long-press-exit"
        onClick={() => props.onConfirm?.()}
        className={props.className}
      >
        {props.label}
      </button>
    );
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const dictionary: Record<string, string> = {
        "onboarding.tutorial.step_of": `${options?.current}/${options?.total}`,
        "onboarding.tutorial.exit_tutorial": "Exit Tutorial",
        "onboarding.tutorial.hold_to_exit": "Hold to exit",
        "onboarding.tutorial.exiting": "Exiting…",
        "onboarding.tutorial.next": "Next",
        "onboarding.tutorial.complete": "Complete",
      };
      return dictionary[key] ?? key;
    },
  }),
}));

describe("TutorialFloatingCard", () => {
  beforeEach(() => {
    longPressMock.mockClear();
  });

  it("renders tutorial step info and handles next/exit actions", () => {
    const onNext = jest.fn();
    const onExit = jest.fn();

    render(
      <TutorialFloatingCard
        stepNumber={1}
        totalSteps={3}
        title="Welcome"
        description="Introduction"
        canProceed
        onNext={onNext}
        onExit={onExit}
      />
    );

    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Introduction")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("long-press-exit"));
    expect(onExit).toHaveBeenCalledTimes(1);

    expect(longPressMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onConfirm: onExit,
        label: "Exit Tutorial",
        holdingLabel: "Hold to exit",
        completeLabel: "Exiting…",
      })
    );
  });

  it("disables next button and shows tooltip when action required", () => {
    render(
      <TutorialFloatingCard
        stepNumber={2}
        totalSteps={3}
        title="Connect Calendar"
        description="Please connect your calendar before proceeding."
        canProceed={false}
        requiresAction
        disabledTooltip="Complete the prerequisite"
        onNext={jest.fn()}
        onExit={jest.fn()}
        position="bottom-left"
      />
    );

    const container = screen.getByText("Connect Calendar").closest("div");
    expect(container?.parentElement?.parentElement).toHaveClass("fixed bottom-4 left-4 z-50");

    const nextButton = screen.getByRole("button", { name: "Next" });
    expect(nextButton).toBeDisabled();
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent(
      "Complete the prerequisite"
    );
  });

  it("renders complete label on last step", () => {
    render(
      <TutorialFloatingCard
        stepNumber={3}
        totalSteps={3}
        title="Finish"
        description="All done!"
        canProceed
        onNext={jest.fn()}
        onExit={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
  });
});
