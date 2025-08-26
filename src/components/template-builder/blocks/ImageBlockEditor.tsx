import { Image, GripVertical, Eye, EyeOff, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Block } from "@/pages/TemplateBuilder";

interface ImageBlockEditorProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onRemove: () => void;
}

export function ImageBlockEditor({ block, onUpdate, onRemove }: ImageBlockEditorProps) {
  const updateContent = (updates: any) => {
    onUpdate({
      content: { ...block.content, ...updates }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // TODO: Implement file upload to storage
      console.log('File upload would happen here:', file);
    }
  };

  return (
    <Card className={`${!block.isVisible ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-1.5 rounded bg-warning/10">
              <Image className="h-3 w-3 text-warning" />
            </div>
            <span className="font-medium text-sm">Image Block</span>
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
          <Label className="text-sm font-medium">Image Source</Label>
          <div className="flex gap-2">
            <Input
              value={block.content.url || ''}
              onChange={(e) => updateContent({ url: e.target.value })}
              placeholder="Image URL or upload file"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(`file-${block.id}`)?.click()}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload
            </Button>
            <input
              id={`file-${block.id}`}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
        
        {block.content.url && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="border rounded-lg p-2 bg-muted/30">
              <img
                src={block.content.url}
                alt="Preview"
                className="max-w-full h-32 object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Caption (Optional)</Label>
          <Textarea
            value={block.content.caption || ''}
            onChange={(e) => updateContent({ caption: e.target.value })}
            placeholder="Image caption or description"
            className="resize-none"
            rows={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">Link (Optional)</Label>
          <Input
            value={block.content.link || ''}
            onChange={(e) => updateContent({ link: e.target.value })}
            placeholder="Make image clickable with this URL"
          />
        </div>
        
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <strong>Note:</strong> Images are not displayed in SMS messages. Only the caption text will be shown.
        </div>
      </CardContent>
    </Card>
  );
}