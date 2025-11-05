import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import type { ReactNode } from "react";
import {
  AddLeadStatusDialog,
  EditLeadStatusDialog,
} from "../LeadStatusDialogs";

const supabaseAuthGetUserMock = jest.fn();
const supabaseFromMock = jest.fn();
const getUserOrganizationIdMock = jest.fn();
const toastMock = jest.fn();
const useModalNavigationMock = jest.fn();

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
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: (...args: unknown[]) => useModalNavigationMock(...args),
}));

type FooterActionMock = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

type AppSheetModalProps = {
  title: string;
  isOpen: boolean;
  children?: ReactNode;
  footerActions?: FooterActionMock[];
};

type SegmentedOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options?: SegmentedOption[];
};

type ModalNavigationMockArgs = Partial<{
  onDiscard: () => void;
  onSaveAndExit: () => Promise<void>;
}>;

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ title, isOpen, children, footerActions }: AppSheetModalProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="app-sheet-modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>
          {footerActions?.map((action) => (
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
  SegmentedControl: ({ value, onValueChange, options }: SegmentedControlProps) => (
    <div>
      <div data-testid="lifecycle-value">{value}</div>
      {options?.map((option) => (
        <button
          key={option.value}
          type="button"
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
  "forms:success.created": "Created",
  "forms:success.updated": "Updated",
  "forms:success.deleted": "Deleted",
  "forms:buttons.save": "Save",
  "forms:buttons.cancel": "Cancel",
  "forms:buttons.delete": "Delete",
  "forms:actions.saving": "Saving…",
  "forms:errors.title": "Error",
  "forms:lead_status.add_title": "Add lead status",
  "forms:lead_status.edit_title": "Edit lead status",
  "forms:lead_status.name_label": "Status name",
  "forms:lead_status.name_placeholder": "Name placeholder",
  "forms:lead_status.color_label": "Color",
  "forms:lead_status.lifecycle.label": "Lifecycle",
  "forms:lead_status.lifecycle.active": "Active",
  "forms:lead_status.lifecycle.completed": "Completed",
  "forms:lead_status.lifecycle.cancelled": "Cancelled",
  "forms:lead_status.lifecycle.help.title": "Lifecycle help",
  "forms:lead_status.lifecycle.help.active": "Active help",
  "forms:lead_status.lifecycle.help.completed": "Completed help",
  "forms:lead_status.lifecycle.help.cancelled": "Cancelled help",
  "forms:lead_status.errors.name_required": "Name required",
  "forms:lead_status.errors.add_failed": "Add failed",
  "forms:lead_status.errors.update_failed": "Update failed",
  "forms:lead_status.errors.delete_failed": "Delete failed",
  "forms:lead_status.errors.cannot_delete": "Cannot delete",
  "forms:lead_status.confirm.delete": "Delete lead status?",
  "forms:lead_status.success.added": "Lead status created",
  "forms:lead_status.success.updated": "Lead status updated",
  "forms:lead_status.success.deleted": "Lead status deleted",
  "forms:lead_status.system_required_note": "System required status",
  "forms:lead_status.system_required_info": "System required info",
  "common:buttons.cancel": "Cancel",
  "common:buttons.save": "Save",
  "common:buttons.add": "Add",
  "common:buttons.delete": "Delete",
  "common:actions.saving": "Saving…",
  "common:errors.title": "Error",
  "common:success.created": "Success",
  "common:success.updated": "Success",
  "common:success.deleted": "Success",
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

const createLeadStatusesTable = ({
  existingSort = 2,
  insertError = null,
  updateError = null,
  deleteError = null,
}: {
  existingSort?: number | null;
  insertError?: unknown;
  updateError?: unknown;
  deleteError?: unknown;
} = {}) => {
  const limitMock = jest.fn(async () => ({
    data: existingSort === null ? [] : [{ sort_order: existingSort }],
    error: null,
  }));
  const orderMock = jest.fn(() => ({ limit: limitMock }));
  const selectEqMock = jest.fn(() => ({ order: orderMock }));
  const selectMock = jest.fn(() => ({ eq: selectEqMock }));

  const insertMock = jest.fn(async () => ({ error: insertError }));

  const updateSecondEqMock = jest.fn(async () => ({ error: updateError }));
  const updateEqMock = jest.fn(() => ({ eq: updateSecondEqMock }));
  const updateMock = jest.fn(() => ({ eq: updateEqMock }));

  const deleteSecondEqMock = jest.fn(async () => ({ error: deleteError }));
  const deleteEqMock = jest.fn(() => ({ eq: deleteSecondEqMock }));
  const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));

  return {
    selectMock,
    selectEqMock,
    orderMock,
    limitMock,
    insertMock,
    updateMock,
    updateEqMock,
    updateSecondEqMock,
    deleteMock,
    deleteEqMock,
    deleteSecondEqMock,
  };
};

describe("LeadStatusDialogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAuthGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
    useModalNavigationMock.mockImplementation(({ onDiscard, onSaveAndExit }: ModalNavigationMockArgs = {}) => ({
      showGuard: false,
      message: "",
      handleModalClose: () => true,
      handleDiscardChanges: () => onDiscard?.(),
      handleStayOnModal: jest.fn(),
      handleSaveAndExit: () => onSaveAndExit?.(),
    }));
  });

  it("creates a new lead status and notifies listeners", async () => {
    const table = createLeadStatusesTable({ existingSort: 3 });
    supabaseFromMock.mockImplementation((tableName: string) => {
      if (tableName === "lead_statuses") {
        return {
          select: table.selectMock,
          insert: table.insertMock,
        };
      }
      throw new Error(`Unexpected table ${tableName}`);
    });

    const onStatusAdded = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <AddLeadStatusDialog
        open
        onOpenChange={onOpenChange}
        onStatusAdded={onStatusAdded}
      />
    );

    fireEvent.change(screen.getByLabelText("Status name"), {
      target: { value: "Follow Up" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    await waitFor(() =>
      expect(table.insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Follow Up",
          lifecycle: "active",
          sort_order: 4,
        })
      )
    );

    expect(onStatusAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Created",
        description: "Lead status created",
      })
    );
  });

  it("prevents submission when name is empty", async () => {
    const table = createLeadStatusesTable();
    supabaseFromMock.mockImplementation(() => ({
      select: table.selectMock,
      insert: table.insertMock,
    }));

    render(
      <AddLeadStatusDialog
        open
        onOpenChange={jest.fn()}
        onStatusAdded={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    await waitFor(() => expect(table.insertMock).not.toHaveBeenCalled());
  });

  it("auto-selects lifecycle suggestions based on the name", async () => {
    const table = createLeadStatusesTable();
    supabaseFromMock.mockImplementation(() => ({
      select: table.selectMock,
      insert: table.insertMock,
    }));

    render(
      <AddLeadStatusDialog
        open
        onOpenChange={jest.fn()}
        onStatusAdded={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Status name"), {
      target: { value: "Completed Project" },
    });

    await waitFor(() =>
      expect(screen.getByTestId("lifecycle-value").textContent).toBe("completed")
    );
  });

  it("updates a lead status successfully", async () => {
    const table = createLeadStatusesTable();
    supabaseFromMock.mockImplementation(() => ({
      update: table.updateMock,
    }));

    const onStatusUpdated = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <EditLeadStatusDialog
        open
        status={{
          id: "status-1",
          name: "Prospect",
          color: "#3B82F6",
          lifecycle: "active",
          is_system_required: false,
        }}
        onOpenChange={onOpenChange}
        onStatusUpdated={onStatusUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText("Status name"), {
      target: { value: "Qualified" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(table.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Qualified",
        lifecycle: "active",
      })
    );
    expect(table.updateEqMock).toHaveBeenCalledWith("id", "status-1");
    expect(onStatusUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated",
        description: "Lead status updated",
      })
    );
  });

  it("hides the delete control for system required statuses", () => {
    supabaseFromMock.mockImplementation(() => ({}));

    render(
      <EditLeadStatusDialog
        open
        status={{
          id: "status-1",
          name: "Initial",
          color: "#3B82F6",
          lifecycle: "active",
          is_system_required: true,
        }}
        onOpenChange={jest.fn()}
        onStatusUpdated={jest.fn()}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Delete" })
    ).not.toBeInTheDocument();
  });

  it("deletes a lead status when confirmed", async () => {
    const table = createLeadStatusesTable();
    supabaseFromMock.mockImplementation(() => ({
      delete: table.deleteMock,
    }));

    const onStatusUpdated = jest.fn();
    const onOpenChange = jest.fn();

    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <EditLeadStatusDialog
        open
        status={{
          id: "status-2",
          name: "Lost",
          color: "#222222",
          lifecycle: "cancelled",
          is_system_required: false,
        }}
        onOpenChange={onOpenChange}
        onStatusUpdated={onStatusUpdated}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    await waitFor(() => expect(table.deleteMock).toHaveBeenCalled());
    expect(table.deleteEqMock).toHaveBeenCalledWith("id", "status-2");
    expect(onStatusUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Deleted",
        description: "Lead status deleted",
      })
    );

    (window.confirm as jest.Mock).mockRestore();
  });
});
