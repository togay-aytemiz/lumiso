import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { AddProjectTypeDialog, EditProjectTypeDialog } from "../ProjectTypeDialogs";

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

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, type = "button" }: any) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("../NavigationGuardDialog", () => ({
  NavigationGuardDialog: () => null,
}));

const translations: Record<string, string> = {
  "forms:project_type.add_title": "Add project type",
  "forms:project_type.edit_title": "Edit project type",
  "forms:project_type.name_label": "Project type name",
  "forms:project_type.name_placeholder": "Type name",
  "forms:project_type.name_help": "Name help",
  "forms:project_type.set_as_default": "Set as default",
  "forms:project_type.set_as_default_help": "Default help",
  "forms:project_type.success.added": "Project type created",
  "forms:project_type.success.updated": "Project type updated",
  "forms:project_type.success.deleted": "Project type deleted",
  "forms:project_type.errors.name_required": "Project type name required",
  "forms:project_type.errors.cannot_delete_default": "Cannot delete default project type",
  "forms:project_type.confirm.delete": "Delete this project type?",
  "common:buttons.cancel": "Cancel",
  "common:buttons.add": "Add",
  "buttons.adding": "Adding…",
  "common:buttons.save": "Save",
  "buttons.saving": "Saving…",
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

type FilterRecord = { method: string; args: any[] };

const createThenableBuilder = (result: any) => {
  const builder: any = {
    filters: [] as FilterRecord[],
    eq: jest.fn((...args: any[]) => {
      builder.filters.push({ method: "eq", args });
      return builder;
    }),
    neq: jest.fn((...args: any[]) => {
      builder.filters.push({ method: "neq", args });
      return builder;
    }),
    then: (resolve: (value: any) => any) => resolve(result),
  };
  return builder;
};

const createProjectTypesTable = ({
  existingSort = 2,
  insertError = null,
  updateResult = { error: null },
  deleteResult = { error: null },
}: {
  existingSort?: number | null;
  insertError?: unknown;
  updateResult?: any;
  deleteResult?: any;
}) => {
  const limitMock = jest.fn(async () => ({
    data: existingSort === null ? [] : [{ sort_order: existingSort }],
    error: null,
  }));
  const orderMock = jest.fn(() => ({ limit: limitMock }));
  const selectEqMock = jest.fn(() => ({ order: orderMock }));
  const selectMock = jest.fn(() => ({ eq: selectEqMock }));

  const insertMock = jest.fn(async () => ({ error: insertError }));

  const updateCalls: Array<{ payload: any; builder: any }> = [];
  const updateMock = jest.fn((payload: any) => {
    const builder = createThenableBuilder(updateResult);
    updateCalls.push({ payload, builder });
    return builder;
  });

  const deleteCalls: Array<{ builder: any }> = [];
  const deleteMock = jest.fn(() => {
    const builder = createThenableBuilder(deleteResult);
    deleteCalls.push({ builder });
    return builder;
  });

  return {
    builder: { select: selectMock, insert: insertMock, update: updateMock, delete: deleteMock },
    selectMock,
    selectEqMock,
    orderMock,
    limitMock,
    insertMock,
    updateMock,
    updateCalls,
    deleteMock,
    deleteCalls,
  };
};

describe("ProjectTypeDialogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAuthGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
    useModalNavigationMock.mockImplementation(({ onDiscard, onSaveAndExit }: any) => ({
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
  });

  const renderAddDialog = (props: Partial<ComponentProps<typeof AddProjectTypeDialog>> = {}) =>
    render(
      <AddProjectTypeDialog
        open
        onOpenChange={jest.fn()}
        onTypeAdded={jest.fn()}
        {...props}
      />
    );

  it("creates a new project type and clears existing defaults", async () => {
    const onTypeAdded = jest.fn();
    const onOpenChange = jest.fn();

    const table = createProjectTypesTable({ existingSort: 7 });
    supabaseFromMock.mockImplementation(() => table.builder);

    renderAddDialog({ onTypeAdded, onOpenChange });

    fireEvent.change(screen.getByLabelText("Project type name"), { target: { value: "Wedding" } });
    fireEvent.click(screen.getByLabelText("Set as default"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });

    await waitFor(() => expect(table.insertMock).toHaveBeenCalled());

    expect(table.updateMock).toHaveBeenCalledTimes(1);
    expect(table.updateCalls[0].payload).toEqual({ is_default: false });
    expect(table.updateCalls[0].builder.filters).toEqual([
      { method: "eq", args: ["organization_id", "org-123"] },
    ]);

    expect(table.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Wedding",
        is_default: true,
        sort_order: 8,
      })
    );

    expect(onTypeAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Created",
        description: "Project type created",
      })
    );
  });

  it("validates empty names before submitting", async () => {
    const table = createProjectTypesTable({});
    supabaseFromMock.mockImplementation(() => table.builder);

    renderAddDialog();

    const navigationConfig = useModalNavigationMock.mock.calls.at(-1)?.[0] as { onSaveAndExit?: () => Promise<void> };
    expect(navigationConfig?.onSaveAndExit).toBeDefined();

    await act(async () => {
      await navigationConfig?.onSaveAndExit?.();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Validation error",
        description: "Project type name required",
        variant: "destructive",
      })
    );
    expect(table.insertMock).not.toHaveBeenCalled();
  });

  it("updates an existing project type and promotes it to default", async () => {
    const table = createProjectTypesTable({});
    supabaseFromMock.mockImplementation(() => table.builder);

    const onTypeUpdated = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <EditProjectTypeDialog
        open
        type={{ id: "type-1", name: "Portrait", is_default: false }}
        onOpenChange={onOpenChange}
        onTypeUpdated={onTypeUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText("Project type name"), { target: { value: "Portrait Deluxe" } });
    fireEvent.click(screen.getByLabelText("Set as default"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(table.updateMock).toHaveBeenCalledTimes(2);

    const unsetDefaults = table.updateCalls[0];
    expect(unsetDefaults.payload).toEqual({ is_default: false });
    expect(unsetDefaults.builder.filters).toEqual([
      { method: "eq", args: ["organization_id", "org-123"] },
      { method: "neq", args: ["id", "type-1"] },
    ]);

    const updateRecord = table.updateCalls[1];
    expect(updateRecord.payload).toEqual({
      name: "Portrait Deluxe",
      is_default: true,
    });
    expect(updateRecord.builder.filters).toEqual([
      { method: "eq", args: ["id", "type-1"] },
      { method: "eq", args: ["organization_id", "org-123"] },
    ]);

    expect(onTypeUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated",
        description: "Project type updated",
      })
    );
  });

  it("blocks deletion of the default project type", () => {
    const table = createProjectTypesTable({});
    supabaseFromMock.mockImplementation(() => table.builder);

    render(
      <EditProjectTypeDialog
        open
        type={{ id: "type-2", name: "Portrait", is_default: true }}
        onOpenChange={jest.fn()}
        onTypeUpdated={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete error",
        description: "Cannot delete default project type",
        variant: "destructive",
      })
    );
    expect(table.deleteMock).not.toHaveBeenCalled();
  });

  it("deletes a custom project type after confirmation", async () => {
    const table = createProjectTypesTable({});
    supabaseFromMock.mockImplementation(() => table.builder);

    const onOpenChange = jest.fn();
    const onTypeUpdated = jest.fn();

    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <EditProjectTypeDialog
        open
        type={{ id: "type-3", name: "Family", is_default: false }}
        onOpenChange={onOpenChange}
        onTypeUpdated={onTypeUpdated}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    const deleteCall = table.deleteCalls[0];
    expect(deleteCall.builder.filters).toEqual([
      { method: "eq", args: ["id", "type-3"] },
      { method: "eq", args: ["organization_id", "org-123"] },
    ]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onTypeUpdated).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Deleted",
        description: "Project type deleted",
      })
    );
  });
});
