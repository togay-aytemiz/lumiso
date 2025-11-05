import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@/utils/testUtils";
import { TutorialExitGuardDialog } from "../shared/TutorialExitGuardDialog";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

type AlertDialogWrapperProps = {
  open: boolean;
  children: ReactNode;
};

type AlertDialogSimpleProps = {
  children: ReactNode;
};

type AlertDialogActionProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

jest.mock("@/components/ui/alert-dialog", () => ({
  __esModule: true,
  AlertDialog: ({ children, open }: AlertDialogWrapperProps) => (
    <div data-testid="alert-dialog" data-open={open}>
      {children}
    </div>
  ),
  AlertDialogContent: ({ children }: AlertDialogSimpleProps) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: AlertDialogSimpleProps) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: AlertDialogSimpleProps) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: AlertDialogSimpleProps) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: AlertDialogSimpleProps) => <p>{children}</p>,
  AlertDialogCancel: ({ children, onClick }: AlertDialogActionProps) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick, disabled, ...rest }: AlertDialogActionProps) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

describe("TutorialExitGuardDialog", () => {
  const translations: Record<string, string> = {
    "tutorial.exitTitle": "Exit tutorial?",
    "tutorial.exitMessage": "You will lose progress.",
    "tutorial.stay": "Stay",
    "tutorial.returnToGettingStarted": "Return to Getting Started",
  };

  beforeEach(() => {
    (useFormsTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => translations[key] ?? key,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders translation strings and handles stay/exit actions", () => {
    const onStay = jest.fn();
    const onReturn = jest.fn();

    render(
      <TutorialExitGuardDialog
        open
        onStay={onStay}
        onReturnToGettingStarted={onReturn}
      />
    );

    expect(screen.getByText("Exit tutorial?")).toBeInTheDocument();
    expect(screen.getByText("You will lose progress.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Return to Getting Started" })
    );

    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("disables destructive action when processing", () => {
    render(
      <TutorialExitGuardDialog
        open
        onStay={jest.fn()}
        onReturnToGettingStarted={jest.fn()}
        isProcessing
      />
    );

    const destructive = screen.getByRole("button", {
      name: "Return to Getting Started",
    });
    expect(destructive).toBeDisabled();
    expect(destructive).toHaveAttribute("aria-disabled", "true");
  });
});
