import type { ReactElement, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { UnifiedClientDetails } from "../UnifiedClientDetails";

const toastMock = jest.fn();
const updateCoreFieldMock = jest.fn();
const updateCustomFieldMock = jest.fn();
const refetchFieldValuesMock = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const useLeadFieldDefinitionsMock = jest.fn();
jest.mock("@/hooks/useLeadFieldDefinitions", () => ({
  useLeadFieldDefinitions: () => useLeadFieldDefinitionsMock(),
}));

const useLeadFieldValuesMock = jest.fn();
jest.mock("@/hooks/useLeadFieldValues", () => ({
  useLeadFieldValues: () => useLeadFieldValuesMock(),
}));

jest.mock("@/hooks/useLeadUpdate", () => ({
  useLeadUpdate: () => ({
    updateCoreField: updateCoreFieldMock,
    updateCustomField: updateCustomFieldMock,
  }),
}));

jest.mock("@/components/fields/CustomFieldDisplay", () => ({
  CustomFieldDisplay: ({ value }: { value: string | null }) => (
    <span data-testid="custom-display">{value ?? "empty"}</span>
  ),
}));

jest.mock("@/components/fields/CustomFieldDisplayWithEmpty", () => ({
  CustomFieldDisplayWithEmpty: ({
    fieldDefinition,
    value,
  }: {
    fieldDefinition: { field_key: string };
    value: string | null;
  }) => (
    <span
      data-field-key={fieldDefinition.field_key}
      data-testid={`custom-${fieldDefinition.field_key}`}
    >
      {value ?? "empty"}
    </span>
  ),
}));

jest.mock("@/components/fields/FieldTextareaDisplay", () => ({
  FieldTextareaDisplay: ({ value }: { value: string }) => (
    <span data-testid="textarea-display">{value}</span>
  ),
}));

jest.mock("@/components/fields/InlineEditField", () => {
  const saveHandlers = new Map<string, (value: string) => void>();
  return {
    __esModule: true,
    InlineEditField: ({
      children,
      onSave,
    }: {
      children: ReactNode;
      onSave: (value: string) => void;
    }) => {
      const child = (Array.isArray(children)
        ? (children[0] as ReactElement | undefined)
        : (children as ReactElement | undefined)) ?? null;
      const fieldKey =
        (child?.props && (child.props["data-field-key"] as string)) ||
        (child?.props && (child.props["data-testid"] as string)) ||
        `field-${saveHandlers.size}`;

      const saveValue = child?.props?.["data-field-key"]
        ? " invalid value "
        : "Updated Value";

      saveHandlers.set(fieldKey, onSave);

      return (
        <div data-testid={`inline-${fieldKey}`} data-inline-key={fieldKey}>
          {children}
          <button
            type="button"
            data-testid={`save-${fieldKey}`}
            onClick={() => onSave(saveValue)}
          >
            trigger-save
          </button>
        </div>
      );
    },
    saveHandlers,
  };
});

jest.mock("@/components/fields/inline-editors/InlineTextEditor", () => ({
  InlineTextEditor: () => <div data-testid="inline-text-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlineTextareaEditor", () => ({
  InlineTextareaEditor: () => <div data-testid="inline-textarea-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlineEmailEditor", () => ({
  InlineEmailEditor: () => <div data-testid="inline-email-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlinePhoneEditor", () => ({
  InlinePhoneEditor: () => <div data-testid="inline-phone-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlineSelectEditor", () => ({
  InlineSelectEditor: () => <div data-testid="inline-select-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlineMultiSelectEditor", () => ({
  InlineMultiSelectEditor: () => (
    <div data-testid="inline-multiselect-editor" />
  ),
}));

jest.mock("@/components/fields/inline-editors/InlineNumberEditor", () => ({
  InlineNumberEditor: () => <div data-testid="inline-number-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlineDateEditor", () => ({
  InlineDateEditor: () => <div data-testid="inline-date-editor" />,
}));

jest.mock("@/components/fields/inline-editors/InlineCheckboxEditor", () => ({
  InlineCheckboxEditor: () => <div data-testid="inline-checkbox-editor" />,
}));

jest.mock("../EnhancedEditLeadDialog", () => ({
  EnhancedEditLeadDialog: () => <div data-testid="enhanced-edit-lead-dialog" />,
}));

const validateFieldValueMock = jest.fn();
jest.mock("@/lib/leadFieldValidation", () => ({
  validateFieldValue: (value: string | null) => validateFieldValueMock(value),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("UnifiedClientDetails", () => {
  const baseLead = {
    id: "lead-1",
    name: "Test Lead",
    email: "lead@example.com",
    phone: "0555 123 4567",
    notes: null,
  };

  beforeEach(() => {
    toastMock.mockReset();
    updateCoreFieldMock.mockReset();
    updateCustomFieldMock.mockReset();
    refetchFieldValuesMock.mockReset();
    validateFieldValueMock.mockReturnValue({ isValid: true });

    useLeadFieldDefinitionsMock.mockReturnValue({
      fieldDefinitions: [
        {
          field_key: "instagram",
          label: "Instagram",
          field_type: "text",
          allow_multiple: false,
          sort_order: 1,
          options: { options: [] },
          validation_rules: {},
        },
      ],
      loading: false,
    });

    useLeadFieldValuesMock.mockReturnValue({
      fieldValues: [
        {
          field_key: "instagram",
          value: "@test",
        },
      ],
      loading: false,
      refetch: refetchFieldValuesMock,
    });
  });

  it("renders lead details with quick actions and custom fields", () => {
    const navigateToLead = jest.fn();

    render(
      <UnifiedClientDetails
        lead={baseLead}
        title="Client"
        showQuickActions
        showClickableNames
        onNavigateToLead={navigateToLead}
        createdAt="2024-01-05T00:00:00.000Z"
      />
    );

    expect(screen.getByText("Client")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test Lead" }));
    expect(navigateToLead).toHaveBeenCalledWith("lead-1");

    expect(
      screen.getByRole("link", { name: "clientDetails.whatsApp" })
    ).toHaveAttribute("href", "https://wa.me/905551234567");
    expect(
      screen.getByRole("link", { name: "clientDetails.call" })
    ).toHaveAttribute("href", "tel:+905551234567");
    expect(
      screen.getByRole("link", { name: "clientDetails.email" })
    ).toHaveAttribute("href", "mailto:lead@example.com");

    expect(screen.getByTestId("custom-instagram")).toHaveTextContent("@test");
    expect(
      screen.getByText(/clientDetails.createdOn/)
    ).toBeInTheDocument();
  });

  it("shows validation toast and avoids saving invalid custom field values", async () => {
    validateFieldValueMock.mockReturnValue({
      isValid: false,
      error: "Invalid field value",
    });

    render(
      <UnifiedClientDetails
        lead={baseLead}
        showQuickActions={false}
      />
    );

    const inlineContainer = screen.getByTestId("custom-instagram").parentElement as HTMLElement;
    const inlineKey = inlineContainer.dataset.inlineKey ?? "";
    const { saveHandlers } = jest.requireMock("@/components/fields/InlineEditField") as {
      saveHandlers: Map<string, (value: string) => Promise<void> | void>;
    };
    const customSave = saveHandlers.get(inlineKey);
    expect(customSave).toBeDefined();

    await act(async () => {
      await customSave!(" invalid value ");
    });

    expect(validateFieldValueMock).toHaveBeenCalledWith("invalid value");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Invalid field value",
      })
    );
    expect(updateCustomFieldMock).not.toHaveBeenCalled();
  });
});
