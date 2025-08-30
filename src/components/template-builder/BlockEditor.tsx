import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronUp, ChevronDown, Trash2, Bold, Italic, List, AlignLeft, AlignCenter, AlignRight, AlignJustify, Upload, Smile } from "lucide-react";
import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData } from "@/types/templateBuilder";
import { VariablePicker } from "./VariablePicker";
import { EmojiPicker } from "./EmojiPicker";
import { ImageUpload } from "./ImageUpload";
import { ImageManager } from "./ImageManager";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState } from "react";
import { emojis } from "@/lib/templateUtils";
import { DividerBlockEditor, SocialLinksBlockEditor, HeaderBlockEditor, RawHTMLBlockEditor } from "./NewBlockEditors";

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
      case "divider":
        return <DividerBlockEditor data={block.data as any} onUpdate={onUpdate} />;
      case "social-links":
        return <SocialLinksBlockEditor data={block.data as any} onUpdate={onUpdate} />;
      case "header":
        return <HeaderBlockEditor data={block.data as any} onUpdate={onUpdate} />;
      case "raw-html":
        return <RawHTMLBlockEditor data={block.data as any} onUpdate={onUpdate} />;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const updateFormatting = (key: keyof TextBlockData["formatting"], value: any) => {
    onUpdate({
      ...data,
      formatting: { ...data.formatting, [key]: value }
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = data.content.slice(0, start) + variable + data.content.slice(end);
      onUpdate({ ...data, content: newContent });
      
      // Focus and set cursor position after variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      onUpdate({ ...data, content: data.content + variable });
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = data.content.slice(0, start) + emoji + data.content.slice(end);
      onUpdate({ ...data, content: newContent });
      
      // Focus and set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      onUpdate({ ...data, content: data.content + emoji });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Content</Label>
          <div className="flex items-center gap-2">
            <EmojiPicker onEmojiSelect={insertEmoji} />
            <VariablePicker onVariableSelect={insertVariable} />
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={data.content}
          onChange={(e) => onUpdate({ ...data, content: e.target.value })}
          placeholder="Enter your text here..."
          rows={4}
        />
      </div>
      
      <div className="space-y-3">
        <Label>Formatting</Label>
        
        {/* First row: Bold, Italic, Bullets */}
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
        
        {/* Second row: Font size, Font family on same row */}
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

        {/* Third row: Text alignment */}
        <div>
          <Label className="text-xs mb-2 block">Text Alignment</Label>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={data.formatting.alignment === "left" ? "default" : "outline"}
              onClick={() => updateFormatting("alignment", "left")}
            >
              <AlignLeft className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={data.formatting.alignment === "center" ? "default" : "outline"}
              onClick={() => updateFormatting("alignment", "center")}
            >
              <AlignCenter className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={data.formatting.alignment === "right" ? "default" : "outline"}
              onClick={() => updateFormatting("alignment", "right")}
            >
              <AlignRight className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={data.formatting.alignment === "justify" ? "default" : "outline"}
              onClick={() => updateFormatting("alignment", "justify")}
            >
              <AlignJustify className="h-3 w-3" />
            </Button>
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
  const handleImageSelect = (imageUrl: string, altText?: string) => {
    onUpdate({ 
      ...data, 
      src: imageUrl, 
      placeholder: false,
      alt: altText || data.alt || 'Image'
    });
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload New</TabsTrigger>
          <TabsTrigger value="library">Image Library</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-4">
          <ImageUpload onImageUploaded={handleImageSelect} />
        </TabsContent>
        
        <TabsContent value="library" className="space-y-4">
          <ImageManager onImageSelect={handleImageSelect} />
        </TabsContent>
        
        <TabsContent value="url" className="space-y-4">
          <div>
            <Label>Image URL</Label>
            <Input
              value={data.src || ""}
              onChange={(e) => onUpdate({ ...data, src: e.target.value, placeholder: !e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Show current image if exists */}
      {data.src && !data.placeholder && (
        <div className="border rounded-lg p-3">
          <Label className="text-sm text-muted-foreground">Current Image</Label>
          <div className="mt-2">
            <img 
              src={data.src} 
              alt={data.alt || 'Preview'} 
              className="max-w-full h-32 object-cover rounded border"
            />
          </div>
        </div>
      )}
      
      <div>
        <Label>Alt Text (optional)</Label>
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
          <div className="flex items-center justify-between">
            <Label className="text-sm">Unsubscribe Link</Label>
            <Switch
              checked={data.showUnsubscribe || false}
              onCheckedChange={(checked) => onUpdate({ ...data, showUnsubscribe: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Mailing Address</Label>
            <Switch
              checked={data.showMailingAddress || false}
              onCheckedChange={(checked) => onUpdate({ ...data, showMailingAddress: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Legal Text</Label>
            <Switch
              checked={data.showLegalText || false}
              onCheckedChange={(checked) => onUpdate({ ...data, showLegalText: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}