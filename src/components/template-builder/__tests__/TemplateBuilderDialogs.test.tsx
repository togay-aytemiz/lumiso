import React from "react";
import { render, screen, fireEvent } from "@/utils/testUtils";
import { AddBlockSheet } from "../AddBlockSheet";
import { VariablePicker } from "../VariablePicker";
import { TemplateNameDialog } from "../TemplateNameDialog";
import { DeleteTemplateDialog } from "../DeleteTemplateDialog";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock("@/hooks/useTemplateVariables", () => ({
  useTemplateVariables: jest.fn(() => ({
    variables: [
      { key: "customer_name", label: "Customer Name", category: "customer" },
      { key: "session_date", label: "Session Date", category: "session" },
    ],
    loading: false,
  })),
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));

jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) =>
    asChild ? (
      React.cloneElement(children, {
        onClick: children.props.onClick,
      })
    ) : (
      <button type="button">{children}</button>
    ),
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/components/ui/command", () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ placeholder }: any) => (
    <input placeholder={placeholder} readOnly />
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ heading, children }: any) => (
    <div>
      <strong>{heading}</strong>
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect }: any) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.()}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
          onSelect?.();
        }
      }}
    >
      {children}
    </div>
  ),
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useMessagesTranslation: jest.fn(() => ({
    t: (key: string) => `messages:${key}`,
  })),
}));

describe("AddBlockSheet", () => {
  it("invokes onAddBlock with the selected block type", () => {
    const handleAdd = jest.fn();

    render(
      <AddBlockSheet open onOpenChange={jest.fn()} onAddBlock={handleAdd} />
    );

    const blockCards = screen.getAllByRole("heading", { level: 3 });
    expect(blockCards).not.toHaveLength(0);

    fireEvent.click(blockCards[0].closest("div")!);
    expect(handleAdd).toHaveBeenCalledWith("text");
  });
});

describe("VariablePicker", () => {
  it("renders grouped variables and calls onVariableSelect", () => {
    const handleSelect = jest.fn();

    render(<VariablePicker onVariableSelect={handleSelect} />);

    const variableButton = screen.getByRole("button", { name: /Variable/ });
    fireEvent.click(variableButton);

    const options = screen.getAllByRole("button", {
      name: /Customer Name|Session Date/,
    });
    expect(options).toHaveLength(2);

    fireEvent.click(options[0]);
    expect(handleSelect).toHaveBeenCalledWith("{customer_name}");
  });
});

describe("TemplateNameDialog", () => {
  it("validates input and calls onConfirm when name is valid", () => {
    const handleConfirm = jest.fn();

    render(
      <TemplateNameDialog
        open
        onClose={jest.fn()}
        onConfirm={handleConfirm}
        currentName="Untitled Template"
        existingNames={["Existing Template"]}
        action="save"
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Existing Template" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: "pages:templateBuilder.nameDialog.buttons.save",
      })
    );

    expect(
      screen.getByText("pages:templateBuilder.nameDialog.validation.duplicate")
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "New Template Name" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "pages:templateBuilder.nameDialog.buttons.save",
      })
    );

    expect(handleConfirm).toHaveBeenCalledWith("New Template Name");
  });
});

describe("DeleteTemplateDialog", () => {
  it("shows confirmation copy and triggers callbacks", () => {
    const handleClose = jest.fn();
    const handleConfirm = jest.fn();

    render(
      <DeleteTemplateDialog
        open
        onClose={handleClose}
        onConfirm={handleConfirm}
        templateName="Client Update"
      />
    );

    const alert = screen.getByRole("alert");
    const templateName = screen.getByText(
      (content, element) =>
        element?.tagName === "STRONG" && content.includes("Client Update")
    );
    expect(templateName).toBeInTheDocument();
    expect(templateName.parentElement?.textContent).toContain("permanently deleted");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Cancel/,
      })
    );
    expect(handleClose).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Delete Template/,
      })
    );
    expect(handleConfirm).toHaveBeenCalled();
  });
});
