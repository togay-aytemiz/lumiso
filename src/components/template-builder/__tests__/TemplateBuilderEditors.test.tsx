import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/utils/testUtils";
import { OptimizedTemplateEditor } from "../OptimizedTemplateEditor";
import { InlineSubjectEditor } from "../InlineSubjectEditor";
import { InlinePreheaderEditor } from "../InlinePreheaderEditor";

const dndHooks: { onDragEnd?: (result: any) => void } = {};
const imageLibraryCalls: any[] = [];

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock("../BlockEditor", () => ({
  BlockEditor: ({
    block,
    onUpdate,
    onRemove,
    onMoveDown,
    onMoveUp,
  }: any) => {
    const React = require("react");
    const { ImageLibrarySheet } = require("../ImageLibrarySheet");
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
            <ImageLibrarySheet
              open={isLibraryOpen}
              onOpenChange={setIsLibraryOpen}
              onImageSelect={handleImageSelect}
            />
          </>
        )}
      </div>
    );
  },
}));

jest.mock("../AddBlockSheet", () => ({
  AddBlockSheet: ({ open, onAddBlock }: any) =>
    open ? (
      <button
        data-testid="mock-add-block"
        onClick={() => onAddBlock("image")}
      >
        add-image
      </button>
    ) : null,
}));

jest.mock("../EmojiPicker", () => ({
  EmojiPicker: ({ onEmojiSelect }: any) => (
    <button
      type="button"
      data-testid="emoji-picker"
      onClick={() => onEmojiSelect("😀")}
    >
      emoji
    </button>
  ),
}));

jest.mock("../VariablePicker", () => ({
  VariablePicker: ({ onVariableSelect, trigger }: any) =>
    trigger
      ? React.cloneElement(trigger, {
          onClick: () => onVariableSelect("{variable}"),
        })
      : (
        <button
          type="button"
          data-testid="variable-picker"
          onClick={() => onVariableSelect("{variable}")}
        >
          variable
        </button>
      ),
}));

jest.mock("../ImageLibrarySheet", () => ({
  ImageLibrarySheet: (props: any) => {
    imageLibraryCalls.push(props);
    if (!props.open) {
      return null;
    }
    return (
      <div data-testid="mock-image-library">
        <button
          type="button"
          data-testid="mock-library-select"
          onClick={() => props.onImageSelect("https://cdn.lumiso.test/library.jpg", "Library Image")}
        >
          select-library-image
        </button>
      </div>
    );
  },
}));

jest.mock("@hello-pangea/dnd", () => {
  const React = require("react");
  return {
    DragDropContext: ({ onDragEnd, children }: any) => {
      dndHooks.onDragEnd = onDragEnd;
      return <div data-testid="drag-context">{typeof children === "function" ? children() : children}</div>;
    },
    Droppable: ({ children }: any) =>
      children({
        innerRef: jest.fn(),
        droppableProps: {},
        placeholder: null,
      }),
    Draggable: ({ children, draggableId }: any) =>
      children(
        {
          innerRef: jest.fn(),
          draggableProps: { "data-draggable-id": draggableId },
          dragHandleProps: { "data-drag-handle": draggableId },
        },
        { isDragging: false }
      ),
  };
});

describe("OptimizedTemplateEditor", () => {
  beforeEach(() => {
    imageLibraryCalls.length = 0;
  });

  const baseBlocks = [
    {
      id: "block-1",
      type: "text" as const,
      data: { content: "Hi", formatting: {} },
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
    const onBlocksChange = jest.fn();

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
    const onBlocksChange = jest.fn();

    render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    fireEvent.click(
      screen.getByText("templateBuilder.blockTitles.text")
    );
    fireEvent.click(screen.getByTestId("editor-move-down"));

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const reordered = onBlocksChange.mock.calls[0][0];
    expect(reordered.map((block: any) => block.id)).toEqual([
      "block-2",
      "block-1",
    ]);
  });

  it("reorders blocks when drag and drop completes", async () => {
    const onBlocksChange = jest.fn();

    render(
      <OptimizedTemplateEditor blocks={baseBlocks} onBlocksChange={onBlocksChange} />
    );

    expect(dndHooks.onDragEnd).toBeDefined();

    act(() => {
      dndHooks.onDragEnd?.({
        source: { index: 0 },
        destination: { index: 1 },
        draggableId: "block-1",
        type: "DEFAULT",
      });
    });

    await waitFor(() => expect(onBlocksChange).toHaveBeenCalled());
    const reordered = onBlocksChange.mock.calls[0][0];
    expect(reordered.map((block: any) => block.id)).toEqual([
      "block-2",
      "block-1",
    ]);
  });

  it("adds a new block through the add block sheet", async () => {
    const onBlocksChange = jest.fn();

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
    const onBlocksChange = jest.fn();

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
    const imageBlock = newBlocks.find((block: any) => block.type === "image");
    expect(imageBlock).toBeDefined();
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
    const updatedImageBlock = updatedBlocks.find((block: any) => block.id === imageBlock.id);
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
