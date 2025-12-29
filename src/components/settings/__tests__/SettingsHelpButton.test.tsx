import { fireEvent, render, screen } from "@/utils/testUtils";
import type { ReactNode, SVGProps } from "react";
import { SettingsHelpButton } from "../SettingsHelpButton";

const useIsMobileMock = jest.fn();
const appSheetModalMock = jest.fn();

type MockFooterAction = {
  label: string;
  onClick: () => void;
};

type MockAppSheetModalProps = {
  title?: ReactNode;
  children?: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  footerActions?: MockFooterAction[];
  size?: string;
};

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: (props: MockAppSheetModalProps) => {
    appSheetModalMock(props);
    if (!props.isOpen) {
      return null;
    }

    return (
      <div data-testid="help-modal">
        <h2>{props.title}</h2>
        <div>{props.children}</div>
        {props.footerActions?.map((action) => (
          <button key={action.label} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
        <button onClick={() => props.onOpenChange(false)}>Close</button>
      </div>
    );
  },
}));

jest.mock("lucide-react", () => ({
  HelpCircle: (props: SVGProps<SVGSVGElement>) => (
    <svg data-icon="HelpCircle" {...props} />
  ),
}));

describe("SettingsHelpButton", () => {
  const helpContent = {
    title: "Settings Help",
    description: "Need some assistance?",
    sections: [
      { title: "Overview", content: "Details about settings." },
      { title: "Tips", content: "Useful best practices." },
    ],
  };

  let windowOpenSpy: jest.SpyInstance;

  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    appSheetModalMock.mockClear();
    windowOpenSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  it("opens help modal and triggers footer actions on desktop", async () => {
    render(<SettingsHelpButton helpContent={helpContent} />);

    fireEvent.click(screen.getByRole("button", { name: "Need Help" }));

    expect(await screen.findByTestId("help-modal")).toBeInTheDocument();
    expect(screen.getByText("Settings Help")).toBeInTheDocument();
    expect(screen.getByText("Details about settings.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Documentation" }));
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://docs.lovable.dev/",
      "_blank"
    );

    fireEvent.click(screen.getByRole("button", { name: "Need Help" }));
    expect(await screen.findByTestId("help-modal")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Email Support" }));
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "mailto:support@lovable.dev?subject=Settings Help Request",
      "_blank"
    );
  });

  it("renders icon-only button on mobile", () => {
    useIsMobileMock.mockReturnValue(true);
    render(<SettingsHelpButton helpContent={helpContent} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.queryByText("Need Help")).not.toBeInTheDocument();
  });
});
