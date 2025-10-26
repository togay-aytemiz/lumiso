import { fireEvent, render, screen } from "@/utils/testUtils";
import { BottomSheetMenu } from "../BottomSheetMenu";

const sheetRenderSpy = jest.fn();

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open, onOpenChange }: any) => {
    sheetRenderSpy({ open, onOpenChange });
    return (
      <div data-testid="sheet-root" data-open={open ? "true" : "false"}>
        {children}
      </div>
    );
  },
  SheetContent: ({ children, className }: any) => (
    <div data-testid="sheet-content" data-class={className}>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: any) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}));

describe("BottomSheetMenu", () => {
  const createIcon = (testId: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={`icon-${testId}`} className={className} />;

  const baseItems = [
    {
      title: "Edit item",
      icon: createIcon("edit"),
      onClick: jest.fn(),
    },
    {
      title: "Delete item",
      icon: createIcon("delete"),
      onClick: jest.fn(),
      variant: "destructive" as const,
      testId: "delete-button",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    baseItems.forEach((item) => item.onClick.mockReset());
  });

  it("renders the menu title and provided actions", () => {
    render(
      <BottomSheetMenu
        title="Quick actions"
        isOpen
        onOpenChange={jest.fn()}
        items={baseItems}
        customContent={<div data-testid="custom-content">Custom</div>}
      />
    );

    expect(screen.getByTestId("sheet-root")).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("heading", { name: "Quick actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete item" })).toBeInTheDocument();
    expect(screen.getByTestId("icon-edit")).toBeInTheDocument();
    expect(screen.getByTestId("icon-delete")).toBeInTheDocument();
    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
  });

  it("invokes the item callback and closes the sheet when an action is clicked", () => {
    const onOpenChange = jest.fn();
    render(
      <BottomSheetMenu
        title="Quick actions"
        isOpen
        onOpenChange={onOpenChange}
        items={baseItems}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit item" }));

    expect(baseItems[0].onClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies destructive styling to destructive variants", () => {
    render(
      <BottomSheetMenu
        title="Quick actions"
        isOpen
        onOpenChange={jest.fn()}
        items={baseItems}
      />
    );

    const destructiveButton = screen.getByRole("button", { name: "Delete item" });
    expect(destructiveButton.className).toContain("text-destructive");
    expect(destructiveButton).toHaveAttribute("data-walkthrough", "delete-button");
  });
});
