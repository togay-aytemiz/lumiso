import { MousePointer, GripVertical, Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/pages/TemplateBuilder";

interface CTABlockEditorProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onRemove: () => void;
}

export function CTABlockEditor({ block, onUpdate, onRemove }: CTABlockEditorProps) {
  const updateContent = (updates: any) => {
    onUpdate({
      content: { ...block.content, ...updates }
    });
  };

  return (
    <Card className={`${!block.isVisible ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-1.5 rounded bg-success/10">
              <MousePointer className="h-3 w-3 text-success" />
            </div>
            <span className="font-medium text-sm">Call to Action</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ isVisible: !block.isVisible })}
              className="h-7 px-2"
            >
              {block.isVisible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 px-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Primary Action</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={block.content.primaryText || ''}
              onChange={(e) => updateContent({ primaryText: e.target.value })}
              placeholder="Button text"
            />
            <Input
              value={block.content.primaryUrl || ''}
              onChange={(e) => updateContent({ primaryUrl: e.target.value })}
              placeholder="URL or link"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Secondary Action (Optional)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={block.content.secondaryText || ''}
              onChange={(e) => updateContent({ secondaryText: e.target.value })}
              placeholder="Secondary text"
            />
            <Input
              value={block.content.secondaryUrl || ''}
              onChange={(e) => updateContent({ secondaryUrl: e.target.value })}
              placeholder="Secondary URL"
            />
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <strong>Channel Behavior:</strong>
          <br />• Email: Styled buttons with hover effects
          <br />• WhatsApp: Text links with clear formatting
          <br />• SMS: Plain text with URLs
        </div>
      </CardContent>
    </Card>
  );
}