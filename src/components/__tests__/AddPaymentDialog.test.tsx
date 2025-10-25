import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { AddPaymentDialog } from "../AddPaymentDialog";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useModalNavigation } from "@/hooks/useModalNavigation";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn(),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    title,
    dirty,
    children,
    footerActions = [],
    onDirtyClose,
  }: any) => (
    <div data-testid="app-sheet-modal" data-title={title} data-dirty={dirty ? "dirty" : "clean"}>
      {children}
      {footerActions.map((action: any, index: number) => (
        <button
          key={index}
          data-testid={`footer-action-${index}`}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
      <button type="button" data-testid="dirty-close" onClick={() => onDirtyClose?.()}>
        close-modal
      </button>
    </div>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select data-testid="status-select" value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}));

jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("../settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message, onDiscard, onStay }: any) =>
    open ? (
      <div data-testid="navigation-guard">
        <p>{message}</p>
        <button onClick={onStay}>stay</button>
        <button onClick={onDiscard}>discard</button>
      </div>
    ) : null,
}));

jest.mock("react-calendar", () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (value: Date) => void }) => (
    <button data-testid="calendar-trigger" onClick={() => onChange(new Date("2024-01-02T00:00:00Z"))}>
      pick-date
    </button>
  ),
}));

jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  getUserLocale: jest.fn(() => "en-US"),
  getDateFnsLocale: jest.fn(() => undefined),
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

jest.mock("react-calendar/dist/Calendar.css", () => ({}), { virtual: true });
jest.mock("@/components/react-calendar.css", () => ({}), { virtual: true });

const toastMock = {
  success: jest.fn(),
  error: jest.fn(),
};

const mockHandleModalClose = jest.fn();
const mockHandleDiscard = jest.fn();
const mockHandleStay = jest.fn();
const mockHandleSaveAndExit = jest.fn();

const mockUseModalNavigation = useModalNavigation as jest.Mock;
const mockUseI18nToast = useI18nToast as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
const mockGetUserOrganizationId = getUserOrganizationId as jest.Mock;

const createDefaultFromResponse = () => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
});

const originalFromImplementation = (mockSupabaseClient.from.getMockImplementation() || ((table: string) => createDefaultFromResponse())) as (
  table: string
) => any;

describe("AddPaymentDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockImplementation(originalFromImplementation);
    mockSupabaseClient.from.mockClear();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockUseI18nToast.mockReturnValue(toastMock);
    mockUseFormsTranslation.mockReturnValue({ t: (key: string) => key });
    mockGetUserOrganizationId.mockResolvedValue("org-1");

    mockHandleModalClose.mockReturnValue(true);
    mockHandleDiscard.mockImplementation(() => {});
    mockHandleStay.mockImplementation(() => {});
    mockHandleSaveAndExit.mockImplementation(async () => {});

    mockUseModalNavigation.mockImplementation(() => ({
      showGuard: false,
      message: "guard",
      handleModalClose: mockHandleModalClose,
      handleDiscardChanges: mockHandleDiscard,
      handleStayOnModal: mockHandleStay,
      handleSaveAndExit: mockHandleSaveAndExit,
    }));
  });

  afterEach(() => {
    mockSupabaseClient.from.mockImplementation(originalFromImplementation);
  });

  it("keeps the submit action disabled when no amount is provided", () => {
    render(<AddPaymentDialog projectId="project-1" onPaymentAdded={jest.fn()} />);

    expect(screen.getByTestId("footer-action-1")).toBeDisabled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("submits a new payment, resets the form, and notifies the parent callback", async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "payments") {
        return { insert: insertMock } as any;
      }
      return originalFromImplementation(table);
    });

    const onPaymentAdded = jest.fn();

    render(<AddPaymentDialog projectId="project-42" onPaymentAdded={onPaymentAdded} />);

    fireEvent.change(screen.getByLabelText(/payments.amount_try/i), { target: { value: "123.45" } });
    fireEvent.change(screen.getByLabelText(/payments.description/i), { target: { value: "Booking deposit" } });

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-42",
        user_id: "user-1",
        organization_id: "org-1",
        amount: 123.45,
        description: "Booking deposit",
        status: "paid",
        type: "manual",
        date_paid: expect.any(String),
      })
    );

    expect(toastMock.success).toHaveBeenCalledWith("payments.payment_added_success");
    expect(onPaymentAdded).toHaveBeenCalled();

    await waitFor(() => {
      expect((screen.getByLabelText(/payments.amount_try/i) as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText(/payments.description/i) as HTMLTextAreaElement).value).toBe("");
    });
  });

  it("omits the paid date when the status is switched to due and closes cleanly when dirty close succeeds", async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "payments") {
        return { insert: insertMock } as any;
      }
      return {} as any;
    });

    render(<AddPaymentDialog projectId="project-1" onPaymentAdded={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/payments.amount_try/i), { target: { value: "200" } });
    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "due" } });

    expect(screen.queryByTestId("calendar-trigger")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "due",
        date_paid: null,
      })
    );

    fireEvent.change(screen.getByLabelText(/payments.amount_try/i), { target: { value: "75" } });

    fireEvent.click(screen.getByTestId("dirty-close"));

    expect(mockHandleModalClose).toHaveBeenCalled();
    await waitFor(() => {
      expect((screen.getByLabelText(/payments.amount_try/i) as HTMLInputElement).value).toBe("");
    });
  });
});
