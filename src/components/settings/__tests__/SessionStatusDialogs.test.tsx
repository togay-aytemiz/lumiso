import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { AddSessionStatusDialog, EditSessionStatusDialog } from "../SessionStatusDialogs";

const supabaseAuthGetUserMock = jest.fn();
const supabaseFromMock = jest.fn();
const getUserOrganizationIdMock = jest.fn();
const toastMock = jest.fn();
const useModalNavigationMock = jest.fn();

type FooterActionMock = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type AppSheetModalMockProps = {
  title: string;
  isOpen: boolean;
  children: ReactNode;
  footerActions?: FooterActionMock[];
};

type SegmentedControlOption = {
  value: string;
  label: ReactNode;
};

type SegmentedControlMockProps = {
  value: string;
  onValueChange: (value: string) => void;
  options?: SegmentedControlOption[];
};

type ModalNavigationArgs = {
  onDiscard?: () => void;
  onSaveAndExit?: () => void;
};

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => supabaseAuthGetUserMock(...args),
    },
    from: (...args: unknown[]) => supabaseFromMock(...args),
  },
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: (...args: unknown[]) => getUserOrganizationIdMock(...args),
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: (...args: unknown[]) => useModalNavigationMock(...args),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ title, isOpen, children, footerActions }: AppSheetModalMockProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="app-sheet-modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>
          {footerActions?.map(action => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
}));

jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({ value, onValueChange, options }: SegmentedControlMockProps) => (
    <div>
      <div data-testid="lifecycle-value">{value}</div>
      {options?.map(option => (
        <button
          type="button"
          key={option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("../NavigationGuardDialog", () => ({
  NavigationGuardDialog: () => null,
}));

const translations: Record<string, string> = {
  "forms:session_status.add_title": "Add session status",
  "forms:session_status.edit_title": "Edit session status",
  "forms:session_status.name_label": "Status name",
  "forms:session_status.name_placeholder": "Name placeholder",
  "forms:session_status.name_help": "Name help",
  "forms:session_status.color_label": "Status color",
  "forms:session_status.lifecycle.label": "Lifecycle",
  "forms:session_status.lifecycle.active": "Active",
  "forms:session_status.lifecycle.completed": "Completed",
  "forms:session_status.lifecycle.cancelled": "Cancelled",
  "forms:session_status.lifecycle.help.title": "Lifecycle help",
  "forms:session_status.lifecycle.help.active": "Active help",
  "forms:session_status.lifecycle.help.completed": "Completed help",
  "forms:session_status.lifecycle.help.cancelled": "Cancelled help",
  "forms:session_status.errors.name_required": "Name is required",
  "forms:session_status.success.added": "Status created",
  "forms:session_status.success.updated": "Status updated",
  "forms:session_status.success.deleted": "Status deleted",
  "forms:session_status.errors.cannot_delete": "Cannot delete status",
  "forms:session_status.confirm.delete": "Delete this status?",
  "common:buttons.cancel": "Cancel",
  "common:buttons.add": "Add",
  "buttons.adding": "Adding…",
  "buttons.saving": "Saving…",
  "common:buttons.save": "Save",
  "common:buttons.delete": "Delete",
  "common:success.created": "Created",
  "common:success.updated": "Updated",
  "common:success.deleted": "Deleted",
  "common:errors.validation": "Validation error",
  "common:errors.save": "Save error",
  "common:errors.delete": "Delete error",
};

const resolveNamespace = (namespace?: string | string[], override?: string) => {
  if (override) return override;
  if (Array.isArray(namespace)) return namespace[0];
  return namespace;
};

jest.mock("react-i18next", () => ({
  useTranslation: (namespace?: string | string[]) => ({
    t: (key: string, options?: { ns?: string }) => {
      const resolvedNamespace = resolveNamespace(namespace, options?.ns);
      const compositeKey = resolvedNamespace ? `${resolvedNamespace}:${key}` : key;
      return translations[compositeKey] ?? translations[key] ?? compositeKey;
    },
  }),
}));

const createSessionStatusTable = ({
  existingSort = 3,
  insertError = null,
  updateError = null,
  deleteError = null,
}: {
  existingSort?: number | null;
  insertError?: unknown;
  updateError?: unknown;
  deleteError?: unknown;
}) => {
  const limitMock = jest.fn(async () => ({
    data: existingSort === null ? [] : [{ sort_order: existingSort }],
    error: null,
  }));
  const orderMock = jest.fn(() => ({ limit: limitMock }));
  const selectEqMock = jest.fn(() => ({ order: orderMock }));
  const selectMock = jest.fn(() => ({ eq: selectEqMock }));

  const insertMock = jest.fn(async () => ({ error: insertError }));
  const updateEqMock = jest.fn(async () => ({ error: updateError }));
  const updateMock = jest.fn(() => ({ eq: updateEqMock }));
  const deleteEqMock = jest.fn(async () => ({ error: deleteError }));
  const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));

  return {
    builder: { select: selectMock, insert: insertMock, update: updateMock, delete: deleteMock },
    selectMock,
    selectEqMock,
    orderMock,
    limitMock,
    insertMock,
    updateMock,
    updateEqMock,
    deleteMock,
    deleteEqMock,
  };
};

const globalWindow = globalThis as Window & typeof globalThis;
let originalWindowStatus: string;

describe("SessionStatusDialogs", () => {
  beforeAll(() => {
    originalWindowStatus = globalWindow.status;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    globalWindow.status = "ok";
    supabaseAuthGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
    useModalNavigationMock.mockImplementation(({ onDiscard, onSaveAndExit }: ModalNavigationArgs) => ({
      showGuard: false,
      message: "",
      handleModalClose: () => true,
      handleDiscardChanges: () => onDiscard?.(),
      handleStayOnModal: jest.fn(),
      handleSaveAndExit: () => onSaveAndExit?.(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalWindow.status = originalWindowStatus;
  });

  const renderAddDialog = (overrides: Partial<React.ComponentProps<typeof AddSessionStatusDialog>> = {}) => {
    return render(
      <AddSessionStatusDialog
        open
        onOpenChange={jest.fn()}
        onStatusAdded={jest.fn()}
        {...overrides}
      />
    );
  };

  it("creates a new session status and notifies listeners", async () => {
    const onStatusAdded = jest.fn();
    const onOpenChange = jest.fn();

    const statusTable = createSessionStatusTable({ existingSort: 4 });
    supabaseFromMock.mockImplementation(() => statusTable.builder);

    renderAddDialog({ onStatusAdded, onOpenChange });

    fireEvent.change(screen.getByLabelText("Status name"), { target: { value: "Planning" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    await waitFor(() => {
      expect(statusTable.insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Planning",
          lifecycle: "active",
          sort_order: 5,
        })
      );
    });

    expect(onStatusAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Created",
        description: "Status created",
      })
    );
  });

  it("surfaces validation errors when the name is missing", async () => {
    const statusTable = createSessionStatusTable({ existingSort: 1 });
    supabaseFromMock.mockImplementation(() => statusTable.builder);

    renderAddDialog();

    const navigationConfig = useModalNavigationMock.mock.calls.at(-1)?.[0] as { onSaveAndExit?: () => Promise<void> };
    expect(navigationConfig?.onSaveAndExit).toBeDefined();

    await act(async () => {
      await navigationConfig?.onSaveAndExit?.();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Validation error",
        description: "Name is required",
        variant: "destructive",
      })
    );
    expect(statusTable.insertMock).not.toHaveBeenCalled();
  });

  it("auto-selects lifecycle based on keyword heuristics", async () => {
    const statusTable = createSessionStatusTable({ existingSort: 1 });
    supabaseFromMock.mockImplementation(() => statusTable.builder);

    renderAddDialog();

    fireEvent.change(screen.getByLabelText("Status name"), { target: { value: "Delivery complete" } });

    await waitFor(() => {
      expect(screen.getByTestId("lifecycle-value").textContent).toBe("completed");
    });
  });

  it("hides destructive controls for system-required statuses", () => {
    const statusTable = createSessionStatusTable({ existingSort: null });
    supabaseFromMock.mockImplementation(() => statusTable.builder);

    render(
      <EditSessionStatusDialog
        open
        status={{ id: "status-1", name: "Initial", color: "#fff", lifecycle: "active", is_system_required: true }}
        onOpenChange={jest.fn()}
        onStatusUpdated={jest.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(statusTable.deleteMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Cannot delete status",
      })
    );
  });

  it("deletes a custom status after confirmation", async () => {
    const statusTable = createSessionStatusTable({ existingSort: null });
    supabaseFromMock.mockImplementation(() => statusTable.builder);

    const onOpenChange = jest.fn();
    const onStatusUpdated = jest.fn();

    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <EditSessionStatusDialog
        open
        status={{ id: "status-2", name: "Follow-up", color: "#000", lifecycle: "active", is_system_required: false }}
        onOpenChange={onOpenChange}
        onStatusUpdated={onStatusUpdated}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    await waitFor(() => {
      expect(statusTable.deleteEqMock).toHaveBeenCalledWith("id", "status-2");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStatusUpdated).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Deleted",
        description: "Status deleted",
      })
    );
  });
});
