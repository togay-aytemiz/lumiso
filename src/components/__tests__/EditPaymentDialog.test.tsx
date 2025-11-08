import type { ComponentProps, ReactNode, SelectHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { EditPaymentDialog } from "../EditPaymentDialog";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import type { Database } from "@/integrations/supabase/types";

interface FooterActionMock {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface AppSheetModalProps {
  title: string;
  dirty?: boolean;
  children?: ReactNode;
  footerActions?: FooterActionMock[];
  onDirtyClose?: () => void;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

interface SelectItemProps {
  value: string;
  children?: ReactNode;
}

interface NavigationGuardDialogProps {
  open: boolean;
  message?: string;
  onDiscard: () => void;
  onStay: () => void;
  onSaveAndExit?: () => void;
}

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type PaymentUpdatePayload = Database["public"]["Tables"]["payments"]["Update"];

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
  }: AppSheetModalProps) => (
    <div data-testid="app-sheet-modal" data-title={title} data-dirty={dirty ? "dirty" : "clean"}>
      {children}
      {footerActions.map((action, index) => (
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
  Select: ({ value, onValueChange, children, ...rest }: SelectProps) => (
    <select
      data-testid="status-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...rest}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: SelectItemProps) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}));

jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock("../settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message, onDiscard, onStay, onSaveAndExit }: NavigationGuardDialogProps) =>
    open ? (
      <div data-testid="navigation-guard">
        <p>{message}</p>
        <button onClick={onStay}>stay</button>
        {onSaveAndExit && <button onClick={onSaveAndExit}>save-exit</button>}
        <button onClick={onDiscard}>discard</button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date) => void }) => (
    <button data-testid="calendar" onClick={() => onSelect?.(new Date("2024-01-05T00:00:00Z"))}>
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
  warning: jest.fn(),
  info: jest.fn(),
};

const mockHandleModalClose = jest.fn();
const mockHandleDiscard = jest.fn();
const mockHandleStay = jest.fn();
const mockHandleSaveAndExit = jest.fn(async () => {});

const mockUseModalNavigation = useModalNavigation as jest.MockedFunction<typeof useModalNavigation>;
const mockUseI18nToast = useI18nToast as jest.MockedFunction<typeof useI18nToast>;
const mockUseFormsTranslation = useFormsTranslation as jest.MockedFunction<typeof useFormsTranslation>;

const basePayment: PaymentRow = {
  id: "payment-1",
  project_id: "project-9",
  amount: 100,
  description: "Deposit",
  status: "paid",
  date_paid: "2024-01-01",
  created_at: "2024-01-01T00:00:00Z",
  type: "manual",
  deposit_allocation: 0,
};

type SupabaseFromMock = jest.Mock<unknown, [string]>;

interface PaymentTableMock {
  update: jest.Mock<{ eq: jest.Mock<Promise<{ error: null | { message: string } }>, [string, string]> }, [PaymentUpdatePayload]>;
}

interface DefaultTableMock {
  select: jest.Mock<DefaultTableMock, [string?]>;
  insert: jest.Mock<DefaultTableMock, [unknown]>;
  update: jest.Mock<DefaultTableMock, [unknown]>;
  delete: jest.Mock<DefaultTableMock, [unknown]>;
  eq: jest.Mock<DefaultTableMock, [string, unknown]>;
  in: jest.Mock<DefaultTableMock, [string, unknown[]]>;
  order: jest.Mock<DefaultTableMock, [string, { ascending?: boolean }?]>;
  limit: jest.Mock<DefaultTableMock, [number]>;
  single: jest.Mock<Promise<unknown>, []>;
}

const createDefaultFromResponse = (): DefaultTableMock => {
  const table: Partial<DefaultTableMock> = {};
  table.select = jest.fn(() => table as DefaultTableMock);
  table.insert = jest.fn(() => table as DefaultTableMock);
  table.update = jest.fn(() => table as DefaultTableMock);
  table.delete = jest.fn(() => table as DefaultTableMock);
  table.eq = jest.fn(() => table as DefaultTableMock);
  table.in = jest.fn(() => table as DefaultTableMock);
  table.order = jest.fn(() => table as DefaultTableMock);
  table.limit = jest.fn(() => table as DefaultTableMock);
  table.single = jest.fn(async () => undefined);
  return table as DefaultTableMock;
};

const supabaseFromMock = mockSupabaseClient.from as SupabaseFromMock;

const originalFromImplementation: SupabaseFromMock =
  (mockSupabaseClient.from.getMockImplementation() as SupabaseFromMock | undefined) ??
  ((table: string) => createDefaultFromResponse());

describe("EditPaymentDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseFromMock.mockReset();
    supabaseFromMock.mockImplementation(originalFromImplementation);
    mockUseI18nToast.mockReturnValue(toastMock);
    mockUseFormsTranslation.mockReturnValue({ t: (key: string) => key });

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
    supabaseFromMock.mockImplementation(originalFromImplementation);
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
    const eqMock = jest.fn(async () => ({ error: null }));
    const updateMock: PaymentTableMock["update"] = jest.fn(() => ({ eq: eqMock }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "payments") {
        return { update: updateMock } satisfies PaymentTableMock;
      }
      return originalFromImplementation(table);
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

    expect(eqMock).toHaveBeenCalledWith("id", "payment-1");

    expect(toastMock.success).toHaveBeenCalledWith("edit_payment.payment_updated");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPaymentUpdated).toHaveBeenCalled();
  });

  it("switches to due status, removes the paid date, and respects dirty close flow", async () => {
    const eqMock = jest.fn(async () => ({ error: null }));
    const updateMock: PaymentTableMock["update"] = jest.fn(() => ({ eq: eqMock }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "payments") {
        return { update: updateMock } satisfies PaymentTableMock;
      }
      return originalFromImplementation(table);
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
