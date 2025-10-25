import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { EditPaymentDialog } from "../EditPaymentDialog";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useI18nToast } from "@/lib/toastHelpers";
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

jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <button data-testid="calendar" onClick={() => onSelect(new Date("2024-01-05T00:00:00Z"))}>
      pick-date
    </button>
  ),
}));

jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  getDateFnsLocale: jest.fn(() => undefined),
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

const toastMock = {
  success: jest.fn(),
  error: jest.fn(),
};

const mockHandleModalClose = jest.fn();
const mockHandleDiscard = jest.fn();
const mockHandleStay = jest.fn();

const mockUseModalNavigation = useModalNavigation as jest.Mock;
const mockUseI18nToast = useI18nToast as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;

const basePayment = {
  id: "payment-1",
  project_id: "project-9",
  amount: 100,
  description: "Deposit",
  status: "paid" as const,
  date_paid: "2024-01-01",
  created_at: "2024-01-01T00:00:00Z",
  type: "manual" as const,
};

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

describe("EditPaymentDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (originalFromImplementation) {
      mockSupabaseClient.from.mockImplementation(originalFromImplementation);
    }
    mockSupabaseClient.from.mockClear();
    mockUseI18nToast.mockReturnValue(toastMock);
    mockUseFormsTranslation.mockReturnValue({ t: (key: string) => key });

    mockHandleModalClose.mockReturnValue(true);
    mockHandleDiscard.mockImplementation(() => {});
    mockHandleStay.mockImplementation(() => {});

    mockUseModalNavigation.mockImplementation(() => ({
      showGuard: false,
      message: "guard",
      handleModalClose: mockHandleModalClose,
      handleDiscardChanges: mockHandleDiscard,
      handleStayOnModal: mockHandleStay,
    }));
  });

  afterEach(() => {
    if (originalFromImplementation) {
      mockSupabaseClient.from.mockImplementation(originalFromImplementation);
    }
  });

  it("returns null when no payment is provided", () => {
    const { queryByTestId } = render(
      <EditPaymentDialog payment={null} open={true} onOpenChange={jest.fn()} onPaymentUpdated={jest.fn()} />
    );

    expect(queryByTestId("app-sheet-modal")).toBeNull();
  });

  it("pre-fills form fields from the provided payment", () => {
    render(
      <EditPaymentDialog
        payment={basePayment}
        open={true}
        onOpenChange={jest.fn()}
        onPaymentUpdated={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/edit_payment.amount_try/i)).toHaveDisplayValue("100");
    expect(screen.getByLabelText(/edit_payment.description/i)).toHaveValue("Deposit");
    expect(screen.getByTestId("status-select")).toHaveValue("paid");
  });

  it("updates a manual payment and closes when submission succeeds", async () => {
    const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "payments") {
        return { update: updateMock } as any;
      }
      return originalFromImplementation ? originalFromImplementation(table) : ({} as any);
    });

    const onOpenChange = jest.fn();
    const onPaymentUpdated = jest.fn();

    render(
      <EditPaymentDialog
        payment={basePayment}
        open={true}
        onOpenChange={onOpenChange}
        onPaymentUpdated={onPaymentUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText(/edit_payment.amount_try/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/edit_payment.description/i), { target: { value: "Updated" } });

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150,
        description: "Updated",
        status: "paid",
        date_paid: expect.any(String),
      })
    );

    expect(toastMock.success).toHaveBeenCalledWith("edit_payment.payment_updated");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPaymentUpdated).toHaveBeenCalled();
  });

  it("updates base price on related project when editing a base payment", async () => {
    const updatePaymentMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    const updateProjectMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "payments") {
        return { update: updatePaymentMock } as any;
      }
      if (table === "projects") {
        return { update: updateProjectMock } as any;
      }
      return {} as any;
    });

    render(
      <EditPaymentDialog
        payment={{ ...basePayment, type: "base_price" as const }}
        open={true}
        onOpenChange={jest.fn()}
        onPaymentUpdated={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/edit_payment.amount_try/i), { target: { value: "250" } });
    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(updatePaymentMock).toHaveBeenCalled();
    });

    expect(updateProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ base_price: 250 })
    );
  });

  it("switches to due status, removes the paid date, and respects dirty close flow", async () => {
    const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "payments") {
        return { update: updateMock } as any;
      }
      return {} as any;
    });

    render(
      <EditPaymentDialog
        payment={basePayment}
        open={true}
        onOpenChange={jest.fn()}
        onPaymentUpdated={jest.fn()}
      />
    );

    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "due" } });

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "due",
        date_paid: null,
      })
    );

    fireEvent.click(screen.getByTestId("dirty-close"));
    expect(mockHandleModalClose).toHaveBeenCalled();
  });
});
