import { fireEvent, render, screen } from "@/utils/testUtils";
import { NavigationGuardDialog } from "../NavigationGuardDialog";

const translations: Record<string, string> = {
  "forms:navigationGuard.title": "Leave without saving?",
  "forms:navigationGuard.message": "Unsaved changes will be lost.",
  "forms:navigationGuard.stay": "Stay here",
  "forms:navigationGuard.saveAndExit": "Save & exit",
  "forms:navigationGuard.discardChanges": "Discard changes",
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

const alertDialogMock = jest.fn();

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, onOpenChange, children }: any) => {
    alertDialogMock(onOpenChange);
    if (!open) return null;
    return (
      <div data-testid="alert-dialog">
        {typeof children === "function" ? children({ onOpenChange }) : children}
        <button data-testid="close-dialog" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    );
  },
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe("NavigationGuardDialog", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders default copy and triggers stay/discard callbacks", () => {
    const onStay = jest.fn();
    const onDiscard = jest.fn();

    render(
      <NavigationGuardDialog
        open
        onStay={onStay}
        onDiscard={onDiscard}
      />
    );

    expect(screen.getByText("Leave without saving?")).toBeInTheDocument();
    expect(
      screen.getByText("Unsaved changes will be lost.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stay here" }));
    expect(onStay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("invokes optional save and exit callback when provided", () => {
    const onStay = jest.fn();
    const onDiscard = jest.fn();
    const onSaveAndExit = jest.fn();

    render(
      <NavigationGuardDialog
        open
        onStay={onStay}
        onDiscard={onDiscard}
        onSaveAndExit={onSaveAndExit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save & exit" }));
    expect(onSaveAndExit).toHaveBeenCalledTimes(1);
  });

  it("calls onStay when dialog requests to close", () => {
    const onStay = jest.fn();
    const onDiscard = jest.fn();

    render(
      <NavigationGuardDialog
        open
        onStay={onStay}
        onDiscard={onDiscard}
      />
    );

    fireEvent.click(screen.getByTestId("close-dialog"));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("renders a custom message when provided", () => {
    render(
      <NavigationGuardDialog
        open
        message="Custom guard message."
        onStay={jest.fn()}
        onDiscard={jest.fn()}
      />
    );

    expect(screen.getByText("Custom guard message.")).toBeInTheDocument();
  });
});
