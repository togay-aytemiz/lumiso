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
    <p>{children}</p>
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

const mockUseToast = useToast as jest.Mock;

describe("DangerZone settings page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows a destructive toast when confirming without a password", async () => {
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });

    render(<DangerZone />);

    const confirmButton = screen.getAllByRole("button", {
      name: "settings.dangerZone.deleteData.button",
    })[1];

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "settings.dangerZone.deleteData.passwordRequired",
        description: "settings.dangerZone.deleteData.passwordRequiredDesc",
        variant: "destructive",
      })
    );
  });

  it("deletes successfully when a password is provided", async () => {
    jest.useFakeTimers();
    const toastSpy = jest.fn();
    mockUseToast.mockReturnValue({ toast: toastSpy });

    render(<DangerZone />);

    const passwordInput = screen.getByLabelText(
      "settings.dangerZone.deleteData.passwordLabel"
    );
    fireEvent.change(passwordInput, { target: { value: "super-secret" } });

    const confirmButton = screen.getAllByRole("button", {
      name: "settings.dangerZone.deleteData.button",
    })[1];

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
