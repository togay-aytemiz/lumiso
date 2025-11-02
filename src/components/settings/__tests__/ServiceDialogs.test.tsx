import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddServiceDialog, EditServiceDialog } from "../ServiceDialogs";

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

jest.mock("@/hooks/useOrganizationData", () => ({
  useOrganizationTaxProfile: () => ({
    data: {
      defaultVatRate: 20,
      defaultVatMode: "inclusive",
      pricesIncludeVat: true,
    },
  }),
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

const SelectContext = React.createContext<{ onValueChange: (value: string) => void } | null>(null);

jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const SelectContext = React.createContext<{ onValueChange: (value: string) => void } | null>(null);

  const Select = ({ onValueChange, children }: any) => (
    <SelectContext.Provider value={{ onValueChange }}>
      <div>{children}</div>
    </SelectContext.Provider>
  );

  const SelectTrigger = ({ children }: any) => <div>{children}</div>;
  const SelectValue = ({ children }: any) => <span>{children}</span>;
  const SelectContent = ({ children }: any) => <div>{children}</div>;
  const SelectSeparator = () => null;

  const SelectItem = ({ value, children }: any) => {
    const ctx = React.useContext(SelectContext);
    return (
      <button type="button" onClick={() => ctx?.onValueChange(value)}>
        {children}
      </button>
    );
  };

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator };
});

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      {...props}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));

jest.mock("../NavigationGuardDialog", () => ({
  NavigationGuardDialog: () => null,
}));

const translations: Record<string, string> = {
  "forms:buttons.save": "Save",
  "forms:buttons.cancel": "Cancel",
  "common:toast.success": "Success",
  "common:toast.error": "Error",
  "service.add_title": "Add service",
  "service.edit_title": "Edit service",
  "service.name": "Service name",
  "service.description": "Service description",
  "service.description_placeholder": "Describe the service",
  "service.intro": "Organise services",
  "service.category": "Category",
  "service.category_placeholder": "Select category",
  "service.new_category": "New category",
  "service.new_category_placeholder": "Enter new category name",
  "service.default_categories_label": "Default categories",
  "service.custom_categories_label": "Custom categories",
  "service.errors.name_required": "Service name is required",
  "service.success.added": "Service created",
  "service.success.updated": "Service updated",
  "service.success.deleted": "Service deleted",
  "service.errors.update_failed": "Failed to update service",
  "service.errors.add_failed": "Failed to create service",
  "service.name_placeholder": "Service name",
  "service.price": "Price",
  "service.cost_price": "Cost price",
  "service.selling_price": "Selling price",
  "service.extra_label": "Extra",
  "service.service_type_label": "Service type",
  "service.service_type_coverage": "Team coverage",
  "service.service_type_deliverable": "Products & deliverables",
  "service.service_type_coverage_hint": "Services that require people on-site",
  "service.service_type_deliverable_hint": "Albums, prints and other deliverables",
  "service.service_type_hint": "Select a type to continue",
  "service.vendor_label": "Vendor",
  "service.vendor_placeholder": "Vendor name",
  "service.optional_hint": "Optional",
  "service.visibility_label": "Visibility",
  "service.visibility_help": "Hide this service when turned off",
  "service.vat_section.title": "VAT settings",
  "service.vat_section.description": "Adjust VAT defaults for this service.",
  "service.vat_section.rate_label": "VAT rate",
  "service.vat_section.mode_label": "VAT handling",
  "service.vat_section.mode_inclusive": "Included in price",
  "service.vat_section.mode_exclusive": "Add on top",
  "service.vat_section.defaults_hint": "Defaults come from organization settings.",
  "service.vat_section.toggle_label": "Adjust VAT settings",
  "service.vat_section.toggle_helper": "Enable to override defaults.",
  "service.vat_section.summary": "VAT {{rate}}% • {{mode}}",
  "service.vat_section.summary_mode.inclusive": "included in price",
  "service.vat_section.summary_mode.exclusive": "added on top",
  "service.default_unit_label": "Default unit",
  "service.default_unit_placeholder": "e.g. hour, album, 10-print pack",
  "service.requires_staff_label": "Requires staffing",
  "service.requires_staff_hint": "Toggle when this affects staffing or scheduling",
  "common.toast.success": "Success",
  "buttons.save": "Save",
  "buttons.add": "Add",
  "buttons.cancel": "Cancel",
  "buttons.update": "Update",
  "actions.saving": "Saving…",
  "service.errors.vat_rate_invalid": "VAT rate must be valid",
  "service.errors.vat_rate_range": "VAT rate must be between 0 and 99.99",
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

const createServicesTable = ({
  categories = [] as Array<{ category: string }>,
  insertError = null as any,
  updateError = null as any,
} = {}) => {
  const orderMock = jest.fn(async () => ({ data: categories, error: null }));
  const notMock = jest.fn(async () => ({ data: categories, error: null }));
  const eqMock = jest.fn(() => ({ order: orderMock, not: notMock }));
  const selectMock = jest.fn(() => ({ eq: eqMock, not: notMock, order: orderMock }));
  const insertMock = jest.fn(async () => ({ error: insertError }));
  const updateEqMock = jest.fn(async () => ({ error: updateError }));
  const updateMock = jest.fn(() => ({ eq: updateEqMock }));

  return {
    builder: { select: selectMock, insert: insertMock, update: updateMock },
    selectMock,
    insertMock,
    updateMock,
    updateEqMock,
  };
};

describe.skip("ServiceDialogs", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

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

  it("creates a new service and notifies listeners", async () => {
    const onServiceAdded = jest.fn();
    const onOpenChange = jest.fn();

    const servicesTable = createServicesTable({
      categories: [{ category: "Albums" }],
    });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "services") {
        return servicesTable.builder;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    render(
      <AddServiceDialog
        open
        initialType="deliverable"
        onOpenChange={onOpenChange}
        onServiceAdded={onServiceAdded}
      />
    );

    await waitFor(() => expect(servicesTable.selectMock).toHaveBeenCalled());

    expect(screen.queryByText("Albums")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Products & deliverables"));
    fireEvent.click(screen.getByText("Albums"));

    const nameInput = await screen.findByLabelText(/Service name/i);
    fireEvent.change(nameInput, {
      target: { value: "Photo Editing" },
    });
    fireEvent.change(screen.getByLabelText(/Cost price/i), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText(/Selling price/i), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText(/Vendor/i), {
      target: { value: "Local Lab" },
    });
    const visibilityToggle = screen.getByRole("switch", { name: /Visibility/i });
    fireEvent.click(visibilityToggle);

    const navigationConfig = useModalNavigationMock.mock.calls.at(-1)?.[0] as { onSaveAndExit?: () => Promise<void> };
    expect(navigationConfig?.onSaveAndExit).toBeDefined();

    await act(async () => {
      await navigationConfig?.onSaveAndExit?.();
    });

    await waitFor(() => expect(servicesTable.insertMock).toHaveBeenCalled());

    expect(servicesTable.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Photo Editing",
        category: "Albums",
        price: 0,
        cost_price: 50,
        selling_price: 200,
        extra: false,
        organization_id: "org-123",
        user_id: "user-1",
        service_type: "deliverable",
        is_people_based: false,
        default_unit: null,
        vendor_name: "Local Lab",
        is_active: false,
        vat_rate: 20,
        price_includes_vat: true,
      })
    );
    expect(onServiceAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Service created",
      })
    );
  });

  it("shows validation messaging when the service name is missing", async () => {
    const servicesTable = createServicesTable();
    supabaseFromMock.mockImplementation(() => servicesTable.builder);

    render(<AddServiceDialog open initialType="deliverable" onOpenChange={jest.fn()} onServiceAdded={jest.fn()} />);

    await waitFor(() => expect(servicesTable.selectMock).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(toastMock).not.toHaveBeenCalled();
    expect(servicesTable.insertMock).not.toHaveBeenCalled();
  });

  it("updates an existing service and closes the dialog", async () => {
    const servicesTable = createServicesTable();
    supabaseFromMock.mockImplementation(() => servicesTable.builder);

    const onServiceUpdated = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <EditServiceDialog
        open
        service={{
          id: "svc-1",
          name: "Retouching",
          description: "Basic retouching",
          category: "Extras",
          price: 100,
          cost_price: 25,
          selling_price: 150,
          extra: false,
          service_type: "deliverable",
          is_people_based: false,
          default_unit: "album",
          vendor_name: "Print Lab",
          is_active: true,
        } as any}
        onOpenChange={onOpenChange}
        onServiceUpdated={onServiceUpdated}
      />
    );

    const nameInput = await screen.findByLabelText(/Service name/i);
    fireEvent.change(nameInput, {
      target: { value: "Advanced Retouching" },
    });
    fireEvent.change(screen.getByLabelText(/Vendor/i), {
      target: { value: "Pro Lab" },
    });
    fireEvent.click(screen.getByRole("switch", { name: /Visibility/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() => expect(servicesTable.updateEqMock).toHaveBeenCalledWith("id", "svc-1"));

    expect(servicesTable.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Advanced Retouching",
        description: "Basic retouching",
        category: "Extras",
        price: 100,
        cost_price: 25,
        extra: false,
        selling_price: 150,
        service_type: "deliverable",
        is_people_based: false,
        vendor_name: "Pro Lab",
        is_active: false,
        vat_rate: 20,
        price_includes_vat: true,
      })
    );
    expect(onServiceUpdated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Service updated",
      })
    );
  });
});
