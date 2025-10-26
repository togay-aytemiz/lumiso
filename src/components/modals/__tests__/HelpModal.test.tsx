import { fireEvent, render, screen } from "@/utils/testUtils";
import { HelpModal } from "../HelpModal";
import { useIsMobile } from "@/hooks/use-mobile";

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: jest.fn(),
}));

jest.mock("@/components/ui/dialog", () => {
  const React = require("react");
  return {
    Dialog: ({ open, onOpenChange, children }: any) => (
      <div
        data-testid="dialog-root"
        data-open={open ? "true" : "false"}
        data-has-handler={typeof onOpenChange === "function" ? "true" : "false"}
      >
        {typeof children === "function" ? children({ open, onOpenChange }) : children}
      </div>
    ),
    DialogContent: ({ children, className }: any) => (
      <div data-testid="dialog-content" data-class={className}>
        {children}
      </div>
    ),
    DialogHeader: ({ children, className }: any) => (
      <div data-testid="dialog-header" data-class={className}>
        {children}
      </div>
    ),
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    DialogDescription: ({ children }: any) => <p>{children}</p>,
  };
});

const translations: Record<string, string> = {
  "help.title": "Need a hand?",
  "help.description": "Choose how you want to reach us.",
  "help.options.documentation.title": "Documentation",
  "help.options.documentation.description": "Read the Lumiso handbook.",
  "help.options.support.title": "Email Support",
  "help.options.support.description": "Drop a note to our support inbox.",
  "help.options.chat.title": "Live Chat",
  "help.options.chat.description": "Ping the team in real time.",
  "help.close": "Close",
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

const useIsMobileMock = useIsMobile as jest.Mock;

describe("HelpModal", () => {
let consoleSpy: jest.SpyInstance;
let windowOpenSpy: jest.SpyInstance;
let initialHref: string;


  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    windowOpenSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    initialHref = window.location.href;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
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

    // Documentation option
    fireEvent.click(
      screen.getByText("Documentation").closest("button") as HTMLButtonElement
    );
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://docs.lumiso.com",
      "_blank"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Email support option
    fireEvent.click(
      screen.getByText("Email Support").closest("button") as HTMLButtonElement
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Live chat option
    fireEvent.click(
      screen.getByText("Live Chat").closest("button") as HTMLButtonElement
    );
    expect(consoleSpy).toHaveBeenCalledWith("Opening live chat...");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies mobile layout tweaks and closes when pressing the footer button", () => {
    useIsMobileMock.mockReturnValue(true);
    const onOpenChange = jest.fn();

    render(<HelpModal isOpen onOpenChange={onOpenChange} />);

    expect(screen.getByTestId("dialog-content").dataset.class).toContain(
      "w-[calc(100vw-2rem)]"
    );
    expect(screen.getByTestId("dialog-header").dataset.class).toBe("px-2");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
