import React from "react";
import { act, fireEvent, render, screen } from "@/utils/testUtils";
import DangerZone from "../DangerZone";
import { useToast } from "@/hooks/use-toast";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
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

const mockUseToast = useToast as jest.Mock;

describe("DangerZone settings page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
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
    jest.useFakeTimers({ doNotFake: ["performance"] });
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

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "settings.dangerZone.deleteData.deleteComplete",
        description: "settings.dangerZone.deleteData.deleteCompleteDesc",
        variant: "destructive",
      })
    );
    expect(passwordInput).toHaveValue("");
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
});
