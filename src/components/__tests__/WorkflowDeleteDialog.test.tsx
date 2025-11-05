import type { ReactNode, SVGProps } from "react";
import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { WorkflowDeleteDialog } from "../WorkflowDeleteDialog";
import type { Workflow } from "@/types/workflow";
import * as alertDialogModule from "@/components/ui/alert-dialog";
import { useMessagesTranslation } from "@/hooks/useTypedTranslation";

type AlertDialogMockProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

type AlertDialogSectionProps = {
  children: ReactNode;
};

type AlertDialogButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

jest.mock("lucide-react", () => ({
  AlertTriangle: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="alert-triangle" {...props} />
  )
}));

let latestOnOpenChange: ((open: boolean) => void) | undefined;

jest.mock("@/components/ui/alert-dialog", () => ({
  __esModule: true,
  AlertDialog: ({ open, onOpenChange, children }: AlertDialogMockProps) => {
    latestOnOpenChange = onOpenChange;
    return (
      <div data-testid="alert-dialog" data-open={open}>
        {children}
      </div>
    );
  },
  AlertDialogContent: ({ children }: AlertDialogSectionProps) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: AlertDialogSectionProps) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: AlertDialogSectionProps) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: AlertDialogSectionProps) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: AlertDialogSectionProps) => <p>{children}</p>,
  AlertDialogCancel: ({ children, onClick, disabled }: AlertDialogButtonProps) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick, disabled }: AlertDialogButtonProps) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  __getOnOpenChange: () => latestOnOpenChange
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useMessagesTranslation: jest.fn()
}));

describe("WorkflowDeleteDialog", () => {
  const mockWorkflow: Workflow = {
    id: "workflow-1",
    user_id: "user-1",
    organization_id: "org-1",
    name: "Onboarding Flow",
    description: "",
    trigger_type: "session_scheduled",
    trigger_conditions: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z"
  };

  const mockTranslator = jest.fn((key: string, options?: Record<string, unknown>) =>
    `${key}:${options?.name ?? ""}`
  );

  beforeEach(() => {
    jest.clearAllMocks();
    latestOnOpenChange = undefined;
    (useMessagesTranslation as jest.Mock).mockReturnValue({
      t: mockTranslator
    });
  });

  it("renders workflow name in translation message", () => {
    render(
      <WorkflowDeleteDialog
        open
        workflow={mockWorkflow}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(mockTranslator).toHaveBeenCalledWith("confirm.deleteWithName", { name: "Onboarding Flow" });
    expect(screen.getByText("confirm.deleteWithName:Onboarding Flow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete Workflow" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = jest.fn();

    render(
      <WorkflowDeleteDialog
        open
        workflow={mockWorkflow}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Workflow" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked and when dialog closes", () => {
    const onCancel = jest.fn();

    render(
      <WorkflowDeleteDialog
        open
        workflow={mockWorkflow}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    const { __getOnOpenChange } = alertDialogModule as unknown as {
      __getOnOpenChange: () => ((open: boolean) => void) | undefined;
    };

    act(() => {
      __getOnOpenChange()?.(false);
    });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("disables actions and updates label when deleting", () => {
    render(
      <WorkflowDeleteDialog
        open
        workflow={mockWorkflow}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        isDeleting
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const confirmButton = screen.getByRole("button", { name: "Deleting..." });

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });
});
