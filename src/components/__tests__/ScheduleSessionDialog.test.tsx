import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScheduleSessionDialog from "../ScheduleSessionDialog";
import { useSessionForm } from "@/hooks/useSessionForm";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";

jest.mock("@/hooks/useSessionForm");
jest.mock("@/hooks/useSessionReminderScheduling");
jest.mock("@/hooks/useWorkflowTriggers");
jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("@/components/SessionSchedulingSheet", () => ({
  SessionSchedulingSheet: ({ isOpen, onOpenChange, onSessionScheduled }: any) => (
    <div data-testid="sheet">
      <span>{isOpen ? "sheet-open" : "sheet-closed"}</span>
      <button onClick={() => onOpenChange(false)}>close</button>
      <button onClick={() => onSessionScheduled?.()}>scheduled</button>
    </div>
  ),
}));

const scheduleSessionRemindersMock = jest.fn();
const triggerSessionScheduledMock = jest.fn();
const submitFormMock = jest.fn();

beforeEach(() => {
  (useSessionForm as jest.Mock).mockReturnValue({
    formData: {
      session_name: "",
      session_date: "",
      session_time: "",
      notes: "",
      location: "",
      project_id: "",
    },
    loading: false,
    isDirty: false,
    isValid: false,
    handleInputChange: jest.fn(),
    resetForm: jest.fn(),
    submitForm: submitFormMock,
  });
  (useSessionReminderScheduling as jest.Mock).mockReturnValue({
    scheduleSessionReminders: scheduleSessionRemindersMock,
  });
  (useWorkflowTriggers as jest.Mock).mockReturnValue({
    triggerSessionScheduled: triggerSessionScheduledMock,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("ScheduleSessionDialog", () => {
  it("opens sheet when enabled button clicked", () => {
    render(<ScheduleSessionDialog leadId="lead-1" leadName="Alice" />);

    fireEvent.click(screen.getByRole("button", { name: "sessions_form.add_session" }));
    expect(screen.getByText("sheet-open")).toBeInTheDocument();
  });

  it("renders disabled tooltip when disabled", () => {
    render(
      <ScheduleSessionDialog
        leadId="lead-1"
        leadName="Alice"
        disabled
        disabledTooltip="Disabled"
      />
    );

    const button = screen.getByRole("button", { name: "sessions_form.add_session" });
    expect(button).toBeDisabled();
    fireEvent.mouseOver(button);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("calls onSessionScheduled callback when sheet reports success", async () => {
    const onSessionScheduled = jest.fn();
    render(
      <ScheduleSessionDialog
        leadId="lead-1"
        leadName="Alice"
        onSessionScheduled={onSessionScheduled}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "sessions_form.add_session" }));
    fireEvent.click(screen.getByText("scheduled"));

    await waitFor(() => expect(onSessionScheduled).toHaveBeenCalled());
  });
});
