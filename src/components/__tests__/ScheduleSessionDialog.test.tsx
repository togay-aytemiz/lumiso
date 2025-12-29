import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import ScheduleSessionDialog from "../ScheduleSessionDialog";
import { useSessionForm } from "@/hooks/useSessionForm";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";

jest.mock("@/hooks/useSessionForm", () => ({
  useSessionForm: jest.fn(),
}));
jest.mock("@/hooks/useSessionReminderScheduling", () => ({
  useSessionReminderScheduling: jest.fn(),
}));
jest.mock("@/hooks/useWorkflowTriggers", () => ({
  useWorkflowTriggers: jest.fn(),
}));
jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
type TooltipMockProps = {
  children?: ReactNode;
};

type SessionSchedulingSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionScheduled?: () => void;
};

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: TooltipMockProps) => <div>{children}</div>,
  Tooltip: ({ children }: TooltipMockProps) => <div>{children}</div>,
  TooltipTrigger: ({ children }: TooltipMockProps) => <div>{children}</div>,
  TooltipContent: ({ children }: TooltipMockProps) => <div>{children}</div>,
  TooltipContentDark: ({ children }: TooltipMockProps) => <div>{children}</div>,
}));
jest.mock("@/components/SessionSchedulingSheet", () => ({
  SessionSchedulingSheet: ({ isOpen, onOpenChange, onSessionScheduled }: SessionSchedulingSheetProps) => (
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

    fireEvent.click(screen.getByRole("button", { name: "sessions.schedule_new" }));
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

    const button = screen.getByRole("button", { name: "sessions.schedule_new" });
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

    fireEvent.click(screen.getByRole("button", { name: "sessions.schedule_new" }));
    fireEvent.click(screen.getByText("scheduled"));

    await waitFor(() => expect(onSessionScheduled).toHaveBeenCalled());
  });

  it("shows onboarding video modal when tutorialMode is enabled", () => {
    render(<ScheduleSessionDialog leadId="lead-1" leadName="Alice" tutorialMode />);

    fireEvent.click(screen.getByRole("button", { name: "sessions.schedule_new" }));

    const iframe = screen.getByTitle("Watch how to plan a session");
    expect(iframe).toHaveAttribute("src", "https://www.youtube.com/embed/na7ByGdB6Mg");

    fireEvent.click(screen.getByText("Skip for now"));

    expect(screen.queryByTitle("Watch how to plan a session")).not.toBeInTheDocument();
  });
});
