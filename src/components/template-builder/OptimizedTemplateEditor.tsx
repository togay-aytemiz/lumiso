import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GripVertical, Eye, EyeOff } from "lucide-react";
import { TemplateBlock, BlockData, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { BlockEditor } from "./BlockEditor";
import { AddBlockSheet } from "./AddBlockSheet";
import { useTranslation } from 'react-i18next';

import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface OptimizedTemplateEditorProps {
  blocks: TemplateBlock[];
  onBlocksChange: (blocks: TemplateBlock[]) => void;
}

// Helper function to get block title translation key
function getBlockTitleKey(type: TemplateBlock["type"]): string {
  switch (type) {
    case "text": return 'template_builder.blockTitles.text';
    case "session-details": return 'template_builder.blockTitles.sessionDetails';
    case "cta": return 'template_builder.blockTitles.cta';
    case "image": return 'template_builder.blockTitles.image';
    case "footer": return 'template_builder.blockTitles.footer';
    case "divider": return 'template_builder.blockTitles.divider';
    case "columns": return 'template_builder.blockTitles.columns';
    case "social-links": return 'template_builder.blockTitles.socialLinks';
    case "header": return 'template_builder.blockTitles.header';
    case "raw-html": return 'template_builder.blockTitles.rawHtml';
    default: return 'template_builder.blockTitles.unknown';
  }
}

// Memoized block component to prevent unnecessary re-renders
const MemoizedBlockCard = React.memo(({ 
  block, 
  index, 
  isActive, 
  onActivate, 
  onToggleVisibility, 
  onUpdate, 
  onRemove, 
  onMove,
  canMoveUp,
  canMoveDown,
  totalBlocks
}: {
  block: TemplateBlock;
  index: number;
  isActive: boolean;
  onActivate: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  totalBlocks: number;
}) => {
  const { t } = useTranslation('pages');
  
  const handleClick = useCallback(() => {
    onActivate(block.id);
  }, [block.id, onActivate]);

  const handleToggleVisibility = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleVisibility(block.id);
  }, [block.id, onToggleVisibility]);

  const handleUpdate = useCallback((data: any) => {
    onUpdate(block.id, data);
  }, [block.id, onUpdate]);

  const handleRemove = useCallback(() => {
    onRemove(block.id);
  }, [block.id, onRemove]);

  const handleMoveUp = useCallback(() => {
    onMove(block.id, "up");
  }, [block.id, onMove]);

  const handleMoveDown = useCallback(() => {
    onMove(block.id, "down");
  }, [block.id, onMove]);

  return (
    <Draggable key={block.id} draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "cursor-pointer transition-colors",
            isActive && "ring-2 ring-primary",
            !block.visible && "opacity-50",
            snapshot.isDragging && "shadow-lg"
          )}
          onClick={handleClick}
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
                {t(getBlockTitleKey(block.type))}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleToggleVisibility}
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
          {isActive && (
            <CardContent className="pt-0">
              <BlockEditor
                block={block}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
              />
            </CardContent>
          )}
        </Card>
      )}
    </Draggable>
  );
});

MemoizedBlockCard.displayName = 'MemoizedBlockCard';

export const OptimizedTemplateEditor = React.memo(({ 
  blocks, 
  onBlocksChange
}: OptimizedTemplateEditorProps) => {
  const { t } = useTranslation('pages');
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const addBlock = useCallback((type: TemplateBlock["type"]) => {
    const newBlock: TemplateBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: getDefaultBlockData(type),
      visible: true,
      order: blocks.length,
    };
    
    const newBlocks = [...blocks, newBlock];
    onBlocksChange(newBlocks);
    setActiveBlock(newBlock.id);
    setShowAddBlock(false);
  }, [blocks, onBlocksChange]);

  const updateBlock = useCallback((blockId: string, data: any) => {
    const newBlocks = blocks.map(block => 
      block.id === blockId ? { ...block, data } : block
    );
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const toggleBlockVisibility = useCallback((blockId: string) => {
    const newBlocks = blocks.map(block => 
      block.id === blockId ? { ...block, visible: !block.visible } : block
    );
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const removeBlock = useCallback((blockId: string) => {
    const newBlocks = blocks.filter(block => block.id !== blockId);
    onBlocksChange(newBlocks);
    if (activeBlock === blockId) {
      setActiveBlock(null);
    }
  }, [blocks, onBlocksChange, activeBlock]);

  const moveBlock = useCallback((blockId: string, direction: "up" | "down") => {
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
  }, [blocks, onBlocksChange]);

  const onDragEnd = useCallback((result: DropResult) => {
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
  }, [blocks, onBlocksChange]);

  const handleShowAddBlock = useCallback(() => {
    setShowAddBlock(true);
  }, []);

  const handleSetShowAddBlock = useCallback((show: boolean) => {
    setShowAddBlock(show);
  }, []);

  // Memoize the blocks list to prevent unnecessary re-renders
  const memoizedBlocks = useMemo(() => {
    return blocks.map((block, index) => (
      <MemoizedBlockCard
        key={block.id}
        block={block}
        index={index}
        isActive={activeBlock === block.id}
        onActivate={setActiveBlock}
        onToggleVisibility={toggleBlockVisibility}
        onUpdate={updateBlock}
        onRemove={removeBlock}
        onMove={moveBlock}
        canMoveUp={index > 0}
        canMoveDown={index < blocks.length - 1}
        totalBlocks={blocks.length}
      />
    ));
  }, [blocks, activeBlock, toggleBlockVisibility, updateBlock, removeBlock, moveBlock]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div>
          <h2 className="font-semibold">{t('template_builder.editor.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('template_builder.editor.description')}</p>
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
                {memoizedBlocks}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add Block Button */}
        <Button
          variant="outline"
          className="w-full h-12 border-dashed"
          onClick={handleShowAddBlock}
        >
          <Plus className="h-4 w-4" />
          {t('template_builder.editor.addBlock')}
        </Button>
      </div>

      {/* Add Block Sheet */}
      <AddBlockSheet
        open={showAddBlock}
        onOpenChange={handleSetShowAddBlock}
        onAddBlock={addBlock}
      />
    </div>
  );
});

OptimizedTemplateEditor.displayName = 'OptimizedTemplateEditor';

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
      return {} as any;
  }
}