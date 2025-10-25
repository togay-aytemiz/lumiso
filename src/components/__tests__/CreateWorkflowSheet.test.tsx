import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { CreateWorkflowSheet } from "../CreateWorkflowSheet";
import { useTemplates } from "@/hooks/useTemplates";
import { useModalNavigation } from "@/hooks/useModalNavigation";

jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: jest.fn(),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      if (typeof options?.channel === "string") {
        return `${key}:${options.channel}`;
      }
      if (options?.count !== undefined) {
        return `${key}:${options.count}`;
      }
      return key;
    },
  }),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ isOpen, title, footerActions, children }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="workflow-sheet-modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>
          {footerActions?.map((action: any, index: number) => (
            <button
              key={index}
              disabled={action.disabled}
              onClick={() => action.onClick?.()}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
}));

jest.mock("@/components/settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message }: any) =>
    open ? <div data-testid="navigation-guard">{message}</div> : null,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={event => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

describe("CreateWorkflowSheet", () => {
  const modalNavigationMock = {
    showGuard: false,
    message: "guard-message",
    handleModalClose: jest.fn(() => true),
    handleDiscardChanges: jest.fn(),
    handleStayOnModal: jest.fn(),
    handleSaveAndExit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTemplates as jest.Mock).mockReturnValue({
      sessionTemplates: [
        { id: "template-1", name: "Reminder Template" },
        { id: "template-2", name: "Follow-up Template" },
      ],
      loading: false,
    });
    (useModalNavigation as jest.Mock).mockReturnValue(modalNavigationMock);
  });

  it("prepopulates edit workflow data and submits update flow", async () => {
    const onUpdateWorkflow = jest.fn().mockResolvedValue(undefined);

    render(
      <CreateWorkflowSheet
        onCreateWorkflow={jest.fn()}
        onUpdateWorkflow={onUpdateWorkflow}
        editWorkflow={{
          id: "workflow-1",
          name: "Existing Workflow",
          description: "Existing description",
          trigger_type: "session_completed",
          is_active: false,
          template_id: "template-1",
          reminder_delay_minutes: 4320,
          email_enabled: true,
          whatsapp_enabled: false,
          sms_enabled: true,
        }}
      />
    );

    expect(screen.getByTestId("workflow-sheet-modal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing Workflow")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing description")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "pages:workflows.createDialog.buttons.update" })
    );

    await waitFor(() => {
      expect(onUpdateWorkflow).toHaveBeenCalled();
    });

    expect(onUpdateWorkflow).toHaveBeenCalledWith(
      "workflow-1",
      expect.objectContaining({
        name: "Existing Workflow",
        description: "Existing description",
        trigger_type: "session_completed",
        is_active: false,
        steps: [
          expect.objectContaining({
            action_config: {
              template_id: "template-1",
              channels: ["email", "sms"],
            },
            delay_minutes: 0,
          }),
        ],
      })
    );
  });

  it("shows empty template state when no templates are available", () => {
    (useTemplates as jest.Mock).mockReturnValue({
      sessionTemplates: [],
      loading: false,
    });

    render(<CreateWorkflowSheet onCreateWorkflow={jest.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "pages:workflows.buttons.createWorkflow" })
    );

    expect(screen.getByTestId("workflow-sheet-modal")).toBeInTheDocument();
    expect(
      screen.getByText("pages:workflows.createDialog.fields.template.emptyState")
    ).toBeInTheDocument();
  });
});
