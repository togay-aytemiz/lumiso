import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GripVertical, Eye, EyeOff, Trash2 } from "lucide-react";
import { TemplateBlock, BlockData, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { BlockEditor } from "./BlockEditor";
import { AddBlockSheet } from "./AddBlockSheet";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useTranslation } from 'react-i18next';

interface TemplateEditorProps {
  blocks: TemplateBlock[];
  onBlocksChange: (blocks: TemplateBlock[]) => void;
}

export function TemplateEditor({ blocks, onBlocksChange }: TemplateEditorProps) {
  const { t } = useTranslation('pages');
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const getBlockTitle = (type: TemplateBlock["type"]) => {
    switch (type) {
      case "text": return t('templateBuilder.blockTitles.text');
      case "session-details": return t('templateBuilder.blockTitles.sessionDetails');
      case "cta": return t('templateBuilder.blockTitles.cta');
      case "image": return t('templateBuilder.blockTitles.image');
      case "footer": return t('templateBuilder.blockTitles.footer');
      case "divider": return t('templateBuilder.blockTitles.divider');
      case "columns": return t('templateBuilder.blockTitles.columns');
      case "social-links": return t('templateBuilder.blockTitles.socialLinks');
      case "header": return t('templateBuilder.blockTitles.header');
      case "raw-html": return t('templateBuilder.blockTitles.rawHtml');
      default: return t('templateBuilder.blockTitles.unknown');
    }
  };

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

  const updateBlock = (blockId: string, data: BlockData) => {
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
        <h2 className="font-semibold">{t('templateBuilder.editor.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('templateBuilder.editor.description')}</p>
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
                          "cursor-pointer transition-all duration-200",
                          activeBlock === block.id && "ring-2 ring-primary",
                          !block.visible && "opacity-50",
                          snapshot.isDragging && "shadow-lg"
                        )}
                        onClick={() => setActiveBlock(activeBlock === block.id ? null : block.id)}
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeBlock(block.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {activeBlock === block.id && (
                          <CardContent className="pt-0 overflow-hidden animate-in slide-in-from-top-2 duration-200">
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
          <Plus className="h-4 w-4 mr-2" />
          {t('templateBuilder.editor.addBlock')}
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
        showName: true,
        showType: true,
        showDuration: false,
        showStatus: false,
        showProject: false,
        showPackage: false,
        showMeetingLink: false,
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
        channelVisibility: {},
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
      throw new Error(`Unsupported template block type: ${type}`);
  }
}
