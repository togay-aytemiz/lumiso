import type {
  ComponentProps,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AddLeadDialog from "../AddLeadDialog";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { useProfile } from "@/hooks/useProfile";
import { leadSchema, sanitizeHtml, sanitizeInput } from "@/lib/validation";
import { ZodError } from "zod";
import type { Database } from "@/integrations/supabase/types";

interface FooterActionMock {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface AppSheetModalProps {
  title: string;
  dirty?: boolean;
  children?: ReactNode;
  footerActions?: FooterActionMock[];
  onDirtyClose?: () => void;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (next: string) => void;
  children?: ReactNode;
}

interface SelectItemProps {
  value: string;
  children?: ReactNode;
}

interface NavigationGuardDialogProps {
  open: boolean;
  message?: string;
  onDiscard: () => void;
  onStay: () => void;
  onSaveAndExit?: () => void;
}

type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];
type LeadInsertPayload = Database["public"]["Tables"]["leads"]["Insert"];

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: jest.fn(),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationQuickSettings", () => ({
  useOrganizationQuickSettings: jest.fn(() => ({ settings: { show_quick_status_buttons: true } })),
}));

jest.mock("@/hooks/useProfile", () => ({
  useProfile: jest.fn(() => ({ profile: { id: "profile-1" } })),
}));

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn(),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    title,
    dirty,
    children,
    footerActions = [],
    onDirtyClose,
  }: AppSheetModalProps) => (
    <div data-testid="app-sheet-modal" data-title={title} data-dirty={dirty ? "dirty" : "clean"}>
      {children}
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
      <button type="button" data-testid="dirty-close" onClick={() => onDirtyClose?.()}>
        close-modal
      </button>
    </div>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children, ...rest }: SelectProps) => (
    <select
      data-testid="status-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...rest}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: SelectItemProps) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}));

jest.mock("../settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message, onDiscard, onStay, onSaveAndExit }: NavigationGuardDialogProps) =>
    open ? (
      <div data-testid="navigation-guard">
        <p>{message}</p>
        <button onClick={onStay}>stay</button>
        {onSaveAndExit && <button onClick={onSaveAndExit}>save-exit</button>}
        <button onClick={onDiscard}>discard</button>
      </div>
    ) : null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));

jest.mock("@/lib/validation", () => {
  const actual = jest.requireActual("@/lib/validation");
  return {
    ...actual,
    leadSchema: { parseAsync: jest.fn() },
    sanitizeInput: jest.fn((value: string) => value.trim()),
    sanitizeHtml: jest.fn(async (value: string) => value),
  };
});

type I18nToastMock = ReturnType<typeof useI18nToast>;

const toastMock: I18nToastMock = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};

const mockHandleModalClose = jest.fn();
const mockHandleDiscard = jest.fn();
const mockHandleStay = jest.fn();
const mockHandleSaveAndExit = jest.fn(async () => {});

const mockUseModalNavigation = useModalNavigation as jest.MockedFunction<typeof useModalNavigation>;
const mockUseI18nToast = useI18nToast as jest.MockedFunction<typeof useI18nToast>;
const mockGetUserOrganizationId = getUserOrganizationId as jest.MockedFunction<typeof getUserOrganizationId>;
const mockUseOrganizationQuickSettings = useOrganizationQuickSettings as jest.MockedFunction<typeof useOrganizationQuickSettings>;
const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;

type LeadSchemaMock = { parseAsync: jest.Mock<Promise<unknown>, [unknown]> };
const mockLeadSchemaParseAsync = (leadSchema as unknown as LeadSchemaMock).parseAsync;
const mockSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;
const mockSanitizeHtml = sanitizeHtml as jest.MockedFunction<typeof sanitizeHtml>;

const supabaseFromMock = mockSupabaseClient.from as jest.Mock<unknown, [string]>;

type StatusOrderMock = jest.Mock<
  Promise<{ data: LeadStatusRow[]; error: null }>,
  [string, { ascending?: boolean }?]
>;

type StatusSelectMock = jest.Mock<{ order: StatusOrderMock }, [string?]>;

interface LeadStatusTableMock {
  select: StatusSelectMock;
}

interface LeadsTableMock {
  insert: jest.Mock<Promise<{ error: { message: string } | null }>, [LeadInsertPayload[]]>;
}

interface DefaultTableMock {
  select: jest.Mock<DefaultTableMock, [string?]>;
  insert: jest.Mock<DefaultTableMock, [unknown]>;
  update: jest.Mock<DefaultTableMock, [unknown]>;
  delete: jest.Mock<DefaultTableMock, []>;
  eq: jest.Mock<DefaultTableMock, [string, unknown]>;
  in: jest.Mock<DefaultTableMock, [string, unknown[]]>;
  order: jest.Mock<DefaultTableMock, [string, { ascending?: boolean }?]>;
  limit: jest.Mock<DefaultTableMock, [number]>;
  single: jest.Mock<Promise<unknown>, []>;
}

const createStatusFetch = (statuses: LeadStatusRow[]) => {
  const order: StatusOrderMock = jest.fn(async () => ({ data: statuses, error: null }));
  const select: StatusSelectMock = jest.fn(() => ({ order }));
  return { select, order };
};

const createLeadsTableMock = (
  insertMock: LeadsTableMock["insert"],
): LeadsTableMock => ({
  insert: insertMock,
});

const createDefaultFromResponse = (): DefaultTableMock => {
  const table: Partial<DefaultTableMock> = {};
  table.select = jest.fn(() => table as DefaultTableMock);
  table.insert = jest.fn(() => table as DefaultTableMock);
  table.update = jest.fn(() => table as DefaultTableMock);
  table.delete = jest.fn(() => table as DefaultTableMock);
  table.eq = jest.fn(() => table as DefaultTableMock);
  table.in = jest.fn(() => table as DefaultTableMock);
  table.order = jest.fn(() => table as DefaultTableMock);
  table.limit = jest.fn(() => table as DefaultTableMock);
  table.single = jest.fn(async () => undefined);
  return table as DefaultTableMock;
};

type SupabaseFromImplementation = (table: string) => unknown;

const originalFromImplementation: SupabaseFromImplementation =
  (mockSupabaseClient.from.getMockImplementation() as SupabaseFromImplementation | undefined) ??
  ((table: string) => createDefaultFromResponse());

type ProfileHookReturn = ReturnType<typeof useProfile>;
type QuickSettingsReturn = ReturnType<typeof useOrganizationQuickSettings>;

const createProfileHookValue = (
  overrides: Partial<ProfileHookReturn> = {},
): ProfileHookReturn => ({
  profile: { id: "profile-1" },
  loading: false,
  uploading: false,
  updateProfile: jest.fn(),
  uploadProfilePhoto: jest.fn(),
  deleteProfilePhoto: jest.fn(),
  refreshProfile: jest.fn(async () => {}),
  ...overrides,
});

const createQuickSettingsValue = (
  showQuickStatusButtons = true,
  overrides: Partial<QuickSettingsReturn> = {},
): QuickSettingsReturn => ({
  settings: { show_quick_status_buttons: showQuickStatusButtons },
  loading: false,
  refetch: jest.fn(async () => {}),
  ...overrides,
});

describe("AddLeadDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseFromMock.mockReset();
    supabaseFromMock.mockImplementation(originalFromImplementation);
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockUseI18nToast.mockReturnValue(toastMock);
    mockGetUserOrganizationId.mockResolvedValue("org-1");
    mockUseOrganizationQuickSettings.mockReturnValue(createQuickSettingsValue());
    mockUseProfile.mockReturnValue(createProfileHookValue());

    mockHandleModalClose.mockReturnValue(true);
    mockHandleDiscard.mockImplementation(() => {});
    mockHandleStay.mockImplementation(() => {});
    mockHandleSaveAndExit.mockImplementation(async () => {});

    mockUseModalNavigation.mockImplementation(() => ({
      showGuard: false,
      message: "guard",
      handleModalClose: mockHandleModalClose,
      handleDiscardChanges: mockHandleDiscard,
      handleStayOnModal: mockHandleStay,
      handleSaveAndExit: mockHandleSaveAndExit,
    }));

    mockLeadSchemaParseAsync.mockResolvedValue(true);
    mockSanitizeInput.mockImplementation((value: string) => value.trim());
    mockSanitizeHtml.mockImplementation(async (value: string) => value);
  });

  afterEach(() => {
    supabaseFromMock.mockImplementation(originalFromImplementation);
  });

  const renderDialog = (props: Partial<ComponentProps<typeof AddLeadDialog>> = {}) => {
    const defaultProps = {
      onLeadAdded: jest.fn(),
      open: true,
      onOpenChange: jest.fn(),
    } satisfies ComponentProps<typeof AddLeadDialog>;

    return render(<AddLeadDialog {...defaultProps} {...props} />);
  };

  it("disables submission while the name field is empty", async () => {
    const statuses = [
      { id: "status-1", name: "New", color: "#ff0", is_system_final: false },
    ];

    const { select } = createStatusFetch(statuses);

    const leadStatusesTable: LeadStatusTableMock = { select };
    const leadsTable = createLeadsTableMock(jest.fn(async () => ({ error: null })));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return leadStatusesTable;
      }
      if (table === "leads") {
        return leadsTable;
      }
      return originalFromImplementation(table);
    });

    renderDialog();

    await waitFor(() => {
      expect(select).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    expect(screen.getByTestId("footer-action-1")).toBeDisabled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("creates a lead with sanitized payload and resets the form", async () => {
    const insertMock: LeadsTableMock["insert"] = jest.fn(async () => ({ error: null }));

    mockSanitizeHtml.mockResolvedValue("sanitized notes");

    const statuses = [
      { id: "status-1", name: "New", color: "#ff0", is_system_final: false },
    ];

    const { select } = createStatusFetch(statuses);

    const leadStatusesTable: LeadStatusTableMock = { select };
    const leadsTable = createLeadsTableMock(insertMock);

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return leadStatusesTable;
      }
      if (table === "leads") {
        return leadsTable;
      }
      return originalFromImplementation(table);
    });

    const onLeadAdded = jest.fn();
    const onOpenChange = jest.fn();

    renderDialog({ onLeadAdded, onOpenChange });

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    fireEvent.change(screen.getByLabelText(/forms:labels.name/i), { target: { value: "  Taylor  " } });
    fireEvent.change(screen.getByLabelText(/forms:labels.email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/forms:labels.notes/i), { target: { value: "Needs info" } });

    expect(screen.getByTestId("footer-action-1")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("footer-action-1"));

    await waitFor(() => {
      expect(mockLeadSchemaParseAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: "user-1",
        organization_id: "org-1",
        name: "Taylor",
        email: "user@example.com",
        notes: "sanitized notes",
        status: "New",
      }),
    ]);

    expect(toastMock.success).toHaveBeenCalledWith("forms:messages.leadAddedDesc:  Taylor  ");
    expect(onLeadAdded).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await waitFor(() => {
      expect((screen.getByLabelText(/forms:labels.name/i) as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText(/forms:labels.email/i) as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText(/forms:labels.notes/i) as HTMLTextAreaElement).value).toBe("");
    });
  });

  it("filters final statuses when quick status buttons are disabled", async () => {
    const statuses = [
      { id: "status-1", name: "New", color: "#ff0", is_system_final: false },
      { id: "status-2", name: "Won", color: "#0f0", is_system_final: true },
    ];

    const { select } = createStatusFetch(statuses);

    mockUseOrganizationQuickSettings.mockReturnValue(createQuickSettingsValue(false));

    const leadStatusesTable: LeadStatusTableMock = { select };
    const leadsTable = createLeadsTableMock(jest.fn(async () => ({ error: null })));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return leadStatusesTable;
      }
      if (table === "leads") {
        return leadsTable;
      }
      return originalFromImplementation(table);
    });

    renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["New"]);
  });

  it("invokes navigation guard handlers when the dialog has unsaved changes", async () => {
    const statuses = [
      { id: "status-1", name: "New", color: "#ff0", is_system_final: false },
    ];

    const { select } = createStatusFetch(statuses);

    const leadStatusesTable: LeadStatusTableMock = { select };
    const leadsTable = createLeadsTableMock(jest.fn(async () => ({ error: null })));

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return leadStatusesTable;
      }
      if (table === "leads") {
        return leadsTable;
      }
      return originalFromImplementation(table);
    });

    renderDialog();

    await waitFor(() => {
      expect(select).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-select")).toHaveValue("New");
    });

    fireEvent.change(screen.getByLabelText(/forms:labels.name/i), { target: { value: "Alex" } });

    fireEvent.click(screen.getByTestId("dirty-close"));

    expect(mockHandleModalClose).toHaveBeenCalled();

    await waitFor(() => {
      expect((screen.getByLabelText(/forms:labels.name/i) as HTMLInputElement).value).toBe("");
    });
  });
});
