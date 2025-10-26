import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import {
  AddProjectStageDialog,
  EditProjectStageDialog,
} from "../ProjectStageDialogs";

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

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ title, isOpen, children, footerActions }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="app-sheet-modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>
          {footerActions?.map((action: any) => (
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
  SegmentedControl: ({ value, onValueChange, options }: any) => (
    <div>
      <div data-testid="lifecycle-value">{value}</div>
      {options?.map((option: any) => (
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
  "forms:project_stage.add_title": "Add project stage",
  "forms:project_stage.edit_title": "Edit project stage",
  "forms:project_stage.name_label": "Stage name",
  "forms:project_stage.name_placeholder": "Stage placeholder",
  "forms:project_stage.color_label": "Color",
  "forms:project_stage.lifecycle.label": "Lifecycle",
  "forms:project_stage.lifecycle.active": "Active",
  "forms:project_stage.lifecycle.completed": "Completed",
  "forms:project_stage.lifecycle.cancelled": "Cancelled",
  "forms:project_stage.lifecycle.help.title": "Lifecycle help",
  "forms:project_stage.lifecycle.help.active": "Active help",
  "forms:project_stage.lifecycle.help.completed": "Completed help",
  "forms:project_stage.lifecycle.help.cancelled": "Cancelled help",
  "forms:project_stage.errors.name_required": "Stage name required",
  "forms:project_stage.errors.add_failed": "Add failed",
  "forms:project_stage.errors.update_failed": "Update failed",
  "forms:project_stage.errors.delete_failed": "Delete failed",
  "forms:project_stage.errors.cannot_delete": "Cannot delete stage",
  "forms:project_stage.confirm.delete": "Delete this stage?",
  "forms:project_stage.success.added": "Project stage created",
  "forms:project_stage.success.updated": "Project stage updated",
  "forms:project_stage.success.deleted": "Project stage deleted",
  "forms:success.created": "Success",
  "forms:success.updated": "Success",
  "forms:success.deleted": "Success",
  "forms:buttons.add": "Add",
  "forms:buttons.adding": "Adding…",
  "forms:buttons.save": "Save",
  "forms:buttons.cancel": "Cancel",
  "forms:buttons.delete": "Delete",
  "forms:actions.saving": "Saving…",
  "forms:errors.title": "Error",
  "common:buttons.cancel": "Cancel",
  "common:buttons.save": "Save",
  "common:buttons.delete": "Delete",
  "common:actions.saving": "Saving…",
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

const createProjectStagesTable = ({
  existingSort = 5,
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

  const updateEqMock = jest.fn(() => ({
    eq: jest.fn(async () => ({ error: updateError })),
  }));
  const updateMock = jest.fn(() => ({ eq: updateEqMock }));

  const deleteEqMock = jest.fn(() => ({
    eq: jest.fn(async () => ({ error: deleteError })),
  }));
  const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));

  return {
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

describe("ProjectStageDialogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAuthGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
    useModalNavigationMock.mockImplementation(({ onDiscard, onSaveAndExit }: any = {}) => ({
      showGuard: false,
      message: "",
      handleModalClose: () => true,
      handleDiscardChanges: () => onDiscard?.(),
      handleStayOnModal: jest.fn(),
      handleSaveAndExit: () => onSaveAndExit?.(),
    }));
  });

  it("creates a project stage successfully", async () => {
    const table = createProjectStagesTable();
    supabaseFromMock.mockImplementation((tableName: string) => {
      if (tableName === "project_statuses") {
        return {
          select: table.selectMock,
          insert: table.insertMock,
        };
      }
      throw new Error(`Unexpected table ${tableName}`);
    });

    const onStageAdded = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <AddProjectStageDialog
        open
        onOpenChange={onOpenChange}
        onStageAdded={onStageAdded}
      />
    );

    fireEvent.change(screen.getByLabelText("Stage name"), {
      target: { value: "Production" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    await waitFor(() =>
      expect(table.insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Production",
          sort_order: 6,
        })
      )
    );

    expect(onStageAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Project stage created",
      })
    );
  });

  it("keeps save disabled when name is empty", () => {
    supabaseFromMock.mockImplementation(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ order: jest.fn(() => ({ limit: jest.fn(async () => ({ data: [], error: null })) })) })) })),
      insert: jest.fn(),
    }));

    render(
      <AddProjectStageDialog
        open
        onOpenChange={jest.fn()}
        onStageAdded={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("promotes lifecycle suggestions based on name", async () => {
    supabaseFromMock.mockImplementation(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ order: jest.fn(() => ({ limit: jest.fn(async () => ({ data: [], error: null })) })) })) })),
      insert: jest.fn(),
    }));

    render(
      <AddProjectStageDialog
        open
        onOpenChange={jest.fn()}
        onStageAdded={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Stage name"), {
      target: { value: "Final Delivery" },
    });

    await waitFor(() =>
      expect(screen.getByTestId("lifecycle-value").textContent).toBe("completed")
    );
  });

  it("updates a project stage", async () => {
    const table = createProjectStagesTable();
    supabaseFromMock.mockImplementation(() => ({
      update: table.updateMock,
    }));

    const onStageUpdated = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <EditProjectStageDialog
        open
        stage={{
          id: "stage-1",
          name: "Planning",
          color: "#FF0000",
          lifecycle: "active",
          is_system_required: false,
        }}
        onOpenChange={onOpenChange}
        onStageUpdated={onStageUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText("Stage name"), {
      target: { value: "Execution" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(table.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Execution",
        color: "#FF0000",
      })
    );
    expect(onStageUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Project stage updated",
      })
    );
  });

  it("prevents deleting system required stages", () => {
    supabaseFromMock.mockImplementation(() => ({}));

    render(
      <EditProjectStageDialog
        open
        stage={{
          id: "stage-2",
          name: "Initial",
          color: "#FF0000",
          lifecycle: "active",
          is_system_required: true,
        }}
        onOpenChange={jest.fn()}
        onStageUpdated={jest.fn()}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Delete" })
    ).not.toBeInTheDocument();
  });

  it("deletes a project stage when confirmed", async () => {
    const table = createProjectStagesTable();
    supabaseFromMock.mockImplementation(() => ({
      delete: table.deleteMock,
    }));

    const onStageUpdated = jest.fn();
    const onOpenChange = jest.fn();
    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <EditProjectStageDialog
        open
        stage={{
          id: "stage-3",
          name: "Archive",
          color: "#AA0000",
          lifecycle: "cancelled",
          is_system_required: false,
        }}
        onOpenChange={onOpenChange}
        onStageUpdated={onStageUpdated}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    await waitFor(() => expect(table.deleteMock).toHaveBeenCalled());
    expect(onStageUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Project stage deleted",
      })
    );

    (window.confirm as jest.Mock).mockRestore();
  });
});
