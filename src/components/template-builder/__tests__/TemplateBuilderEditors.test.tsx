import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/utils/testUtils";
import { DropResult } from "@hello-pangea/dnd";
import { OptimizedTemplateEditor } from "../OptimizedTemplateEditor";
import { InlineSubjectEditor } from "../InlineSubjectEditor";
import { InlinePreheaderEditor } from "../InlinePreheaderEditor";
import { TemplateBlock } from "@/types/templateBuilder";

type DragEndHandler = (result: DropResult) => void;

const dndHooks: { onDragEnd?: DragEndHandler } = {};

interface ImageLibrarySheetMockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect?: (imageUrl: string, altText?: string) => void;
}

const imageLibraryCalls: ImageLibrarySheetMockProps[] = [];

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock("../BlockEditor", () => {
  type BlockEditorProps = {
    block: TemplateBlock;
    onUpdate: (data: TemplateBlock["data"]) => void;
    onRemove: () => void;
    onMoveDown: () => void;
    onMoveUp: () => void;
  };

  const MockImageLibrarySheet: React.FC<ImageLibrarySheetMockProps> = (props) => {
    imageLibraryCalls.push(props);
    if (!props.open) {
      return null;
    }

    return (
      <div data-testid="mock-image-library">
        <button
          type="button"
          data-testid="mock-library-select"
          onClick={() =>
            props.onImageSelect?.(
              "https://cdn.lumiso.test/library.jpg",
              "Library Image"
            )
          }
        >
          select-library-image
        </button>
      </div>
    );
  };

  const BlockEditor: React.FC<BlockEditorProps> = ({
    block,
    onUpdate,
    onRemove,
    onMoveDown,
    onMoveUp,
  }) => {
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);

    const handleImageSelect = (src: string, alt?: string) => {
      onUpdate({ ...block.data, src, alt, placeholder: false });
      setIsLibraryOpen(false);
    };

    return (
      <div data-testid={`editor-${block.id}`}>
        <button
          data-testid="editor-update"
          onClick={() => onUpdate({ ...block.data, updated: true })}
        >
          update
        </button>
        <button data-testid="editor-remove" onClick={onRemove}>
          remove
        </button>
        <button data-testid="editor-move-down" onClick={onMoveDown}>
          move-down
        </button>
        <button data-testid="editor-move-up" onClick={onMoveUp}>
          move-up
        </button>
        {block.type === "image" && (
          <>
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
            >
              templateBuilder.blockEditor.image.openLibrary
            </button>
            <MockImageLibrarySheet
              open={isLibraryOpen}
              onOpenChange={setIsLibraryOpen}
              onImageSelect={handleImageSelect}
            />
          </>
        )}
      </div>
    );
  };

  return { BlockEditor };
});

jest.mock("../AddBlockSheet", () => {
  interface AddBlockSheetProps {
    open: boolean;
    onAddBlock: (type: TemplateBlock["type"]) => void;
    onOpenChange?: (open: boolean) => void;
  }

  const AddBlockSheet: React.FC<AddBlockSheetProps> = ({ open, onAddBlock }) =>
    open ? (
      <button
        data-testid="mock-add-block"
        onClick={() => onAddBlock("image")}
      >
        add-image
      </button>
    ) : null;

  return { AddBlockSheet };
});

jest.mock("../EmojiPicker", () => {
  interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
  }

  const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => (
    <button
      type="button"
      data-testid="emoji-picker"
      onClick={() => onEmojiSelect("😀")}
    >
      emoji
    </button>
  );

  return { EmojiPicker };
});

jest.mock("../VariablePicker", () => {
  interface VariablePickerProps {
    onVariableSelect: (variable: string) => void;
    trigger?: React.ReactElement;
  }

  const VariablePicker: React.FC<VariablePickerProps> = ({ onVariableSelect, trigger }) => {
    if (trigger && React.isValidElement(trigger)) {
      const existingOnClick = trigger.props.onClick as ((event: React.MouseEvent) => void) | undefined;

      return React.cloneElement(trigger, {
        onClick: (event: React.MouseEvent) => {
          existingOnClick?.(event);
          onVariableSelect("{variable}");
        },
      });
    }

    return (
      <button
        type="button"
        data-testid="variable-picker"
        onClick={() => onVariableSelect("{variable}")}
      >
        variable
      </button>
    );
  };

  return { VariablePicker };
});

jest.mock("@hello-pangea/dnd", () => {
  type DragDropContextProps = React.PropsWithChildren<{
    onDragEnd: DragEndHandler;
  }>;

  type DroppableRenderProps = {
    innerRef: (element: HTMLElement | null) => void;
    droppableProps: Record<string, unknown>;
    placeholder: React.ReactNode;
  };

  type DroppableProps = {
    children: (provided: DroppableRenderProps) => React.ReactNode;
  };

  type DraggableRenderProps = {
    innerRef: (element: HTMLElement | null) => void;
    draggableProps: Record<string, unknown>;
    dragHandleProps: Record<string, unknown>;
  };

  type DraggableSnapshot = { isDragging: boolean };

  type DraggableProps = {
    children: (provided: DraggableRenderProps, snapshot: DraggableSnapshot) => React.ReactNode;
    draggableId: string;
    index: number;
  };

  const DragDropContext: React.FC<DragDropContextProps> = ({ onDragEnd, children }) => {
    dndHooks.onDragEnd = onDragEnd;
    const content = typeof children === "function" ? (children as () => React.ReactNode)() : children;
    return <div data-testid="drag-context">{content}</div>;
  };

  const Droppable: React.FC<DroppableProps> = ({ children }) =>
    children({
      innerRef: jest.fn(),
      droppableProps: {},
      placeholder: null,
    });

  const Draggable: React.FC<DraggableProps> = ({ children, draggableId }) =>
    children(
      {
        innerRef: jest.fn(),
        draggableProps: { "data-draggable-id": draggableId },
        dragHandleProps: { "data-drag-handle": draggableId },
      },
      { isDragging: false }
    );

  return { DragDropContext, Droppable, Draggable };
});

describe("OptimizedTemplateEditor", () => {
  beforeEach(() => {
    imageLibraryCalls.length = 0;
  });

  const baseBlocks: TemplateBlock[] = [
    {
      id: "block-1",
      type: "text" as const,
      data: { content: "Hi", formatting: { fontSize: "p" } },
      visible: true,
      order: 0,
    },
    {
      id: "block-2",
      type: "cta" as const,
      data: { text: "Book", variant: "primary" },
      visible: true,
      order: 1,
    },
  ];

  it("updates block content when the editor emits changes", async () => {
    const onBlocksChange = jest.fn<(blocks: TemplateBlock[]) => void>();

    render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    fireEvent.click(
      screen.getByText("templateBuilder.blockTitles.text")
    );

    expect(screen.getByTestId("editor-block-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("editor-update"));

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const updatedBlocks = onBlocksChange.mock.calls[0][0];
    expect(updatedBlocks[0].data.updated).toBe(true);
  });

  it("reorders blocks when move controls are triggered", async () => {
    const onBlocksChange = jest.fn<(blocks: TemplateBlock[]) => void>();

    render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    fireEvent.click(
      screen.getByText("templateBuilder.blockTitles.text")
    );
    fireEvent.click(screen.getByTestId("editor-move-down"));

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const reordered = onBlocksChange.mock.calls[0][0];
    expect(reordered.map((block) => block.id)).toEqual([
      "block-2",
      "block-1",
    ]);
  });

  it("reorders blocks when drag and drop completes", async () => {
    const onBlocksChange = jest.fn<(blocks: TemplateBlock[]) => void>();

    render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    expect(dndHooks.onDragEnd).toBeDefined();

    act(() => {
      const dropResult: DropResult = {
        draggableId: "block-1",
        type: "DEFAULT",
        source: { droppableId: "templateBlocks", index: 0 },
        destination: { droppableId: "templateBlocks", index: 1 },
        reason: "DROP",
        mode: "FLUID",
        combine: null,
      };
      dndHooks.onDragEnd?.(dropResult);
    });

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const reordered = onBlocksChange.mock.calls[0][0];
    expect(reordered.map((block) => block.id)).toEqual([
      "block-2",
      "block-1",
    ]);
  });

  it("adds a new block through the add block sheet", async () => {
    const onBlocksChange = jest.fn<(blocks: TemplateBlock[]) => void>();

    render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.editor.addBlock",
      })
    );

    fireEvent.click(screen.getByTestId("mock-add-block"));

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const newBlocks = onBlocksChange.mock.calls[0][0];
    expect(newBlocks).toHaveLength(3);
    expect(newBlocks[2].type).toBe("image");
    expect(newBlocks[2].visible).toBe(true);
  });

  it("opens the image library and applies selected image", async () => {
    const onBlocksChange = jest.fn<(blocks: TemplateBlock[]) => void>();

    const { rerender } = render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "templateBuilder.editor.addBlock",
      })
    );
    fireEvent.click(screen.getByTestId("mock-add-block"));

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const newBlocks = onBlocksChange.mock.calls[0][0];
    const imageBlock = newBlocks.find((block) => block.type === "image");
    if (!imageBlock) {
      throw new Error("Image block was not added");
    }
    onBlocksChange.mockClear();

    rerender(
      <OptimizedTemplateEditor blocks={newBlocks} onBlocksChange={onBlocksChange} />
    );

    fireEvent.click(screen.getByText("templateBuilder.blockTitles.image"));
    const openLibraryButton = await screen.findByRole("button", {
      name: "templateBuilder.blockEditor.image.openLibrary",
    });
    fireEvent.click(openLibraryButton);

    expect(imageLibraryCalls.some((call) => call.open === true)).toBe(true);

    fireEvent.click(screen.getByTestId("mock-library-select"));

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const updatedBlocks = onBlocksChange.mock.calls[0][0];
    const updatedImageBlock = updatedBlocks.find((block) => block.id === imageBlock.id);
    if (!updatedImageBlock) {
      throw new Error("Updated image block not found");
    }
    expect(updatedImageBlock.data.src).toBe("https://cdn.lumiso.test/library.jpg");
    expect(updatedImageBlock.data.alt).toBe("Library Image");
    expect(updatedImageBlock.data.placeholder).toBe(false);
  });
});

describe("InlineSubjectEditor", () => {
  it("auto-saves edits on blur and highlights warnings", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    render(
      <InlineSubjectEditor value="Welcome" onSave={onSave} onCancel={onCancel} />
    );

    const input = screen.getByRole("textbox");
    const longText =
      "This is a FREE limited time offer that contains enough characters to clearly exceed the recommended subject length for any campaign.";

    fireEvent.change(input, { target: { value: longText } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "This is a FREE limited time offer that contains enough characters to clearly exceed the recommended subject length for any campaign."
      )
    );

    expect(
      screen.getByText(/characters \(too long\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Spam words:/i)).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("emoji-picker"));
    expect((input as HTMLInputElement).value).toContain("😀");

    fireEvent.click(screen.getByRole("button", { name: "{…}" }));
    expect((input as HTMLInputElement).value).toContain("{variable}");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("InlinePreheaderEditor", () => {
  it("saves updated preheader text and supports variable insertion", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    render(
      <InlinePreheaderEditor
        value="Initial preheader"
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Updated content" } });

    fireEvent.click(screen.getByRole("button", { name: "{…}" }));
    expect(input).toHaveValue("Updated content{variable}");

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith("Updated content{variable}")
    );

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
