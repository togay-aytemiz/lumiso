import type { ChangeEvent, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@/utils/testUtils";
import { AddSessionTypeDialog } from "../SessionTypeDialogs";

const supabaseAuthGetUserMock = jest.fn();
const supabaseFromMock = jest.fn();
const getUserOrganizationIdMock = jest.fn();
const toastMock = jest.fn();

type FooterActionMock = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type AppSheetModalMockProps = {
  title: string;
  isOpen: boolean;
  children: ReactNode;
  footerActions?: FooterActionMock[];
};

type SelectMockProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

type SelectContentProps = {
  children: ReactNode;
};

type SelectItemProps = {
  value: string;
  children: ReactNode;
};

type SwitchMockProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
};

const createInsertChain = () => {
  const singleMock = jest.fn();
  const selectMock = jest.fn(() => ({ single: singleMock }));
  const insertMock = jest.fn(() => ({ select: selectMock }));
  supabaseFromMock.mockReturnValue({ insert: insertMock });
  return { insertMock, selectMock, singleMock };
};

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
  useToast: () => ({
    toast: (...args: unknown[]) => toastMock(...args),
  }),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ title, isOpen, children, footerActions }: AppSheetModalMockProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="app-sheet-modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>
          {footerActions?.map(action => (
            <button
              key={action.label}
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

jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: SelectMockProps) => (
    <select
      data-testid="duration-select"
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: SelectContentProps) => <>{children}</>,
  SelectValue: ({ children }: SelectContentProps) => <>{children}</>,
  SelectContent: ({ children }: SelectContentProps) => <>{children}</>,
  SelectItem: ({ value, children }: SelectItemProps) => (
    <option value={value}>{children}</option>
  ),
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: SwitchMockProps) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));

const translations: Record<string, string> = {
  "forms:sessionType.add_title": "Add session type",
  "forms:buttons.cancel": "Cancel",
  "common:buttons.cancel": "Cancel",
  "common:buttons.save": "Save",
  "common:actions.saving": "Saving…",
  "forms:sessionType.name_label": "Session type name",
  "forms:sessionType.name_placeholder": "Name your session",
  "forms:sessionType.errors.name_required": "Name is required",
  "forms:sessionType.errors.duration_required": "Duration is required",
  "forms:sessionType.duration_label": "Duration",
  "forms:sessionType.durationOptions.60m": "60 minutes",
  "forms:sessionType.durationOptions.custom": "Custom",
  "forms:sessionType.duration_custom_placeholder": "Custom minutes",
  "forms:sessionType.set_default_label": "Set as default",
  "forms:sessionType.unsaved_changes.description": "Discard unsaved changes?",
  "common.toast.success": "Success",
  "forms:sessionTypes.success.added": "Session type created.",
  "common.toast.error": "Error",
  "forms:sessionTypes.errors.add_failed": "Failed to add session type.",
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

describe("AddSessionTypeDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAuthGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getUserOrganizationIdMock.mockResolvedValue("org-123");
  });

  it("submits a new session type and notifies caller on success", async () => {
    const { singleMock } = createInsertChain();
    const onSessionTypeAdded = jest.fn();
    const onOpenChange = jest.fn();
    const createdSessionType = {
      id: "session-type-1",
      name: "Portrait",
    };

    singleMock.mockResolvedValue({ data: createdSessionType, error: null });

    render(
      <AddSessionTypeDialog
        open
        onOpenChange={onOpenChange}
        onSessionTypeAdded={onSessionTypeAdded}
        nextSortOrder={3}
      />
    );

    fireEvent.change(screen.getByLabelText("Session type name *"), {
      target: { value: "Portrait" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(getUserOrganizationIdMock).toHaveBeenCalled();
    expect(onSessionTypeAdded).toHaveBeenCalledWith({
      sessionType: createdSessionType,
      setAsDefault: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Session type created.",
      })
    );
  });

  it("surfaces validation error when name is missing", async () => {
    createInsertChain();

    render(
      <AddSessionTypeDialog
        open
        onOpenChange={jest.fn()}
        onSessionTypeAdded={jest.fn()}
        nextSortOrder={1}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("reports errors returned by Supabase when insert fails", async () => {
    const { singleMock } = createInsertChain();
    singleMock.mockResolvedValue({ data: null, error: { message: "Insert failed" } });

    render(
      <AddSessionTypeDialog
        open
        onOpenChange={jest.fn()}
        onSessionTypeAdded={jest.fn()}
        nextSortOrder={5}
      />
    );

    fireEvent.change(screen.getByLabelText("Session type name *"), {
      target: { value: "Headshot" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Insert failed",
        variant: "destructive",
      })
    );
  });
});
