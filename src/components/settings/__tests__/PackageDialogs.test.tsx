import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import { AddPackageDialog, EditPackageDialog } from "../PackageDialogs";

const supabaseAuthGetUserMock = jest.fn();
const supabaseFromMock = jest.fn();
const getUserOrganizationIdMock = jest.fn();
const toastMock = jest.fn();
const useModalNavigationMock = jest.fn();
const navigateMock = jest.fn();

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

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => navigateMock,
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

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children }: any) => <div>{children}</div>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("../NavigationGuardDialog", () => ({
  NavigationGuardDialog: () => null,
}));

const translations: Record<string, string> = {
  "forms:buttons.save": "Save",
  "forms:buttons.cancel": "Cancel",
  "common:toast.success": "Success",
  "forms:common.toast.success": "Success",
  "common:toast.error": "Error",
  "buttons.save": "Save",
  "buttons.update": "Update",
  "buttons.cancel": "Cancel",
  "actions.saving": "Saving…",
  "package.add_title": "Add package",
  "package.edit_title": "Edit package",
  "package.name": "Package name",
  "package.description": "Package description",
  "package.price": "Package price",
  "package.price_help": "Provide the full price",
  "package.price_placeholder": "Price",
  "package.errors.name_required": "Package name is required",
  "common.errors.price_required": "Price is required",
  "package.success.added": "Package created",
  "package.success.updated": "Package updated",
  "package.errors.add_failed": "Failed to create package",
  "package.errors.update_failed": "Failed to update package",
  "package.session_type_hint": "Session type hint",
  "package.default_add_ons": "Default add-ons",
  "package.add_ons_help_1": "Manage add-ons via",
  "package.add_ons_help_2": "to keep them organised.",
  "package.services_section": "services",
  "package.no_services_yet": "No services yet",
  "package.create_service": "Create a service",
  "package.add_services": "Add services",
  "package.selected_addons": "Selected add-ons",
  "package.edit_addons": "Edit add-ons",
  "package.no_addons_selected": "No add-ons selected",
  "package.applicable_types": "Applicable types",
  "package.applicable_types_help_1": "Review your",
  "package.project_types": "project types",
  "package.applicable_types_help_2": "to restrict usage.",
  "package.no_project_types_exist": "No project types yet",
  "package.create_project_types_link": "Create project types",
  "package.visibility": "Visibility",
  "package.visibility_help": "Toggle whether the package is active.",
  "package.delete_confirmation.description": "Discard changes?",
  "confirm.unsaved_changes": "Discard unsaved changes?",
  "package.services_section_link": "services",
  "package.applicable_types_none": "No applicable types yet",
};

const resolveNamespace = (namespace?: string | string[], override?: string) => {
  if (override) return override;
  if (Array.isArray(namespace)) return namespace[0];
  return namespace;
};

jest.mock("react-i18next", () => ({
  useTranslation: (namespace?: string | string[]) => ({
    t: (key: string, options?: { ns?: string; count?: number }) => {
      const resolvedNamespace = resolveNamespace(namespace, options?.ns);
      const compositeKey = resolvedNamespace ? `${resolvedNamespace}:${key}` : key;
      if (options?.count !== undefined) {
        return `${translations[compositeKey] ?? translations[key] ?? compositeKey} (${options.count})`;
      }
      return translations[compositeKey] ?? translations[key] ?? compositeKey;
    },
  }),
}));

interface SelectBuilderResult<T> {
  builder: { select: (columns: string) => any };
  selectMock: jest.Mock;
  eqMock: jest.Mock;
  orderMock: jest.Mock;
}

const createSelectBuilder = <T,>(rows: T[]): SelectBuilderResult<T> => {
  const orderMock = jest.fn(async () => ({ data: rows, error: null }));
  const eqMock = jest.fn(() => ({ order: orderMock }));
  const selectMock = jest.fn(() => ({ eq: eqMock, order: orderMock }));
  return {
    builder: { select: selectMock },
    selectMock,
    eqMock,
    orderMock,
  };
};

describe("PackageDialogs", () => {
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

  it("creates a package and emits success callbacks", async () => {
    const projectTypes = createSelectBuilder([{ id: "type-1", name: "Wedding" }]);
    const services = createSelectBuilder<any>([]);
    const insertMock = jest.fn(async () => ({ error: null }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "project_types") return projectTypes.builder;
      if (table === "services") return services.builder;
      if (table === "packages") return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });

    const onPackageAdded = jest.fn();

    render(
      <AddPackageDialog
        open
        onOpenChange={jest.fn()}
        onPackageAdded={onPackageAdded}
      />
    );

    await waitFor(() => expect(projectTypes.selectMock).toHaveBeenCalled());
    await waitFor(() => expect(projectTypes.selectMock).toHaveBeenCalled());
    await waitFor(() => expect(services.selectMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Package name/i), {
      target: { value: "Starter Package" },
    });
    fireEvent.change(screen.getByLabelText(/Package price/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Wedding" }));

    await waitFor(() => expect(projectTypes.selectMock).toHaveBeenCalled());
    await waitFor(() => expect(services.selectMock).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() => expect(insertMock).toHaveBeenCalled());

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Starter Package",
        price: 500,
        applicable_types: ["Wedding"],
        default_add_ons: [],
        organization_id: "org-123",
        user_id: "user-1",
      })
    );
    expect(onPackageAdded).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Package created",
      })
    );
  });

  it("shows validation errors when required fields are empty", async () => {
    const projectTypes = createSelectBuilder<any>([]);
    const services = createSelectBuilder<any>([]);
    const insertMock = jest.fn(async () => ({ error: null }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "project_types") return projectTypes.builder;
      if (table === "services") return services.builder;
      if (table === "packages") return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });

    render(
      <AddPackageDialog
        open
        onOpenChange={jest.fn()}
        onPackageAdded={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() => expect(projectTypes.selectMock).toHaveBeenCalled());
    await waitFor(() => expect(services.selectMock).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("updates a package and reports success", async () => {
    const projectTypes = createSelectBuilder([{ id: "type-1", name: "Wedding" }]);
    const services = createSelectBuilder<any>([]);
    const updateEqMock = jest.fn(async () => ({ error: null }));
    const updateMock = jest.fn(() => ({ eq: updateEqMock }));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "project_types") return projectTypes.builder;
      if (table === "services") return services.builder;
      if (table === "packages") return { update: updateMock };
      throw new Error(`Unexpected table ${table}`);
    });

    const onPackageUpdated = jest.fn();

    render(
      <EditPackageDialog
        open
        package={{
          id: "pkg-1",
          name: "Starter Package",
          description: "Base package",
          price: 400,
          applicable_types: ["Wedding"],
          default_add_ons: [],
          is_active: true,
        } as any}
        onOpenChange={jest.fn()}
        onPackageUpdated={onPackageUpdated}
      />
    );

    await waitFor(() => expect(services.selectMock).toHaveBeenCalled());

    const nameInput = await screen.findByLabelText(/Package name/i);
    fireEvent.change(nameInput, {
      target: { value: "Premium Package" },
    });
    fireEvent.change(screen.getByLabelText(/Package price/i), {
      target: { value: "750" },
    });
    fireEvent.click(screen.getByRole("switch"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update" }));
    });

    await waitFor(() => expect(updateEqMock).toHaveBeenCalledWith("id", "pkg-1"));

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Premium Package",
        price: 750,
        is_active: false,
      })
    );
    expect(onPackageUpdated).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Package updated",
      })
    );
  });
});
