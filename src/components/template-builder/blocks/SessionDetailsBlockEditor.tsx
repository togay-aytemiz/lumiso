import { Calendar, GripVertical, Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Block } from "@/pages/TemplateBuilder";

interface SessionDetailsBlockEditorProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onRemove: () => void;
}

export function SessionDetailsBlockEditor({ block, onUpdate, onRemove }: SessionDetailsBlockEditorProps) {
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
            <div className="p-1.5 rounded bg-info/10">
              <Calendar className="h-3 w-3 text-info" />
            </div>
            <span className="font-medium text-sm">Session Details</span>
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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id={`show-date-${block.id}`}
              checked={block.content.showDate}
              onCheckedChange={(checked) => updateContent({ showDate: checked })}
            />
            <Label htmlFor={`show-date-${block.id}`} className="text-sm">
              Show Date
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id={`show-time-${block.id}`}
              checked={block.content.showTime}
              onCheckedChange={(checked) => updateContent({ showTime: checked })}
            />
            <Label htmlFor={`show-time-${block.id}`} className="text-sm">
              Show Time
            </Label>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id={`show-location-${block.id}`}
            checked={block.content.showLocation}
            onCheckedChange={(checked) => updateContent({ showLocation: checked })}
          />
          <Label htmlFor={`show-location-${block.id}`} className="text-sm">
            Show Location
          </Label>
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Additional Notes</Label>
          <Textarea
            value={block.content.notes || ''}
            onChange={(e) => updateContent({ notes: e.target.value })}
            placeholder="Optional notes to include with session details..."
            className="resize-none"
            rows={2}
          />
        </div>
        
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <strong>Preview:</strong> This will display the session information in a clean, structured format across all channels.
        </div>
      </CardContent>
    </Card>
  );
}