import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TextBlockEditor } from "./blocks/TextBlockEditor";
import { SessionDetailsBlockEditor } from "./blocks/SessionDetailsBlockEditor";
import { CTABlockEditor } from "./blocks/CTABlockEditor";
import { ImageBlockEditor } from "./blocks/ImageBlockEditor";
import { FooterBlockEditor } from "./blocks/FooterBlockEditor";
import type { Block } from "@/pages/TemplateBuilder";

interface BlockEditorProps {
  blocks: Block[];
  onUpdateBlock: (blockId: string, updates: Partial<Block>) => void;
  onReorderBlocks: (startIndex: number, endIndex: number) => void;
  onRemoveBlock: (blockId: string) => void;
}

export function BlockEditor({ 
  blocks, 
  onUpdateBlock, 
  onReorderBlocks,
  onRemoveBlock 
}: BlockEditorProps) {
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    
    if (startIndex !== endIndex) {
      onReorderBlocks(startIndex, endIndex);
    }
  };

  const renderBlockEditor = (block: Block) => {
    switch (block.type) {
      case 'text':
        return (
          <TextBlockEditor
            block={block}
            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        );
      case 'session-details':
        return (
          <SessionDetailsBlockEditor
            block={block}
            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        );
      case 'cta':
        return (
          <CTABlockEditor
            block={block}
            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        );
      case 'image':
        return (
          <ImageBlockEditor
            block={block}
            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        );
      case 'footer':
        return (
          <FooterBlockEditor
            block={block}
            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-2">Template Editor</h2>
        <p className="text-sm text-muted-foreground">
          Configure your blocks and see the live preview on the right
        </p>
      </div>
      
      <Separator />
      
      <ScrollArea className="flex-1">
        <div className="p-6">
          {blocks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                <p className="text-lg font-medium mb-2">No blocks yet</p>
                <p className="text-sm">Add blocks from the library to start building your template</p>
              </div>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="blocks">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-4"
                  >
                    {blocks
                      .sort((a, b) => a.order - b.order)
                      .map((block, index) => (
                        <Draggable
                          key={block.id}
                          draggableId={block.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`
                                ${snapshot.isDragging ? 'shadow-lg' : ''}
                                ${!block.isVisible ? 'opacity-50' : ''}
                              `}
                            >
                              {renderBlockEditor(block)}
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}