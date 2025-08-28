import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronUp, ChevronDown, Trash2, Bold, Italic, List } from "lucide-react";
import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";

interface BlockEditorProps {
  block: TemplateBlock;
  onUpdate: (data: any) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function BlockEditor({ block, onUpdate, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: BlockEditorProps) {
  const renderEditor = () => {
    switch (block.type) {
      case "text":
        return <TextBlockEditor data={block.data as TextBlockData} onUpdate={onUpdate} />;
      case "session-details":
        return <SessionDetailsBlockEditor data={block.data as SessionDetailsBlockData} onUpdate={onUpdate} />;
      case "cta":
        return <CTABlockEditor data={block.data as CTABlockData} onUpdate={onUpdate} />;
      case "image":
        return <ImageBlockEditor data={block.data as ImageBlockData} onUpdate={onUpdate} />;
      case "footer":
        return <FooterBlockEditor data={block.data as FooterBlockData} onUpdate={onUpdate} />;
      default:
        return <div>Unknown block type</div>;
    }
  };

  return (
    <div className="space-y-4">
      {renderEditor()}
      
      <Separator />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onMoveUp} disabled={!canMoveUp}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onMoveDown} disabled={!canMoveDown}>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        
        <Button size="sm" variant="destructive" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
          Remove
        </Button>
      </div>
    </div>
  );
}

function TextBlockEditor({ data, onUpdate }: { data: TextBlockData; onUpdate: (data: TextBlockData) => void }) {
  const updateFormatting = (key: keyof TextBlockData["formatting"], value: any) => {
    onUpdate({
      ...data,
      formatting: { ...data.formatting, [key]: value }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Content</Label>
        <Textarea
          value={data.content}
          onChange={(e) => onUpdate({ ...data, content: e.target.value })}
          placeholder="Enter your text here..."
          rows={4}
        />
      </div>
      
      <div className="space-y-3">
        <Label>Formatting</Label>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={data.formatting.bold ? "default" : "outline"}
            onClick={() => updateFormatting("bold", !data.formatting.bold)}
          >
            <Bold className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={data.formatting.italic ? "default" : "outline"}
            onClick={() => updateFormatting("italic", !data.formatting.italic)}
          >
            <Italic className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={data.formatting.bullets ? "default" : "outline"}
            onClick={() => updateFormatting("bullets", !data.formatting.bullets)}
          >
            <List className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Font Size</Label>
            <Select value={data.formatting.fontSize} onValueChange={(value) => updateFormatting("fontSize", value)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h1">Heading 1</SelectItem>
                <SelectItem value="h2">Heading 2</SelectItem>
                <SelectItem value="h3">Heading 3</SelectItem>
                <SelectItem value="p">Paragraph</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs">Font Family</Label>
            <Select value={data.formatting.fontFamily} onValueChange={(value) => updateFormatting("fontFamily", value)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionDetailsBlockEditor({ data, onUpdate }: { data: SessionDetailsBlockData; onUpdate: (data: SessionDetailsBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Custom Label (optional)</Label>
        <Input
          value={data.customLabel || ""}
          onChange={(e) => onUpdate({ ...data, customLabel: e.target.value })}
          placeholder="Session Details"
        />
      </div>
      
      <div className="space-y-3">
        <Label>Show Fields</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Date</Label>
            <Switch
              checked={data.showDate}
              onCheckedChange={(checked) => onUpdate({ ...data, showDate: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Time</Label>
            <Switch
              checked={data.showTime}
              onCheckedChange={(checked) => onUpdate({ ...data, showTime: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Location</Label>
            <Switch
              checked={data.showLocation}
              onCheckedChange={(checked) => onUpdate({ ...data, showLocation: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Notes</Label>
            <Switch
              checked={data.showNotes}
              onCheckedChange={(checked) => onUpdate({ ...data, showNotes: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CTABlockEditor({ data, onUpdate }: { data: CTABlockData; onUpdate: (data: CTABlockData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Button Text</Label>
        <Input
          value={data.text}
          onChange={(e) => onUpdate({ ...data, text: e.target.value })}
          placeholder="Book Now"
        />
      </div>
      
      <div>
        <Label>Button Style</Label>
        <Select value={data.variant} onValueChange={(value) => onUpdate({ ...data, variant: value as CTABlockData["variant"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="text">Text Link</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Link URL (optional)</Label>
        <Input
          value={data.link || ""}
          onChange={(e) => onUpdate({ ...data, link: e.target.value })}
          placeholder="https://example.com"
        />
      </div>
    </div>
  );
}

function ImageBlockEditor({ data, onUpdate }: { data: ImageBlockData; onUpdate: (data: ImageBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Image URL</Label>
        <Input
          value={data.src || ""}
          onChange={(e) => onUpdate({ ...data, src: e.target.value, placeholder: !e.target.value })}
          placeholder="https://example.com/image.jpg"
        />
      </div>
      
      <div>
        <Label>Alt Text</Label>
        <Input
          value={data.alt || ""}
          onChange={(e) => onUpdate({ ...data, alt: e.target.value })}
          placeholder="Image description"
        />
      </div>
      
      <div>
        <Label>Caption (optional)</Label>
        <Input
          value={data.caption || ""}
          onChange={(e) => onUpdate({ ...data, caption: e.target.value })}
          placeholder="Image caption"
        />
      </div>
      
      <div>
        <Label>Link URL (optional)</Label>
        <Input
          value={data.link || ""}
          onChange={(e) => onUpdate({ ...data, link: e.target.value })}
          placeholder="https://example.com"
        />
      </div>
    </div>
  );
}

function FooterBlockEditor({ data, onUpdate }: { data: FooterBlockData; onUpdate: (data: FooterBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Custom Text (optional)</Label>
        <Textarea
          value={data.customText || ""}
          onChange={(e) => onUpdate({ ...data, customText: e.target.value })}
          placeholder="Additional footer content"
          rows={2}
        />
      </div>
      
      <div className="space-y-3">
        <Label>Show Elements</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Logo</Label>
            <Switch
              checked={data.showLogo}
              onCheckedChange={(checked) => onUpdate({ ...data, showLogo: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Studio Name</Label>
            <Switch
              checked={data.showStudioName}
              onCheckedChange={(checked) => onUpdate({ ...data, showStudioName: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Contact Info</Label>
            <Switch
              checked={data.showContactInfo}
              onCheckedChange={(checked) => onUpdate({ ...data, showContactInfo: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}