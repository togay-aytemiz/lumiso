import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppSheetModal } from "../app-sheet-modal";
import { useIsMobile } from "@/hooks/use-mobile";

type MockWithChildren = {
  children?: React.ReactNode;
};

type MockSheetContentProps = MockWithChildren & {
  side?: "top" | "right" | "bottom" | "left";
};

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: jest.fn(),
}));

const sheetContentMock = jest.fn(({ side, children }: MockSheetContentProps) => (
  <div data-testid="sheet-content" data-side={side}>
    {children}
  </div>
));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: MockWithChildren) => <div data-testid="sheet-root">{children}</div>,
  SheetContent: (props: MockSheetContentProps) => sheetContentMock(props),
  SheetHeader: ({ children }: MockWithChildren) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: MockWithChildren) => <div data-testid="sheet-title">{children}</div>,
  SheetFooter: ({ children }: MockWithChildren) => <div data-testid="sheet-footer">{children}</div>,
}));

describe("AppSheetModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIsMobile as jest.Mock).mockReturnValue(false);
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof AppSheetModal>> = {}) =>
    render(
      <AppSheetModal
        title="Edit Project"
        isOpen
        onOpenChange={jest.fn()}
        onDirtyClose={jest.fn()}
        footerActions={[]}
        {...props}
      >
        <div>Modal Content</div>
      </AppSheetModal>
    );

  it("uses a right-side sheet on desktop and a bottom sheet on mobile", () => {
    const initial = renderModal();
    expect(sheetContentMock).toHaveBeenCalledWith(expect.objectContaining({ side: "right" }));

    sheetContentMock.mockClear();
    (useIsMobile as jest.Mock).mockReturnValue(true);
    initial.unmount();
    renderModal({});

    expect(sheetContentMock).toHaveBeenCalledWith(expect.objectContaining({ side: "bottom" }));
  });

  it("prefers onDirtyClose over onOpenChange when the form has unsaved changes", () => {
    const onDirtyClose = jest.fn();
    const onOpenChange = jest.fn();

    renderModal({ dirty: true, onDirtyClose, onOpenChange });

    const closeButtons = screen.getAllByRole("button");
    fireEvent.click(closeButtons[0]);

    expect(onDirtyClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falls back to onOpenChange when closing a clean modal", () => {
    const onOpenChange = jest.fn();
    renderModal({ dirty: false, onOpenChange });

    const closeButtons = screen.getAllByRole("button");
    fireEvent.click(closeButtons[0]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders footer actions and fires their callbacks", () => {
    const primaryAction = jest.fn();
    const secondaryAction = jest.fn();

    renderModal({
      footerActions: [
        { label: "Cancel", onClick: secondaryAction, variant: "outline" },
        { label: "Save", onClick: primaryAction },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(secondaryAction).toHaveBeenCalledTimes(1);
    expect(primaryAction).toHaveBeenCalledTimes(1);
  });
});
