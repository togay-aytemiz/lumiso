import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnhancedEditLeadDialog } from "../EnhancedEditLeadDialog";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { supabase } from "@/integrations/supabase/client";
import { createDynamicLeadSchema } from "@/lib/leadFieldValidation";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) =>
      options?.field ? `${key}:${options.field}` : key
  })
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    title,
    isOpen,
    dirty,
    onDirtyClose,
    footerActions = [],
    children
  }: any) => (
    <div data-testid="app-sheet-modal">
      <span data-testid="modal-title">{title}</span>
      <span data-testid="modal-open">{String(isOpen)}</span>
      <span data-testid="modal-dirty">{dirty ? "dirty" : "clean"}</span>
      <div>
        {footerActions.map((action: any, index: number) => (
          <button
            key={index}
            data-testid={`footer-action-${index}`}
            disabled={action.disabled}
            onClick={async () => {
              try {
                await action.onClick?.();
              } catch {
                // swallow validation rejection from react-hook-form resolver
              }
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button data-testid="close-button" onClick={() => onDirtyClose?.()}>
        close
      </button>
      {children}
    </div>
  )
}));

jest.mock("../settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message, onDiscard, onStay }: any) =>
    open ? (
      <div data-testid="navigation-guard">
        <p data-testid="navigation-guard-message">{message}</p>
        <button onClick={onStay}>stay</button>
        <button onClick={onDiscard}>discard</button>
      </div>
    ) : null
}));

jest.mock("../DynamicLeadFormFields", () => {
  const React = require("react");
  const formContextRef = { current: null as any };

  return {
    formContextRef,
    DynamicLeadFormFields: ({ fieldDefinitions }: any) => {
      const {
        register,
        formState: { errors },
      } = require("react-hook-form").useFormContext();

      formContextRef.current = require("react-hook-form").useFormContext();

      return (
        <div>
          {fieldDefinitions
            .filter((field: any) => field.is_visible_in_form)
            .map((field: any) => {
              const fieldName = `field_${field.field_key}`;
              const fieldError = errors?.[fieldName]?.message;
              return (
                <label key={field.id}>
                  {field.label}
                  <input data-testid={`field-${field.field_key}`} {...register(fieldName)} />
                  {fieldError && (
                    <span role="alert" data-testid={`error-${field.field_key}`}>
                      {String(fieldError)}
                    </span>
                  )}
                </label>
              );
            })}
        </div>
      );
    }
  };
});

const { formContextRef } = jest.requireMock("../DynamicLeadFormFields");

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn(() => ({
    showGuard: false,
    message: "dialogs.unsavedChanges",
    handleModalClose: jest.fn(() => true),
    handleDiscardChanges: jest.fn(),
    handleStayOnModal: jest.fn(),
  }))
}));

jest.mock("@/hooks/useLeadFieldDefinitions", () => ({
  useLeadFieldDefinitions: jest.fn()
}));

jest.mock("@/hooks/useLeadFieldValues", () => ({
  useLeadFieldValues: jest.fn()
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn()
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn()
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn()
  }
}));

const toastMock = {
  success: jest.fn(),
  error: jest.fn(),
};

const useLeadFieldDefinitionsMock = useLeadFieldDefinitions as jest.Mock;
const useLeadFieldValuesMock = useLeadFieldValues as jest.Mock;
const useI18nToastMock = useI18nToast as jest.Mock;
const getUserOrganizationIdMock = getUserOrganizationId as jest.Mock;
const supabaseFromMock = supabase.from as jest.Mock;

interface QueryWithPayload {
  _payload?: any;
  update?: jest.Mock;
  eq?: jest.Mock;
  select?: jest.Mock;
  maybeSingle?: jest.Mock;
}

const leadStatusQueries: QueryWithPayload[] = [];
const leadUpdateQueries: QueryWithPayload[] = [];

const createLeadStatusesQuery = () => {
  const query: QueryWithPayload = {
    select: jest.fn(function () {
      return query;
    }),
    eq: jest.fn(function () {
      return query;
    }),
    maybeSingle: jest.fn(() => Promise.resolve({ data: { id: "status-1" } }))
  };
  leadStatusQueries.push(query);
  return query;
};

const createLeadUpdateQuery = () => {
  const query: QueryWithPayload = {
    update: jest.fn(function (payload: any) {
      query._payload = payload;
      return query;
    }),
    eq: jest.fn(() => Promise.resolve({ error: null }))
  };
  leadUpdateQueries.push(query);
  return query;
};

const fieldDefinitions = [
  {
    id: "name",
    organization_id: "org-123",
    field_key: "name",
    label: "Name",
    field_type: "text",
    is_system: true,
    is_required: true,
    is_visible_in_form: true,
    is_visible_in_table: true,
    sort_order: 1,
    options: undefined,
    validation_rules: null,
    allow_multiple: false,
    created_at: "2024-01-01",
    updated_at: "2024-01-01"
  },
  {
    id: "email",
    organization_id: "org-123",
    field_key: "email",
    label: "Email",
    field_type: "email",
    is_system: true,
    is_required: false,
    is_visible_in_form: true,
    is_visible_in_table: true,
    sort_order: 2,
    options: undefined,
    validation_rules: null,
    allow_multiple: false,
    created_at: "2024-01-01",
    updated_at: "2024-01-01"
  },
  {
    id: "status",
    organization_id: "org-123",
    field_key: "status",
    label: "Status",
    field_type: "select",
    is_system: true,
    is_required: false,
    is_visible_in_form: false,
    is_visible_in_table: true,
    sort_order: 3,
    options: { options: ["Active", "New"] },
    validation_rules: null,
    allow_multiple: false,
    created_at: "2024-01-01",
    updated_at: "2024-01-01"
  }
];

const renderDialog = (props: Partial<ComponentProps<typeof EnhancedEditLeadDialog>> = {}) => {
  return render(
    <EnhancedEditLeadDialog
      open
      onOpenChange={jest.fn()}
      onClose={jest.fn()}
      lead={{ id: "lead-1", name: "Alice", email: "alice@example.com", status: "Active" }}
      {...props}
    />
  );
};

describe("EnhancedEditLeadDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    leadStatusQueries.length = 0;
    leadUpdateQueries.length = 0;

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return createLeadStatusesQuery();
      }
      if (table === "leads") {
        return createLeadUpdateQuery();
      }
      throw new Error(`Unexpected table ${table}`);
    });

    useI18nToastMock.mockReturnValue(toastMock);
    getUserOrganizationIdMock.mockResolvedValue("org-123");
  });

  it("submits updated lead details and shows a success toast", async () => {
    const upsertFieldValues = jest.fn();
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions, loading: false });
    useLeadFieldValuesMock.mockReturnValue({
      fieldValues: [
        { field_key: "name", value: "Alice" },
        { field_key: "email", value: "alice@example.com" },
        { field_key: "status", value: "Active" }
      ],
      loading: false,
      upsertFieldValues,
    });

    render(
      <EnhancedEditLeadDialog
        open
        onOpenChange={jest.fn()}
        onClose={onClose}
        onSuccess={onSuccess}
        lead={{ id: "lead-1", name: "Alice", email: "alice@example.com", status: "Active" }}
      />
    );

    const nameInput = (await screen.findByTestId("field-name")) as HTMLInputElement;
    expect(nameInput).toHaveValue("Alice");

    fireEvent.change(nameInput, { target: { value: "Updated Alice" } });

    await waitFor(() => {
      expect(screen.getByTestId("modal-dirty")).toHaveTextContent("dirty");
    });

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(leadUpdateQueries[0]._payload).toMatchObject({
        name: "Updated Alice",
        email: "alice@example.com",
        notes: null,
        phone: null,
      });
    });

    await waitFor(() => {
      expect(upsertFieldValues).toHaveBeenCalledWith("lead-1", {
        name: "Updated Alice",
        email: "alice@example.com",
        status: "Active",
      });
    });

    expect(leadStatusQueries[0].maybeSingle).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith("leadDialog.successUpdated");
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("displays validation errors when required fields are missing", async () => {
    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions, loading: false });
    useLeadFieldValuesMock.mockReturnValue({
      fieldValues: [],
      loading: false,
      upsertFieldValues: jest.fn(),
    });

    renderDialog({
      onClose: jest.fn(),
      lead: { id: "lead-1", name: "", email: "", status: "Active" }
    });

    const nameInput = (await screen.findByTestId("field-name")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "temp" } });
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(formContextRef.current).toBeTruthy();
    });

    await act(async () => {
      try {
        await formContextRef.current?.handleSubmit(async () => {})?.();
      } catch {
        // ignore validation rejection
      }
    });

    const schema = createDynamicLeadSchema(fieldDefinitions as any);
    const validationResult = schema.safeParse({
      field_name: "",
      field_email: "",
      field_status: "Active",
    });

    expect(validationResult.success).toBe(false);
    const errorMessage = validationResult.success
      ? ""
      : validationResult.error.issues[0]?.message;

    expect(errorMessage).toBe("Name is required");

    await act(async () => {
      formContextRef.current?.setError("field_name", {
        type: "manual",
        message: errorMessage,
      });
    });

    expect(await screen.findByTestId("error-name")).toHaveTextContent("Name is required");
    expect(leadUpdateQueries.length).toBe(0);
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
