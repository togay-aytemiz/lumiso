import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { EditLeadDialog } from "../EditLeadDialog";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { useModalNavigation } from "@/hooks/useModalNavigation";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn(),
}));

type FooterActionMock = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: string;
};

type AppSheetModalMockProps = {
  title: string;
  dirty?: boolean;
  children: ReactNode;
  footerActions?: FooterActionMock[];
  onDirtyClose?: () => void;
  [key: string]: unknown;
};

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    title,
    dirty,
    children,
    footerActions = [],
    onDirtyClose,
  }: AppSheetModalMockProps) => (
    <div data-testid="app-sheet-modal" data-title={title} data-dirty={dirty ? "dirty" : "clean"}>
      {children}
      {footerActions.map((action: FooterActionMock, index: number) => (
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

type SelectMockProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

type SelectItemMockProps = {
  value: string;
  children: ReactNode;
};

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: SelectMockProps) => (
    <select
      data-testid="status-select"
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: SelectItemMockProps) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}));

type NavigationGuardDialogMockProps = {
  open: boolean;
  message: string;
  onDiscard: () => void;
  onStay: () => void;
};

jest.mock("../settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message, onDiscard, onStay }: NavigationGuardDialogMockProps) =>
    open ? (
      <div data-testid="navigation-guard">
        <p>{message}</p>
        <button onClick={onStay}>stay</button>
        <button onClick={onDiscard}>discard</button>
      </div>
    ) : null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

const lead = {
  id: "lead-1",
  name: "Taylor",
  email: "taylor@example.com",
  phone: "+1234567890",
  notes: "Initial notes",
  status: "New",
};

const statuses = [
  { id: "status-1", name: "New", color: "#ff0", is_system_final: false },
  { id: "status-2", name: "In Progress", color: "#0ff", is_system_final: false },
];

const createStatusFetch = () => {
  const order = jest.fn().mockResolvedValue({ data: statuses, error: null });
  const select = jest.fn().mockReturnValue({ order });
  return { select, order };
};

const createDefaultFromResponse = () =>
  ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  }) as Record<string, unknown>;

type SupabaseFromMock = (table: string) => Record<string, unknown>;

const fallbackFrom: SupabaseFromMock = () => createDefaultFromResponse();
const existingFromImplementation = mockSupabaseClient.from.getMockImplementation() as SupabaseFromMock | undefined;
const originalFromImplementation: SupabaseFromMock = existingFromImplementation ?? fallbackFrom;

describe("EditLeadDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (originalFromImplementation) {
      mockSupabaseClient.from.mockImplementation(originalFromImplementation);
    }
    mockSupabaseClient.from.mockClear();
    mockUseI18nToast.mockReturnValue(toastMock);

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

  it("returns null when no lead is provided", () => {
    const { queryByTestId } = render(
      <EditLeadDialog lead={null} open={true} onOpenChange={jest.fn()} onLeadUpdated={jest.fn()} />
    );

    expect(queryByTestId("app-sheet-modal")).toBeNull();
  });

  const renderDialog = (override: Partial<ComponentProps<typeof EditLeadDialog>> = {}) => {
    const defaultProps = {
      lead,
      open: true,
      onOpenChange: jest.fn(),
      onLeadUpdated: jest.fn(),
    } satisfies ComponentProps<typeof EditLeadDialog>;

    return render(<EditLeadDialog {...defaultProps} {...override} />);
  };

  const arrangeSupabaseMocks = () => {
    const { select } = createStatusFetch();
    const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return { select } as Record<string, unknown>;
      }
      if (table === "leads") {
        return { update: updateMock } as Record<string, unknown>;
      }
      return originalFromImplementation(table);
    });

    return { select, updateMock };
  };

  it("prefills fields with the current lead data", async () => {
    const { select } = arrangeSupabaseMocks();

    renderDialog();

    await waitFor(() => {
      expect(select).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    expect(screen.getByLabelText(/labels.name/i)).toHaveValue("Taylor");
    expect(screen.getByLabelText(/labels.email/i)).toHaveValue("taylor@example.com");
    expect(screen.getByLabelText(/labels.notes/i)).toHaveValue("Initial notes");
    expect(screen.getByTestId("status-select")).toHaveValue("New");
  });

  it("updates the lead and forwards callbacks on submit", async () => {
    const { updateMock } = arrangeSupabaseMocks();

    const onOpenChange = jest.fn();
    const onLeadUpdated = jest.fn();

    renderDialog({ onOpenChange, onLeadUpdated });

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    fireEvent.change(screen.getByLabelText(/labels.name/i), { target: { value: "Updated" } });
    fireEvent.change(screen.getByLabelText(/labels.email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "In Progress" } });

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated",
        email: "new@example.com",
        status: "In Progress",
        status_id: "status-2",
      })
    );

    expect(toastMock.success).toHaveBeenCalledWith("forms:messages.leadUpdateSuccess");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onLeadUpdated).toHaveBeenCalled();
  });

  it("keeps the save action disabled when the name is empty", async () => {
    const { updateMock } = arrangeSupabaseMocks();

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    fireEvent.change(screen.getByLabelText(/labels.name/i), { target: { value: " " } });

    expect(screen.getByTestId("footer-action-1")).toBeDisabled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("respects the navigation guard when attempting to close with unsaved changes", async () => {
    arrangeSupabaseMocks();

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    fireEvent.change(screen.getByLabelText(/labels.name/i), { target: { value: "Changed" } });

    fireEvent.click(screen.getByTestId("dirty-close"));

    expect(mockHandleModalClose).toHaveBeenCalled();
  });
});
