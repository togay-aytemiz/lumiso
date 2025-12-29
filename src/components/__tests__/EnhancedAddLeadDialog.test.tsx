import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { EnhancedAddLeadDialog } from "../EnhancedAddLeadDialog";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useFormContext } from "react-hook-form";
import type { LeadFieldDefinition } from "@/types/leadFields";

interface FooterActionMock {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface AppSheetModalProps {
  title: string;
  isOpen: boolean;
  dirty?: boolean;
  footerActions?: FooterActionMock[];
  onDirtyClose?: () => void;
  children?: ReactNode;
}

interface NavigationGuardProps {
  open: boolean;
  message?: string;
  onDiscard: () => void;
  onStay: () => void;
  onSaveAndExit?: () => void;
}


jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      typeof options?.field === "string" ? `${key}:${options.field}` : key,
  })
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    title,
    isOpen,
    dirty,
    footerActions = [],
    onDirtyClose,
    children,
  }: AppSheetModalProps) => (
    <div data-testid="app-sheet-modal">
      <span data-testid="modal-title">{title}</span>
      <span data-testid="modal-open">{String(isOpen)}</span>
      <span data-testid="modal-dirty">{dirty ? "dirty" : "clean"}</span>
      <div>
        {footerActions.map((action, index) => (
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
  NavigationGuardDialog: ({ open, message, onDiscard, onStay, onSaveAndExit }: NavigationGuardProps) =>
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
  DynamicLeadFormFields: ({ fieldDefinitions }: { fieldDefinitions: LeadFieldDefinition[] }) => {
    const { register } = useFormContext();
    return (
      <div>
        {fieldDefinitions
          .filter((field) => field.is_visible_in_form)
          .map((field) => (
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
  warning: jest.fn(),
  info: jest.fn(),
};

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(() => toastMock)
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { id: "profile-1" } })
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: () => ({
    stage: "completed",
    currentStep: 0,
    loading: false,
    shouldShowWelcomeModal: false,
    isInGuidedSetup: false,
    isOnboardingComplete: true,
    shouldLockNavigation: false,
    currentStepInfo: null,
    nextStepInfo: null,
    completedSteps: [],
    isAllStepsComplete: true,
    totalSteps: 0,
    startGuidedSetup: jest.fn(),
    completeCurrentStep: jest.fn(),
    completeMultipleSteps: jest.fn(),
    completeOnboarding: jest.fn(),
    skipOnboarding: jest.fn(),
    resetOnboarding: jest.fn(),
  })
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  }
}));

interface LeadStatusQueryMock {
  _selectFields: string;
  select: jest.Mock<LeadStatusQueryMock, [string]>;
  eq: jest.Mock<LeadStatusQueryMock, [string, unknown]>;
  order: jest.Mock<LeadStatusQueryMock, [string, { ascending?: boolean }?]>;
  limit: jest.Mock<LeadStatusQueryMock, [number]>;
  maybeSingle: jest.Mock<Promise<{ data: { id?: string; name?: string } | null }>, []>;
}

interface LeadsQueryMock {
  _payload: LeadInsert | null;
  insert: jest.Mock<LeadsQueryMock, [LeadInsert]>;
  select: jest.Mock<LeadsQueryMock, [string?]>;
  single: jest.Mock<Promise<{ data: LeadRow | null; error: unknown }>, []>;
}

const leadStatusQueries: LeadStatusQueryMock[] = [];
const leadsQueries: LeadsQueryMock[] = [];

const createLeadStatusesQuery = (): LeadStatusQueryMock => {
  const query: LeadStatusQueryMock = {
    _selectFields: "",
    select: jest.fn((fields: string) => {
      query._selectFields = fields;
      return query;
    }),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => {
      if (query._selectFields === "name") {
        return { data: { name: "New" } };
      }
      if (query._selectFields === "id") {
        return { data: { id: "status-1" } };
      }
      return { data: null };
    }),
  };
  leadStatusQueries.push(query);
  return query;
};

const createLeadsQuery = (): LeadsQueryMock => {
  const query: LeadsQueryMock = {
    _payload: null,
    insert: jest.fn((payload: LeadInsert) => {
      query._payload = payload;
      return query;
    }),
    select: jest.fn(() => query),
    single: jest.fn(async () => ({
      data: {
        id: "lead-123",
        organization_id: "org-123",
        user_id: "user-1",
        name: "Alice",
        email: null,
        phone: null,
        status: "New",
        status_id: "status-1",
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: null,
        archived_at: null,
        lead_owner_id: null,
        referral_source: null,
        project_id: null,
        is_archived: false,
      } as LeadRow,
      error: null,
    })),
  };
  leadsQueries.push(query);
  return query;
};

const useLeadFieldDefinitionsMock = useLeadFieldDefinitions as jest.MockedFunction<typeof useLeadFieldDefinitions>;
const useLeadFieldValuesMock = useLeadFieldValues as jest.MockedFunction<typeof useLeadFieldValues>;
const getUserOrganizationIdMock = getUserOrganizationId as jest.MockedFunction<typeof getUserOrganizationId>;
const useI18nToastMock = useI18nToast as jest.MockedFunction<typeof useI18nToast>;
const supabaseFromMock = supabase.from as jest.Mock<LeadStatusQueryMock | LeadsQueryMock, [string]>;
const supabaseAuthGetUserMock = supabase.auth.getUser as jest.MockedFunction<typeof supabase.auth.getUser>;

const fieldDefinitions: LeadFieldDefinition[] = [
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
    options: { options: ["New", "Contacted"] } as unknown as LeadFieldDefinition["options"],
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
    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions: [], loading: false, refetch: jest.fn() });
    useLeadFieldValuesMock.mockReturnValue({
      upsertFieldValues: jest.fn(async () => {}),
      loading: false,
      error: null,
      fieldValues: [],
      refetch: jest.fn(),
      getFieldValue: jest.fn(),
      getFieldValuesAsRecord: jest.fn(() => ({})),
    });
  });

  it("renders loading skeleton while field definitions load", () => {
    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions: [], loading: true, refetch: jest.fn() });
    useLeadFieldValuesMock.mockReturnValue({
      upsertFieldValues: jest.fn(async () => {}),
      loading: false,
      error: null,
      fieldValues: [],
      refetch: jest.fn(),
      getFieldValue: jest.fn(),
      getFieldValuesAsRecord: jest.fn(() => ({})),
    });

    render(
      <EnhancedAddLeadDialog open onOpenChange={jest.fn()} onClose={jest.fn()} />
    );

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("submits a new lead with default status and field values", async () => {
    const upsertFieldValues = jest.fn(async () => {});
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions, loading: false, refetch: jest.fn() });
    useLeadFieldValuesMock.mockReturnValue({
      upsertFieldValues,
      loading: false,
      error: null,
      fieldValues: [],
      refetch: jest.fn(),
      getFieldValue: jest.fn(),
      getFieldValuesAsRecord: jest.fn(() => ({})),
    });

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

    expect(toastMock.success).toHaveBeenCalledTimes(1);
    const toastCall = toastMock.success.mock.calls[0] as [ReactElement, { className?: string }?];
    const [toastContent, toastOptions] = toastCall;
    expect(isValidElement(toastContent)).toBe(true);

    const childrenArray = Children.toArray(toastContent.props.children);
    const [messageNode, actionNode] = childrenArray as ReactElement[];
    expect(messageNode.props.children).toBe("leadDialog.successCreated");
    expect(actionNode.props.children).toBe("buttons.view_lead");
    expect(typeof actionNode.props.onClick).toBe("function");
    expect(toastOptions).toEqual(
      expect.objectContaining({ className: "flex-col items-start" })
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "lead-123" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a navigation guard when attempting to close with dirty changes", async () => {
    const upsertFieldValues = jest.fn(async () => {});
    const onClose = jest.fn();

    useLeadFieldDefinitionsMock.mockReturnValue({ fieldDefinitions, loading: false, refetch: jest.fn() });
    useLeadFieldValuesMock.mockReturnValue({
      upsertFieldValues,
      loading: false,
      error: null,
      fieldValues: [],
      refetch: jest.fn(),
      getFieldValue: jest.fn(),
      getFieldValuesAsRecord: jest.fn(() => ({})),
    });

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
// type aliases sourced from Supabase generated types
type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
