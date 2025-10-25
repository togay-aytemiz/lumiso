import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnhancedAddLeadDialog } from "../EnhancedAddLeadDialog";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";

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
    footerActions = [],
    onDirtyClose,
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
            onClick={action.onClick}
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
  NavigationGuardDialog: ({ open, message, onDiscard, onStay, onSaveAndExit }: any) =>
    open ? (
      <div data-testid="navigation-guard">
        <p data-testid="navigation-guard-message">{message}</p>
        <button onClick={onStay}>stay</button>
        {onSaveAndExit && <button onClick={onSaveAndExit}>save-exit</button>}
        <button onClick={onDiscard}>discard</button>
      </div>
    ) : null
}));

jest.mock("@/components/ui/loading-presets", () => ({
  FormLoadingSkeleton: () => <div data-testid="loading-skeleton">loading</div>
}));

jest.mock("../DynamicLeadFormFields", () => ({
  DynamicLeadFormFields: ({ fieldDefinitions }: any) => {
    const { register } = require("react-hook-form").useFormContext();
    return (
      <div>
        {fieldDefinitions
          .filter((field: any) => field.is_visible_in_form)
          .map((field: any) => (
            <label key={field.id}>
              {field.label}
              <input
                data-testid={`field-${field.field_key}`}
                {...register(`field_${field.field_key}`)}
              />
            </label>
          ))}
      </div>
    );
  }
}));

jest.mock("@/hooks/useLeadFieldDefinitions", () => ({
  useLeadFieldDefinitions: jest.fn()
}));

jest.mock("@/hooks/useLeadFieldValues", () => ({
  useLeadFieldValues: jest.fn()
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn()
}));

const toastMock = {
  success: jest.fn(),
  error: jest.fn(),
};

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(() => toastMock)
}));

jest.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { id: "profile-1" } })
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  }
}));

const leadStatusQueries: any[] = [];
const leadsQueries: any[] = [];

const createLeadStatusesQuery = () => {
  const query: any = {
    _selectFields: "",
    select: jest.fn(function (fields: string) {
      query._selectFields = fields;
      return query;
    }),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(() => {
      if (query._selectFields === "name") {
        return Promise.resolve({ data: { name: "New" } });
      }
      if (query._selectFields === "id") {
        return Promise.resolve({ data: { id: "status-1" } });
      }
      return Promise.resolve({ data: null });
    })
  };
  leadStatusQueries.push(query);
  return query;
};

const createLeadsQuery = () => {
  const query: any = {
    _payload: null,
    insert: jest.fn(function (payload: any) {
      query._payload = payload;
      return query;
    }),
    select: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: "lead-123" }, error: null }))
  };
  leadsQueries.push(query);
  return query;
};

const useLeadFieldDefinitionsMock = useLeadFieldDefinitions as jest.Mock;
const useLeadFieldValuesMock = useLeadFieldValues as jest.Mock;
const getUserOrganizationIdMock = getUserOrganizationId as jest.Mock;
const useI18nToastMock = useI18nToast as jest.Mock;
const supabaseFromMock = supabase.from as jest.Mock;
const supabaseAuthGetUserMock = supabase.auth.getUser as jest.Mock;

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
    options: { options: ["New", "Contacted"] },
    validation_rules: null,
    allow_multiple: false,
    created_at: "2024-01-01",
    updated_at: "2024-01-01"
  }
];

describe("EnhancedAddLeadDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    leadStatusQueries.length = 0;
    leadsQueries.length = 0;
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return createLeadStatusesQuery();
      }
      if (table === "leads") {
        return createLeadsQuery();
      }
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseAuthGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
    useI18nToastMock.mockReturnValue(toastMock);
  });

  it("renders loading skeleton while field definitions load", () => {
    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions: [], loading: true });
    useLeadFieldValuesMock.mockReturnValue({ upsertFieldValues: jest.fn() });

    render(
      <EnhancedAddLeadDialog open onOpenChange={jest.fn()} onClose={jest.fn()} />
    );

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("submits a new lead with default status and field values", async () => {
    const upsertFieldValues = jest.fn();
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions, loading: false });
    useLeadFieldValuesMock.mockReturnValue({ upsertFieldValues });

    render(
      <EnhancedAddLeadDialog
        open
        onOpenChange={jest.fn()}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(leadStatusQueries.length).toBeGreaterThan(0);
      expect(leadStatusQueries[0].maybeSingle).toHaveBeenCalled();
    });

    const nameInput = await screen.findByTestId("field-name");
    fireEvent.change(nameInput, { target: { value: "Alice" } });

    const emailInput = screen.getByTestId("field-email");
    fireEvent.change(emailInput, { target: { value: "alice@example.com" } });

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(leadsQueries.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(leadsQueries[0]._payload).toMatchObject({
        organization_id: "org-123",
        user_id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        phone: null,
        notes: null,
        status_id: "status-1"
      });
    });

    expect(upsertFieldValues).toHaveBeenCalledWith("lead-123", {
      name: "Alice",
      email: "alice@example.com",
      status: "New"
    });

    expect(toastMock.success).toHaveBeenCalledWith("leadDialog.successCreated");
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a navigation guard when attempting to close with dirty changes", async () => {
    const upsertFieldValues = jest.fn();
    const onClose = jest.fn();

    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions, loading: false });
    useLeadFieldValuesMock.mockReturnValue({ upsertFieldValues });

    render(
      <EnhancedAddLeadDialog
        open
        onOpenChange={jest.fn()}
        onClose={onClose}
      />
    );

    const nameInput = await screen.findByTestId("field-name");
    fireEvent.change(nameInput, { target: { value: "Draft" } });

    await waitFor(() => {
      expect(screen.getByTestId("modal-dirty")).toHaveTextContent("dirty");
    });

    fireEvent.click(screen.getByTestId("close-button"));

    const guard = await screen.findByTestId("navigation-guard");
    expect(guard).toBeInTheDocument();
    expect(screen.getByTestId("navigation-guard-message")).toHaveTextContent(
      "dialogs.unsavedChanges"
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("discard"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
