import React from "react";
import { render, screen, fireEvent } from "@/utils/testUtils";
import { AddBlockSheet } from "../AddBlockSheet";
import { VariablePicker } from "../VariablePicker";
import { TemplateNameDialog } from "../TemplateNameDialog";
import { DeleteTemplateDialog } from "../DeleteTemplateDialog";
import { TemplateVariablesProvider } from "@/contexts/TemplateVariablesContext";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock("@/hooks/useTemplateVariables", () => ({
  useTemplateVariables: jest.fn(() => ({
    variables: [
      { key: "lead_name", label: "Customer Name", category: "lead" },
      { key: "session_date", label: "Session Date", category: "session" },
    ],
    loading: false,
    businessInfo: null,
    getVariableValue: jest.fn((key: string) => `mock-${key}`),
    refetch: jest.fn(),
  })),
}));

jest.mock("@/components/ui/sheet", () => {
  type MockProps = React.PropsWithChildren<Record<string, unknown>>;

  const DivWrapper: React.FC<MockProps> = ({ children }) => <div>{children}</div>;
  const HeadingWrapper: React.FC<MockProps> = ({ children }) => <h2>{children}</h2>;
  const ParagraphWrapper: React.FC<MockProps> = ({ children }) => <p>{children}</p>;

  return {
    Sheet: DivWrapper,
    SheetContent: DivWrapper,
    SheetHeader: DivWrapper,
    SheetTitle: HeadingWrapper,
    SheetDescription: ParagraphWrapper,
  };
});

jest.mock("@/components/ui/popover", () => {
  type PopoverProps = React.PropsWithChildren<Record<string, unknown>>;
  interface PopoverTriggerProps extends React.PropsWithChildren {
    asChild?: boolean;
  }

  const PopoverWrapper: React.FC<PopoverProps> = ({ children }) => <div>{children}</div>;
  const PopoverContentWrapper: React.FC<PopoverProps> = ({ children }) => <div>{children}</div>;

  const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ children, asChild }) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return <button type="button">{children}</button>;
  };

  return {
    Popover: PopoverWrapper,
    PopoverTrigger,
    PopoverContent: PopoverContentWrapper,
  };
});

jest.mock("@/components/ui/command", () => {
  type CommandProps = React.PropsWithChildren<Record<string, unknown>>;

  const Command: React.FC<CommandProps> = ({ children }) => <div>{children}</div>;
  const CommandList: React.FC<CommandProps> = ({ children }) => <div>{children}</div>;
  const CommandEmpty: React.FC<CommandProps> = ({ children }) => <div>{children}</div>;

  const CommandInput: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
    <input placeholder={placeholder} readOnly />
  );

  const CommandGroup: React.FC<React.PropsWithChildren<{ heading?: string }>> = ({
    heading,
    children,
  }) => (
    <div>
      {heading ? <strong>{heading}</strong> : null}
      {children}
    </div>
  );

  const CommandItem: React.FC<React.PropsWithChildren<{ onSelect?: (value?: string) => void }>> = ({
    children,
    onSelect,
  }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.()}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter") {
          onSelect?.();
        }
      }}
    >
      {children}
    </div>
  );

  return {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
  };
});

jest.mock("@/components/ui/dialog", () => {
  type DialogProps = React.PropsWithChildren<Record<string, unknown>>;

  const DivWrapper: React.FC<DialogProps> = ({ children }) => <div>{children}</div>;
  const HeadingWrapper: React.FC<DialogProps> = ({ children }) => <h2>{children}</h2>;
  const ParagraphWrapper: React.FC<DialogProps> = ({ children }) => <p>{children}</p>;

  return {
    Dialog: DivWrapper,
    DialogContent: DivWrapper,
    DialogHeader: DivWrapper,
    DialogFooter: DivWrapper,
    DialogTitle: HeadingWrapper,
    DialogDescription: ParagraphWrapper,
  };
});

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

    const templateVariablesValue = {
      variables: [
        { key: "lead_name", label: "Customer Name", category: "lead" as const },
        { key: "session_date", label: "Session Date", category: "session" as const },
      ],
      businessInfo: null,
      loading: false,
      getVariableValue: jest.fn(),
      refetch: jest.fn(),
    };

    render(
      <TemplateVariablesProvider value={templateVariablesValue}>
        <VariablePicker onVariableSelect={handleSelect} />
      </TemplateVariablesProvider>
    );

    const variableButton = screen.getByRole("button", { name: /Variable/ });
    fireEvent.click(variableButton);

    const options = screen.getAllByRole("button", {
      name: /Customer Name|Session Date/,
    });
    expect(options).toHaveLength(2);

    fireEvent.click(options[0]);
    expect(handleSelect).toHaveBeenCalledWith("{lead_name}");
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

    const alerts = screen.getAllByRole("alert");
    expect(alerts[0]).toHaveTextContent("messages:templateDeleteDialog.workflowWarning");
    expect(alerts[1]).toHaveTextContent("messages:templateDeleteDialog.deleteWarning");

    const templateName = screen.getByText(
      (content, element) =>
        element?.tagName === "STRONG" && content.includes("Client Update")
    );
    expect(templateName).toBeInTheDocument();
    expect(templateName.parentElement?.textContent).toContain("messages:templateDeleteDialog.deleteWarning");

    fireEvent.click(
      screen.getByRole("button", {
        name: "messages:templateDeleteDialog.cancel",
      })
    );
    expect(handleClose).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "messages:templateDeleteDialog.delete",
      })
    );
    expect(handleConfirm).toHaveBeenCalled();
  });
});
