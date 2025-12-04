import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { BaseOnboardingModal, OnboardingAction } from "../shared/BaseOnboardingModal";
import React from "react";

const longPressSpy = jest.fn();

type DialogProps = {
  children: ReactNode;
};

jest.mock("@/components/ui/dialog", () => ({
  __esModule: true,
  Dialog: ({ children }: DialogProps) => <div data-testid="dialog-root">{children}</div>,
  DialogContent: ({ children }: DialogProps) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: DialogProps) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: DialogProps) => <h2>{children}</h2>,
  DialogDescription: ({ children }: DialogProps) => <p>{children}</p>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

type LongPressButtonProps = {
  onConfirm?: () => void;
  label: string;
  duration?: number;
  holdingLabel?: string;
  completeLabel?: string;
  disabled?: boolean;
  className?: string;
};

jest.mock("@/components/ui/long-press-button", () => ({
  LongPressButton: (props: LongPressButtonProps) => {
    longPressSpy(props);
    return (
      <button
        type="button"
        data-testid="long-press"
        onClick={() => props.onConfirm?.()}
        disabled={props.disabled}
        className={props.className}
      >
        {props.label}
      </button>
    );
  },
}));

describe("BaseOnboardingModal", () => {
  beforeEach(() => {
    longPressSpy.mockClear();
  });

  it("renders title, description, eyebrow, children, and regular actions", () => {
    const handlePrimary = jest.fn();
    const actions: OnboardingAction[] = [
      {
        label: "Secondary Action",
        onClick: jest.fn(),
        variant: "outline",
      },
      {
        label: "Primary Action",
        onClick: handlePrimary,
      },
    ];

    render(
      <BaseOnboardingModal
        open
        onClose={jest.fn()}
        title="Modal Title"
        description="Helpful description"
        eyebrow={<span>Eyebrow Text</span>}
        actions={actions}
      >
        <div>Custom content</div>
      </BaseOnboardingModal>
    );

    expect(screen.getByText("Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Eyebrow Text")).toBeInTheDocument();
    expect(screen.getByText("Helpful description")).toBeInTheDocument();
    expect(screen.getByText("Custom content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Primary Action" }));
    expect(handlePrimary).toHaveBeenCalledTimes(1);
  });

  it("renders long-press actions with provided configuration", () => {
    const onConfirm = jest.fn();
    const actions: OnboardingAction[] = [
      {
        label: "Hold to confirm",
        onClick: onConfirm,
        longPress: {
          duration: 2500,
          holdingLabel: "Holding…",
          completeLabel: "Done",
        },
        disabled: false,
      },
    ];

    render(
      <BaseOnboardingModal
        open
        onClose={jest.fn()}
        title="Modal Title"
        description="Description"
        actions={actions}
      />
    );

    expect(longPressSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onConfirm,
        label: "Hold to confirm",
        duration: 2500,
        holdingLabel: "Holding…",
        completeLabel: "Done",
        disabled: false,
        className: "h-11 w-full sm:w-auto sm:min-w-[200px] whitespace-normal text-center leading-snug",
      })
    );

    fireEvent.click(screen.getByTestId("long-press"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
