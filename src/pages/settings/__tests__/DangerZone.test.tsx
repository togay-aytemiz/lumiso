import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import DangerZone from "../DangerZone";
import { useToast } from "@/hooks/use-toast";
import { deleteAllOrganizationData } from "@/services/organizationDataDeletion";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/services/organizationDataDeletion", () => ({
  deleteAllOrganizationData: jest.fn(),
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  __esModule: true,
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog">{children}</div>
  ),
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-page-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: () => <div data-testid="settings-header" />, 
}));

jest.mock("@/components/settings/SettingsSections", () => ({
  __esModule: true,
  SettingsSingleColumnSection: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-single-column-section">{children}</div>
  ),
}));

const mockUseToast = useToast as jest.Mock;
const mockDeleteAllOrganizationData = deleteAllOrganizationData as jest.Mock;
let originalReload: Location["reload"];
let reloadSpy: jest.Mock;

describe("DangerZone settings page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAllOrganizationData.mockResolvedValue(undefined);
    reloadSpy = jest.fn();
    originalReload = window.location.reload;
    Object.defineProperty(Object.getPrototypeOf(window.location), "reload", {
      configurable: true,
      value: reloadSpy,
    });
  });

  it("keeps delete action disabled without a password", () => {
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });

    render(<DangerZone />);

    const [triggerButton, confirmButton] = screen.getAllByRole("button", {
      name: "settings.dangerZone.deleteData.button",
    });

    fireEvent.click(triggerButton);

    expect(confirmButton).toBeDisabled();
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("deletes successfully when a password is provided", async () => {
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });

    render(<DangerZone />);

    const passwordInput = screen.getByLabelText(
      "settings.dangerZone.deleteData.passwordLabel"
    );
    fireEvent.change(passwordInput, { target: { value: "super-secret" } });

    const [triggerButton, confirmButton] = screen.getAllByRole("button", {
      name: "settings.dangerZone.deleteData.button",
    });

    fireEvent.click(triggerButton);

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(confirmButton).toBeDisabled();

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "settings.dangerZone.deleteData.deleteComplete",
          description: "settings.dangerZone.deleteData.deleteCompleteDesc",
          variant: "destructive",
        })
      );
    });

    expect(passwordInput).toHaveValue("");
    expect(mockDeleteAllOrganizationData).toHaveBeenCalledWith("super-secret");
  });

  it("clears the password field when cancelling the dialog", () => {
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });

    render(<DangerZone />);

    const passwordInput = screen.getByLabelText(
      "settings.dangerZone.deleteData.passwordLabel"
    );
    fireEvent.change(passwordInput, { target: { value: "needs-reset" } });

    const cancelButton = screen.getByRole("button", {
      name: "settings.dangerZone.deleteData.cancel",
    });

    fireEvent.click(cancelButton);

    expect(passwordInput).toHaveValue("");
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("shows an error toast when deletion fails", async () => {
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });
    mockDeleteAllOrganizationData.mockRejectedValueOnce(new Error("delete failed"));

    render(<DangerZone />);

    const passwordInput = screen.getByLabelText(
      "settings.dangerZone.deleteData.passwordLabel"
    );
    fireEvent.change(passwordInput, { target: { value: "fail-case" } });

    const [triggerButton, confirmButton] = screen.getAllByRole("button", {
      name: "settings.dangerZone.deleteData.button",
    });

    fireEvent.click(triggerButton);

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "settings.dangerZone.deleteData.deleteFailed",
          description: "settings.dangerZone.deleteData.deleteFailedDesc",
          variant: "destructive",
        })
      );
    });
  });

  afterEach(() => {
    Object.defineProperty(Object.getPrototypeOf(window.location), "reload", {
      configurable: true,
      value: originalReload,
    });
  });
});
