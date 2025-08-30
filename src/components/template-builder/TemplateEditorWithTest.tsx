import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GripVertical, Eye, EyeOff } from "lucide-react";
import { TemplateBlock, BlockData, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { BlockEditor } from "./BlockEditor";
import { AddBlockSheet } from "./AddBlockSheet";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface TemplateEditorWithTestProps {
  blocks: TemplateBlock[];
  onBlocksChange: (blocks: TemplateBlock[]) => void;
}

export function TemplateEditorWithTest({ 
  blocks, 
  onBlocksChange
}: TemplateEditorWithTestProps) {
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const addBlock = (type: TemplateBlock["type"]) => {
    const newBlock: TemplateBlock = {
      id: `block-${Date.now()}`,
      type,
      data: getDefaultBlockData(type),
      visible: true,
      order: blocks.length,
    };
    
    onBlocksChange([...blocks, newBlock]);
    setActiveBlock(newBlock.id);
    setShowAddBlock(false);
  };

  const updateBlock = (blockId: string, data: any) => {
    onBlocksChange(
      blocks.map(block => 
        block.id === blockId ? { ...block, data } : block
      )
    );
  };

  const toggleBlockVisibility = (blockId: string) => {
    onBlocksChange(
      blocks.map(block => 
        block.id === blockId ? { ...block, visible: !block.visible } : block
      )
    );
  };

  const removeBlock = (blockId: string) => {
    onBlocksChange(blocks.filter(block => block.id !== blockId));
    if (activeBlock === blockId) {
      setActiveBlock(null);
    }
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;
    
    const newIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    const newBlocks = [...blocks];
    [newBlocks[blockIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[blockIndex]];
    
    // Update order values
    newBlocks.forEach((block, index) => {
      block.order = index;
    });
    
    onBlocksChange(newBlocks);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(blocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));

    onBlocksChange(updatedItems);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div>
          <h2 className="font-semibold">Template Editor</h2>
          <p className="text-sm text-muted-foreground">Add and customize blocks to build your template</p>
        </div>
      </div>

      {/* Blocks List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="template-blocks">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {blocks.map((block, index) => (
                  <Draggable key={block.id} draggableId={block.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "cursor-pointer transition-colors",
                          activeBlock === block.id && "ring-2 ring-primary",
                          !block.visible && "opacity-50",
                          snapshot.isDragging && "shadow-lg"
                        )}
                        onClick={() => setActiveBlock(block.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <div 
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              {getBlockTitle(block.type)}
                            </CardTitle>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBlockVisibility(block.id);
                                }}
                              >
                                {block.visible ? (
                                  <Eye className="h-3 w-3" />
                                ) : (
                                  <EyeOff className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {activeBlock === block.id && (
                          <CardContent className="pt-0">
                            <BlockEditor
                              block={block}
                              onUpdate={(data) => updateBlock(block.id, data)}
                              onRemove={() => removeBlock(block.id)}
                              onMoveUp={() => moveBlock(block.id, "up")}
                              onMoveDown={() => moveBlock(block.id, "down")}
                              canMoveUp={index > 0}
                              canMoveDown={index < blocks.length - 1}
                            />
                          </CardContent>
                        )}
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add Block Button */}
        <Button
          variant="outline"
          className="w-full h-12 border-dashed"
          onClick={() => setShowAddBlock(true)}
        >
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>

      {/* Add Block Sheet */}
      <AddBlockSheet
        open={showAddBlock}
        onOpenChange={setShowAddBlock}
        onAddBlock={addBlock}
      />
    </div>
  );
}

function getBlockTitle(type: TemplateBlock["type"]) {
  switch (type) {
    case "text": return "Text Block";
    case "session-details": return "Session Details";
    case "cta": return "Call to Action";
    case "image": return "Image Block";
    case "footer": return "Footer";
    case "divider": return "Divider";
    case "columns": return "Columns";
    case "social-links": return "Social Links";
    case "header": return "Header";
    case "raw-html": return "Raw HTML";
    default: return "Unknown Block";
  }
}

function getDefaultBlockData(type: TemplateBlock["type"]): BlockData {
  switch (type) {
    case "text":
      return {
        content: "Enter your text here...",
        formatting: {
          fontSize: "p" as const,
          fontFamily: "Arial",
          alignment: "left" as const,
        },
      } as TextBlockData;
    case "session-details":
      return {
        showDate: true,
        showTime: true,
        showLocation: true,
        showNotes: false,
      } as SessionDetailsBlockData;
    case "cta":
      return {
        text: "Book Now",
        variant: "primary" as const,
      } as CTABlockData;
    case "image":
      return {
        placeholder: true,
        alt: "Image",
      } as ImageBlockData;
    case "footer":
      return {
        showLogo: true,
        showStudioName: true,
        showContactInfo: true,
      } as FooterBlockData;
    case "divider":
      return {
        style: "line" as const,
        color: "#e5e5e5",
      };
    case "columns":
      return {
        columns: 2,
        content: ["Column 1 content...", "Column 2 content..."],
      };
    case "social-links":
      return {
        links: [
          { platform: "facebook" as const, url: "", show: false },
          { platform: "instagram" as const, url: "", show: true },
          { platform: "twitter" as const, url: "", show: false },
          { platform: "website" as const, url: "", show: false },
        ],
      };
    case "header":
      return {
        showLogo: true,
        tagline: "Professional Photography",
        backgroundColor: "#ffffff",
      };
    case "raw-html":
      return {
        html: "<div>Your custom HTML here...</div>",
        sanitized: false,
      };
    default:
      return {} as any;
  }
}