import { fireEvent, render, screen } from "@/utils/testUtils";
import { HelpModal } from "../HelpModal";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ReactNode } from "react";

type DialogRenderProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DialogComponentProps = DialogRenderProps & {
  children?: ReactNode | ((props: DialogRenderProps) => ReactNode);
};

type DialogSectionProps = {
  children?: ReactNode;
  className?: string;
};

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: jest.fn(),
}));

jest.mock("@/components/support/FeatureFAQSheet", () => ({
  FeatureFAQSheet: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div data-testid="faq-sheet">
        FAQ Sheet
        <button onClick={() => onOpenChange(false)}>Close FAQ</button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/dialog", () => {
  const renderDialogChildren = (
    children: DialogComponentProps["children"],
    props: DialogRenderProps
  ): ReactNode =>
    typeof children === "function"
      ? (children as (args: DialogRenderProps) => ReactNode)(props)
      : children;

  return {
    Dialog: ({ open, onOpenChange, children }: DialogComponentProps) => (
      <div
        data-testid="dialog-root"
        data-open={open ? "true" : "false"}
        data-has-handler={typeof onOpenChange === "function" ? "true" : "false"}
      >
        {renderDialogChildren(children, { open, onOpenChange })}
      </div>
    ),
    DialogContent: ({ children, className }: DialogSectionProps) => (
      <div data-testid="dialog-content" data-class={className}>
        {children}
      </div>
    ),
    DialogHeader: ({ children, className }: DialogSectionProps) => (
      <div data-testid="dialog-header" data-class={className}>
        {children}
      </div>
    ),
    DialogTitle: ({ children }: DialogSectionProps) => <h2>{children}</h2>,
    DialogDescription: ({ children }: DialogSectionProps) => <p>{children}</p>,
  };
});

const translations: Record<string, string> = {
  "help.title": "Need a hand?",
  "help.description": "Choose how you want to reach us.",
  "help.options.faq.title": "Feature FAQ",
  "help.options.faq.description": "Browse the latest answers.",
  "help.options.email.title": "Email Support",
  "help.options.email.description": "Drop a note to our inbox.",
  "help.options.whatsapp.title": "WhatsApp",
  "help.options.whatsapp.description": "Chat with the team.",
  "help.close": "Close",
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

const useIsMobileMock = useIsMobile as jest.Mock;

describe("HelpModal", () => {
  let windowOpenSpy: jest.SpyInstance;
  let initialHref: string;

  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    windowOpenSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    initialHref = window.location.href;
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
    window.location.href = initialHref;
    jest.clearAllMocks();
  });

  it("renders support options and triggers their actions while closing the modal", () => {
    const onOpenChange = jest.fn();

    render(<HelpModal isOpen onOpenChange={onOpenChange} />);

    expect(screen.getByTestId("dialog-root")).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("heading", { name: "Need a hand?" })).toBeInTheDocument();
    expect(
      screen.getByText("Choose how you want to reach us.")
    ).toBeInTheDocument();

    // FAQ option opens the sheet
    fireEvent.click(
      screen.getByText("Feature FAQ").closest("button") as HTMLButtonElement
    );
    expect(screen.getByTestId("faq-sheet")).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Email support option
    fireEvent.click(
      screen.getByText("Email Support").closest("button") as HTMLButtonElement
    );
    expect(windowOpenSpy).toHaveBeenNthCalledWith(
      1,
      "mailto:support@lumiso.com",
      "_self"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // WhatsApp option
    fireEvent.click(
      screen.getByText("WhatsApp").closest("button") as HTMLButtonElement
    );
    expect(windowOpenSpy).toHaveBeenNthCalledWith(
      2,
      "https://wa.me/905074699692",
      "_blank"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies mobile layout tweaks and closes when pressing the footer button", () => {
    useIsMobileMock.mockReturnValue(true);
    const onOpenChange = jest.fn();

    render(<HelpModal isOpen onOpenChange={onOpenChange} />);

    expect(screen.getByTestId("dialog-root")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-content").dataset.class).toContain(
      "max-w-[calc(100vw-1.5rem)]"
    );
    expect(screen.getByTestId("dialog-content").dataset.class).toContain("rounded-2xl");
    expect(screen.getByTestId("dialog-header").dataset.class).toContain("text-center");

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toHaveClass("w-full");
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
