import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SessionSchedulingSheet } from "../SessionSchedulingSheet";

jest.mock("@/hooks/useSessionForm", () => ({
  useSessionForm: jest.fn(),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn().mockReturnValue({
    showGuard: false,
    message: "",
    handleModalClose: jest.fn(() => true),
    handleDiscardChanges: jest.fn(),
    handleStayOnModal: jest.fn(),
    handleSaveAndExit: jest.fn(),
  }),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

jest.mock("@/lib/featureFlags", () => ({
  FEATURE_FLAGS: { sessionWizardV1: "sessionWizardV1" },
  isFeatureEnabled: () => false,
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({ t: (key: string) => key }),
  useCommonTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/SessionFormFields", () => ({
  SessionFormFields: ({ onSessionNameChange, onLocationChange, onNotesChange, onProjectChange }: any) => (
    <div>
      <button onClick={() => onSessionNameChange("Updated Name")}>set-name</button>
      <button onClick={() => onLocationChange("Studio")}>set-location</button>
      <button onClick={() => onNotesChange("Bring props")}>set-notes</button>
      <button onClick={() => onProjectChange("proj-1")}>set-project</button>
    </div>
  ),
}));

jest.mock("@/components/CalendarTimePicker", () => ({
  CalendarTimePicker: ({ onDateStringChange, onTimeChange }: any) => (
    <div>
      <button onClick={() => onDateStringChange("2024-05-01")}>set-date</button>
      <button onClick={() => onTimeChange("14:00")}>set-time</button>
    </div>
  ),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ children, footerActions, onOpenChange }: any) => (
    <div data-testid="sheet-modal">
      {children}
      <button onClick={() => footerActions[1].onClick()}>submit-sheet</button>
      <button onClick={() => onOpenChange(false)}>close-sheet</button>
    </div>
  ),
}));

const useSessionFormMock = require("@/hooks/useSessionForm").useSessionForm as jest.Mock;
let supabaseMock: {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
  storage: { from: jest.Mock };
};

let sessionFormReturn: {
  formData: any;
  loading: boolean;
  isDirty: boolean;
  isValid: boolean;
  handleInputChange: jest.Mock;
  resetForm: jest.Mock;
  submitForm: jest.Mock;
};
let storageBucketMock: {
  remove: jest.Mock;
  upload: jest.Mock;
  getPublicUrl: jest.Mock;
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  const mockedModule = jest.requireMock("@/integrations/supabase/client") as {
    supabase: typeof supabaseMock;
  };
  supabaseMock = mockedModule.supabase;
});

beforeEach(() => {
  sessionFormReturn = {
    formData: {
      session_name: "Initial Session",
      session_date: "2024-04-01",
      session_time: "10:00",
      notes: "Initial notes",
      location: "Initial location",
      project_id: "proj-initial",
    },
    loading: false,
    isDirty: false,
    isValid: true,
    handleInputChange: jest.fn((field: string, value: string) => {
      sessionFormReturn.formData = {
        ...sessionFormReturn.formData,
        [field]: value,
      };
    }),
    resetForm: jest.fn(),
    submitForm: jest.fn(),
  };
  useSessionFormMock.mockReturnValue(sessionFormReturn);

  supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  supabaseMock.rpc.mockReset();
  supabaseMock.rpc.mockResolvedValue({ data: "org-1", error: null });
  supabaseMock.from.mockReset();
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === "projects") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [{ id: "proj-1", name: "Project A" }], error: null })),
            })),
          })),
        })),
      };
    }
    return {};
  });

  storageBucketMock = {
    remove: jest.fn(),
    upload: jest.fn(),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: "https://example.com/logo.png" } })),
  };
  supabaseMock.storage.from.mockReturnValue(storageBucketMock);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("SessionSchedulingSheet", () => {
  const baseProps = {
    leadId: "lead-1",
    leadName: "Alice",
    isOpen: true,
    onOpenChange: jest.fn(),
    onSessionScheduled: jest.fn(),
  };

  it("fetches projects when opened and shows summary", async () => {
    await act(async () => {
      render(<SessionSchedulingSheet {...baseProps} />);
    });

    fireEvent.click(screen.getByText("set-name"));
    fireEvent.click(screen.getByText("set-location"));
    fireEvent.click(screen.getByText("set-notes"));
    fireEvent.click(screen.getByText("set-project"));
    fireEvent.click(screen.getByText("set-date"));
    fireEvent.click(screen.getByText("set-time"));

    await waitFor(() => expect(sessionFormReturn.handleInputChange).toHaveBeenCalled());
    expect(supabaseMock.from).toHaveBeenCalledWith("projects");
    expect(screen.getByText(/sessionScheduling.sessionSummary/)).toBeInTheDocument();
  });

  it("closes sheet and triggers callback on success", async () => {
    const onOpenChange = jest.fn();
    const onSessionScheduled = jest.fn();

    await act(async () => {
      render(
        <SessionSchedulingSheet
          {...baseProps}
          onOpenChange={onOpenChange}
          onSessionScheduled={onSessionScheduled}
        />
      );
    });

    const onSuccess = useSessionFormMock.mock.calls[0][0].onSuccess;
    onSuccess();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSessionScheduled).toHaveBeenCalled();
  });
});
