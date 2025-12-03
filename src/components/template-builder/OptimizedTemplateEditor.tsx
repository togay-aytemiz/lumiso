import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GripVertical, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TemplateBlock, BlockData, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { BlockEditor } from "./BlockEditor";
import { AddBlockSheet } from "./AddBlockSheet";
import { EmptyStateBlockSelector } from "./EmptyStateBlockSelector";
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useOrganizationSettings, type OrganizationSettings } from "@/hooks/useOrganizationSettings";
import type { TFunction } from "i18next";

interface OptimizedTemplateEditorProps {
  blocks: TemplateBlock[];
  onBlocksChange: (blocks: TemplateBlock[]) => void;
}

// Helper function to get block title translation key
function getBlockTitleKey(type: TemplateBlock["type"]): string {
  switch (type) {
    case "text": return 'templateBuilder.blockTitles.text';
    case "session-details": return 'templateBuilder.blockTitles.sessionDetails';
    case "cta": return 'templateBuilder.blockTitles.cta';
    case "image": return 'templateBuilder.blockTitles.image';
    case "footer": return 'templateBuilder.blockTitles.footer';
    case "divider": return 'templateBuilder.blockTitles.divider';
    case "columns": return 'templateBuilder.blockTitles.columns';
    case "social-links": return 'templateBuilder.blockTitles.socialLinks';
    case "header": return 'templateBuilder.blockTitles.header';
    case "raw-html": return 'templateBuilder.blockTitles.rawHtml';
    default: return 'templateBuilder.blockTitles.unknown';
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
  onUpdate: (id: string, data: BlockData) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  totalBlocks: number;
}) => {
  const { t } = useTranslation('pages');

  const handleHeaderToggle = useCallback(() => {
    onActivate(block.id);
  }, [block.id, onActivate]);

  const handleHeaderKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(block.id);
    }
  }, [block.id, onActivate]);

  const handleToggleVisibility = useCallback(() => {
    onToggleVisibility(block.id);
  }, [block.id, onToggleVisibility]);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate(block.id);
  }, [block.id, onActivate]);

  const handleUpdate = useCallback((data: BlockData) => {
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
      {(provided, snapshot) => {
        const { style, ...draggableProps } = provided.draggableProps;
        return (
          <Collapsible
            ref={provided.innerRef}
            {...draggableProps}
            style={style}
            open={isActive}
            className="w-full"
          >
            <Card
              className={cn(
                "transition-colors",
                isActive && "ring-2 ring-primary",
                !block.visible && "opacity-50",
                snapshot.isDragging && "shadow-lg"
              )}
            >
              <CardHeader
                className={cn(
                  "space-y-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive ? "pt-4 pb-2" : "py-3 md:py-3 min-h-[60px] justify-center"
                )}
                role="button"
                tabIndex={0}
                aria-expanded={isActive}
                onClick={handleHeaderToggle}
                onKeyDown={handleHeaderKeyDown}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <CardTitle className={cn("text-sm flex items-center gap-2", !isActive && "gap-1.5")}>
                    <div
                      {...provided.dragHandleProps}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {t(getBlockTitleKey(block.type))}
                  </CardTitle>
                  <div className={cn("flex items-center", isActive ? "gap-2" : "gap-1.5")}>
                    <div
                      className={cn("flex items-center", isActive ? "gap-2" : "gap-1.5")}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-muted-foreground">
                        {block.visible
                          ? t("templateBuilder.editor.visibility.visible")
                          : t("templateBuilder.editor.visibility.hidden")}
                      </span>
                      <Switch
                        checked={block.visible}
                        onCheckedChange={() => handleToggleVisibility()}
                        aria-label={block.visible
                          ? t("templateBuilder.editor.visibility.visible")
                          : t("templateBuilder.editor.visibility.hidden")}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove();
                      }}
                      className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" />
                      {t("templateBuilder.blockEditor.remove")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleToggleExpand}
                      aria-label={isActive ? t('templateBuilder.editor.collapseBlock') : t('templateBuilder.editor.expandBlock')}
                    >
                      {isActive ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isActive && <Separator className="mt-1 mb-4" />}
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity">
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
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      }}
    </Draggable>
  );
});

MemoizedBlockCard.displayName = 'MemoizedBlockCard';

export const OptimizedTemplateEditor = React.memo(({
  blocks,
  onBlocksChange
}: OptimizedTemplateEditorProps) => {
  const { t } = useTranslation('pages');
  const { settings: organizationSettings } = useOrganizationSettings();
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const handleActivateBlock = useCallback((blockId: string) => {
    setActiveBlock((current) => current === blockId ? null : blockId);
  }, []);

  const addBlock = useCallback((type: TemplateBlock["type"]) => {
    const newBlock: TemplateBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: getDefaultBlockData(type, t, organizationSettings),
      visible: true,
      order: blocks.length,
    };

    // Trigger transition animation when adding first block
    if (blocks.length === 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }

    const newBlocks = [...blocks, newBlock];
    onBlocksChange(newBlocks);
    setActiveBlock(newBlock.id);
    setShowAddBlock(false);
  }, [blocks, onBlocksChange, t, organizationSettings]);

  const updateBlock = useCallback((blockId: string, data: BlockData) => {
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
        onActivate={handleActivateBlock}
        onToggleVisibility={toggleBlockVisibility}
        onUpdate={updateBlock}
        onRemove={removeBlock}
        onMove={moveBlock}
        canMoveUp={index > 0}
        canMoveDown={index < blocks.length - 1}
        totalBlocks={blocks.length}
      />
    ));
  }, [blocks, activeBlock, toggleBlockVisibility, updateBlock, removeBlock, moveBlock, handleActivateBlock]);

  return (
    <div className="h-full flex flex-col">
      {/* Header - only show when blocks exist */}
      {blocks.length > 0 && (
        <div className="border-b px-6 py-4">
          <div>
            <h2 className="font-semibold">{t('templateBuilder.editor.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('templateBuilder.editor.description')}</p>
          </div>
        </div>
      )}

      {/* Blocks List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {blocks.length === 0 ? (
          <div
            className={cn(
              "transition-all duration-300 ease-out",
              isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
            )}
          >
            <EmptyStateBlockSelector onAddBlock={addBlock} />
          </div>
        ) : (
          <div
            className={cn(
              "transition-all duration-300 ease-out",
              isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
            )}
          >
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
              className="w-full h-12 border-dashed mt-4"
              onClick={handleShowAddBlock}
            >
              <Plus className="h-4 w-4" />
              {t('templateBuilder.editor.addBlock')}
            </Button>
          </div>
        )}
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

function resolveBusinessName(organizationSettings?: OrganizationSettings | null, t?: TFunction<"pages">) {
  if (!organizationSettings) {
    return t?.("templateBuilder.preview.mockData.businessName", { defaultValue: "Your Business" }) || "Your Business";
  }
  return (
    organizationSettings.photography_business_name ||
    organizationSettings.taxProfile?.companyName ||
    t?.("templateBuilder.preview.mockData.businessName", { defaultValue: "Your Business" }) ||
    "Your Business"
  );
}

function getDefaultBlockData(
  type: TemplateBlock["type"],
  t: TFunction<"pages">,
  organizationSettings?: OrganizationSettings | null
): BlockData {
  switch (type) {
    case "text":
      return {
        content: "",
        formatting: {
          fontSize: "p" as const,
          fontFamily: "Arial",
          alignment: "left" as const,
          color: "#111827",
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
        text: t("templateBuilder.blockEditor.cta.defaultText", {
          defaultValue: "Visit our website",
        }),
        variant: "primary" as const,
      } as CTABlockData;
    case "image":
      return {
        placeholder: true,
        alt: t("templateBuilder.blockEditor.image.defaultAlt", { defaultValue: "Image" }),
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
        content: [
          t("templateBuilder.blockEditor.columns.columnPlaceholder", { index: 1, defaultValue: "Column 1" }),
          t("templateBuilder.blockEditor.columns.columnPlaceholder", { index: 2, defaultValue: "Column 2" }),
        ],
      };
    case "social-links":
      return {
        channelVisibility: {},
        channelNames: {},
      };
    case "header":
      return {
        showLogo: true,
        tagline: resolveBusinessName(organizationSettings, t),
        backgroundColor: "#ffffff",
        logoAlignment: "center",
      };
    case "raw-html":
      return {
        html: "<div>Your custom HTML here...</div>",
        sanitized: false,
      };
    default:
      return {} as BlockData;
  }
}
