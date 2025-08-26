import { Plus, Type, Calendar, MousePointer, Image, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Block } from "@/pages/TemplateBuilder";

interface BlockLibraryProps {
  onAddBlock: (type: Block['type']) => void;
}

const BLOCK_TYPES = [
  {
    type: 'text' as const,
    name: 'Text Block',
    description: 'Rich text with formatting, emojis, and variables',
    icon: Type,
    color: 'hsl(var(--primary))'
  },
  {
    type: 'session-details' as const,
    name: 'Session Details',
    description: 'Date, time, location with clean formatting',
    icon: Calendar,
    color: 'hsl(var(--info))'
  },
  {
    type: 'cta' as const,
    name: 'Call to Action',
    description: 'Primary and secondary action buttons',
    icon: MousePointer,
    color: 'hsl(var(--success))'
  },
  {
    type: 'image' as const,
    name: 'Image Block',
    description: 'Brand images with captions and links',
    icon: Image,
    color: 'hsl(var(--warning))'
  },
  {
    type: 'footer' as const,
    name: 'Footer Block',
    description: 'Studio info, logo, and contact details',
    icon: Layout,
    color: 'hsl(var(--muted-foreground))'
  }
];

export function BlockLibrary({ onAddBlock }: BlockLibraryProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-2">Block Library</h2>
        <p className="text-sm text-muted-foreground">
          Build your template with these flexible blocks
        </p>
      </div>
      
      <Separator />
      
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              System Blocks
            </h3>
            <div className="space-y-3">
              {BLOCK_TYPES.map((blockType) => {
                const IconComponent = blockType.icon;
                return (
                  <Card
                    key={blockType.type}
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => onAddBlock(blockType.type)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div 
                          className="p-2 rounded-lg flex-shrink-0"
                          style={{ 
                            backgroundColor: `${blockType.color}15`,
                            color: blockType.color 
                          }}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{blockType.name}</h4>
                            <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {blockType.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator className="my-6" />

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Tips
            </h3>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="space-y-3 text-xs text-muted-foreground">
                  <div>
                    <strong>Variables:</strong> Use {'{customer_name}'}, {'{session_date}'}, etc. in any text block
                  </div>
                  <div>
                    <strong>Reorder:</strong> Drag and drop blocks to change their order
                  </div>
                  <div>
                    <strong>Hide/Show:</strong> Toggle block visibility without deleting
                  </div>
                  <div>
                    <strong>Live Preview:</strong> See how your template looks across all channels
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}