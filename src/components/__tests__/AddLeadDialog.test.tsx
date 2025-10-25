import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import AddLeadDialog from "../AddLeadDialog";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { useProfile } from "@/contexts/ProfileContext";
import { leadSchema, sanitizeHtml, sanitizeInput } from "@/lib/validation";
import { ZodError } from "zod";

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

jest.mock("@/contexts/ProfileContext", () => ({
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
  }: any) => (
    <div data-testid="app-sheet-modal" data-title={title} data-dirty={dirty ? "dirty" : "clean"}>
      {children}
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
      <button type="button" data-testid="dirty-close" onClick={() => onDirtyClose?.()}>
        close-modal
      </button>
    </div>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select data-testid="status-select" value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}));

jest.mock("../settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: ({ open, message, onDiscard, onStay, onSaveAndExit }: any) =>
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

const toastMock = {
  success: jest.fn(),
  error: jest.fn(),
};

const mockHandleModalClose = jest.fn();
const mockHandleDiscard = jest.fn();
const mockHandleStay = jest.fn();
const mockHandleSaveAndExit = jest.fn();

const mockUseModalNavigation = useModalNavigation as jest.Mock;
const mockUseI18nToast = useI18nToast as jest.Mock;
const mockGetUserOrganizationId = getUserOrganizationId as jest.Mock;
const mockUseOrganizationQuickSettings = useOrganizationQuickSettings as jest.Mock;
const mockUseProfile = useProfile as jest.Mock;

const mockLeadSchemaParseAsync = (leadSchema as unknown as { parseAsync: jest.Mock }).parseAsync;
const mockSanitizeInput = sanitizeInput as jest.Mock;
const mockSanitizeHtml = sanitizeHtml as jest.Mock;

const createStatusFetch = (statuses: any[]) => {
  const order = jest.fn().mockResolvedValue({ data: statuses, error: null });
  const select = jest.fn().mockReturnValue({ order });
  return { select, order };
};

const createDefaultFromResponse = () => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
});

const originalFromImplementation = (mockSupabaseClient.from.getMockImplementation() || ((table: string) => createDefaultFromResponse())) as (
  table: string
) => any;

describe("AddLeadDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (originalFromImplementation) {
      mockSupabaseClient.from.mockImplementation(originalFromImplementation);
    }
    mockSupabaseClient.from.mockClear();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockUseI18nToast.mockReturnValue(toastMock);
    mockGetUserOrganizationId.mockResolvedValue("org-1");
    mockUseOrganizationQuickSettings.mockReturnValue({ settings: { show_quick_status_buttons: true } });
    mockUseProfile.mockReturnValue({ profile: { id: "profile-1" } });

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
    if (originalFromImplementation) {
      mockSupabaseClient.from.mockImplementation(originalFromImplementation);
    }
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

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return { select } as any;
      }
      if (table === "leads") {
        return { insert: jest.fn() } as any;
      }
      return originalFromImplementation ? originalFromImplementation(table) : ({} as any);
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
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    mockSanitizeHtml.mockResolvedValue("sanitized notes");

    const statuses = [
      { id: "status-1", name: "New", color: "#ff0", is_system_final: false },
    ];

    const { select } = createStatusFetch(statuses);

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return { select } as any;
      }
      if (table === "leads") {
        return {
          insert: insertMock,
        } as any;
      }
      return {} as any;
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

    mockUseOrganizationQuickSettings.mockReturnValue({ settings: { show_quick_status_buttons: false } });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return { select } as any;
      }
      return { insert: jest.fn() } as any;
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

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "lead_statuses") {
        return { select } as any;
      }
      return { insert: jest.fn() } as any;
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
