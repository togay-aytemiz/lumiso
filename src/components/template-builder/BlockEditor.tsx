import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronUp, ChevronDown, Trash2, Bold, Italic, List, AlignLeft, AlignCenter, AlignRight, AlignJustify, Upload, Smile } from "lucide-react";
import { TemplateBlock, TextBlockData, SessionDetailsBlockData, CTABlockData, ImageBlockData, FooterBlockData, DividerBlockData, SocialLinksBlockData, HeaderBlockData, RawHTMLBlockData } from "@/types/templateBuilder";
import { VariablePicker } from "./VariablePicker";
import { EmojiPicker } from "./EmojiPicker";
import { ImageUpload } from "./ImageUpload";
import { ImageLibrarySheet } from "./ImageLibrarySheet";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState } from "react";
import { emojis } from "@/lib/templateUtils";
import { DividerBlockEditor, SocialLinksBlockEditor, HeaderBlockEditor, RawHTMLBlockEditor } from "./NewBlockEditors";
import { useTranslation } from "react-i18next";

interface BlockEditorProps {
  block: TemplateBlock;
  onUpdate: (data: TemplateBlock["data"]) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function BlockEditor({ block, onUpdate, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: BlockEditorProps) {
  const { t } = useTranslation("pages");
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
        return <DividerBlockEditor data={block.data as DividerBlockData} onUpdate={(updated) => onUpdate(updated)} />;
      case "social-links":
        return <SocialLinksBlockEditor data={block.data as SocialLinksBlockData} onUpdate={(updated) => onUpdate(updated)} />;
      case "header":
        return <HeaderBlockEditor data={block.data as HeaderBlockData} onUpdate={(updated) => onUpdate(updated)} />;
      case "raw-html":
        return <RawHTMLBlockEditor data={block.data as RawHTMLBlockData} onUpdate={(updated) => onUpdate(updated)} />;
      default:
        return <div>{t("templateBuilder.blockEditor.unknownBlock")}</div>;
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
          {t("templateBuilder.blockEditor.remove")}
        </Button>
      </div>
    </div>
  );
}

function TextBlockEditor({ data, onUpdate }: { data: TextBlockData; onUpdate: (data: TextBlockData) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation("pages");
  
  const updateFormatting = <K extends keyof TextBlockData["formatting"]>(
    key: K,
    value: TextBlockData["formatting"][K]
  ) => {
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
          <Label>{t("templateBuilder.blockEditor.text.contentLabel")}</Label>
          <div className="flex items-center gap-2">
            <EmojiPicker onEmojiSelect={insertEmoji} />
            <VariablePicker onVariableSelect={insertVariable} />
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={data.content}
          onChange={(e) => onUpdate({ ...data, content: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.text.contentPlaceholder")}
          rows={4}
        />
      </div>
      
      <div className="space-y-3">
        <Label>{t("templateBuilder.blockEditor.text.formatting")}</Label>
        
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
            <Label className="text-xs">{t("templateBuilder.blockEditor.text.fontSize")}</Label>
            <Select
              value={data.formatting.fontSize}
              onValueChange={(value) =>
                updateFormatting("fontSize", value as TextBlockData["formatting"]["fontSize"])
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h1">{t("templateBuilder.blockEditor.text.fontSizeOptions.h1")}</SelectItem>
                <SelectItem value="h2">{t("templateBuilder.blockEditor.text.fontSizeOptions.h2")}</SelectItem>
                <SelectItem value="h3">{t("templateBuilder.blockEditor.text.fontSizeOptions.h3")}</SelectItem>
                <SelectItem value="p">{t("templateBuilder.blockEditor.text.fontSizeOptions.p")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs">{t("templateBuilder.blockEditor.text.fontFamily")}</Label>
            <Select
              value={data.formatting.fontFamily}
              onValueChange={(value) =>
                updateFormatting("fontFamily", value as TextBlockData["formatting"]["fontFamily"])
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial">{t("templateBuilder.blockEditor.text.fontFamilyOptions.arial")}</SelectItem>
                <SelectItem value="Helvetica">{t("templateBuilder.blockEditor.text.fontFamilyOptions.helvetica")}</SelectItem>
                <SelectItem value="Georgia">{t("templateBuilder.blockEditor.text.fontFamilyOptions.georgia")}</SelectItem>
                <SelectItem value="Times New Roman">{t("templateBuilder.blockEditor.text.fontFamilyOptions.timesNewRoman")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Third row: Text alignment */}
        <div>
          <Label className="text-xs mb-2 block">{t("templateBuilder.blockEditor.text.textAlignment")}</Label>
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
  const { t } = useTranslation("pages");
  return (
    <div className="space-y-4">
      <div>
        <Label>{t("templateBuilder.blockEditor.sessionDetails.customLabel")}</Label>
        <Input
          value={data.customLabel || ""}
          onChange={(e) => onUpdate({ ...data, customLabel: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.sessionDetails.customLabelPlaceholder")}
        />
      </div>
      
      <div className="space-y-3">
        <Label>{t("templateBuilder.blockEditor.sessionDetails.showFields")}</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.sessionDetails.fields.date")}</Label>
            <Switch
              checked={data.showDate}
              onCheckedChange={(checked) => onUpdate({ ...data, showDate: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.sessionDetails.fields.time")}</Label>
            <Switch
              checked={data.showTime}
              onCheckedChange={(checked) => onUpdate({ ...data, showTime: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.sessionDetails.fields.location")}</Label>
            <Switch
              checked={data.showLocation}
              onCheckedChange={(checked) => onUpdate({ ...data, showLocation: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.sessionDetails.fields.notes")}</Label>
            <Switch
              checked={data.showNotes}
              onCheckedChange={(checked) => onUpdate({ ...data, showNotes: checked })}
            />
          </div>
        </div>
      </div>
      
      {data.showNotes && (
        <div>
          <Label>{t("templateBuilder.blockEditor.sessionDetails.customNotes")}</Label>
          <Textarea
            value={data.customNotes || ""}
            onChange={(e) => onUpdate({ ...data, customNotes: e.target.value })}
            placeholder={t("templateBuilder.blockEditor.sessionDetails.customNotesPlaceholder")}
            rows={2}
          />
        </div>
      )}
    </div>
  );
}

function CTABlockEditor({ data, onUpdate }: { data: CTABlockData; onUpdate: (data: CTABlockData) => void }) {
  const { t } = useTranslation("pages");
  return (
    <div className="space-y-4">
      <div>
        <Label>{t("templateBuilder.blockEditor.cta.buttonText")}</Label>
        <Input
          value={data.text}
          onChange={(e) => onUpdate({ ...data, text: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.cta.buttonTextPlaceholder")}
        />
      </div>
      
      <div>
        <Label>{t("templateBuilder.blockEditor.cta.buttonStyle")}</Label>
        <Select value={data.variant} onValueChange={(value) => onUpdate({ ...data, variant: value as CTABlockData["variant"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">{t("templateBuilder.blockEditor.cta.buttonStyles.primary")}</SelectItem>
            <SelectItem value="secondary">{t("templateBuilder.blockEditor.cta.buttonStyles.secondary")}</SelectItem>
            <SelectItem value="text">{t("templateBuilder.blockEditor.cta.buttonStyles.text")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>{t("templateBuilder.blockEditor.cta.linkLabel")}</Label>
        <Input
          value={data.link || ""}
          onChange={(e) => onUpdate({ ...data, link: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.cta.linkPlaceholder")}
        />
      </div>
    </div>
  );
}

function ImageBlockEditor({ data, onUpdate }: { data: ImageBlockData; onUpdate: (data: ImageBlockData) => void }) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const { t } = useTranslation("pages");
  
  const handleImageSelect = (imageUrl: string, altText?: string) => {
    onUpdate({ 
      ...data, 
      src: imageUrl, 
      placeholder: false,
      alt: altText || data.alt || t("templateBuilder.blockEditor.image.defaultAlt")
    });
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">{t("templateBuilder.blockEditor.image.tabs.upload")}</TabsTrigger>
          <TabsTrigger value="library">{t("templateBuilder.blockEditor.image.tabs.library")}</TabsTrigger>
          <TabsTrigger value="url">{t("templateBuilder.blockEditor.image.tabs.url")}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-4">
          <ImageUpload onImageUploaded={handleImageSelect} />
        </TabsContent>
        
        <TabsContent value="library" className="space-y-4">
          <Button 
            variant="outline" 
            onClick={() => setIsLibraryOpen(true)}
            className="w-full"
          >
            {t("templateBuilder.blockEditor.image.openLibrary")}
          </Button>
        </TabsContent>
        
        <TabsContent value="url" className="space-y-4">
          <div>
            <Label>{t("templateBuilder.blockEditor.image.urlLabel")}</Label>
            <Input
              value={data.src || ""}
              onChange={(e) => onUpdate({ ...data, src: e.target.value, placeholder: !e.target.value })}
              placeholder={t("templateBuilder.blockEditor.image.urlPlaceholder")}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Show current image if exists */}
      {data.src && !data.placeholder && (
        <div className="border rounded-lg p-3">
          <Label className="text-sm text-muted-foreground">{t("templateBuilder.blockEditor.image.currentImage")}</Label>
          <div className="mt-2">
            <img 
              src={data.src} 
              alt={data.alt || t("templateBuilder.blockEditor.image.defaultAlt")} 
              className="max-w-full h-32 object-cover rounded border"
            />
          </div>
        </div>
      )}
      
      <div>
        <Label>{t("templateBuilder.blockEditor.image.altLabel")}</Label>
        <Input
          value={data.alt || ""}
          onChange={(e) => onUpdate({ ...data, alt: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.image.altPlaceholder")}
        />
      </div>
      
      <div>
        <Label>{t("templateBuilder.blockEditor.image.captionLabel")}</Label>
        <Input
          value={data.caption || ""}
          onChange={(e) => onUpdate({ ...data, caption: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.image.captionPlaceholder")}
        />
      </div>
      
      <div>
        <Label>{t("templateBuilder.blockEditor.image.linkLabel")}</Label>
        <Input
          value={data.link || ""}
          onChange={(e) => onUpdate({ ...data, link: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.image.linkPlaceholder")}
        />
      </div>

      <ImageLibrarySheet
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        onImageSelect={handleImageSelect}
      />
    </div>
  );
}

function FooterBlockEditor({ data, onUpdate }: { data: FooterBlockData; onUpdate: (data: FooterBlockData) => void }) {
  const { t } = useTranslation("pages");
  return (
    <div className="space-y-4">
      <div>
        <Label>{t("templateBuilder.blockEditor.footer.customText")}</Label>
        <Textarea
          value={data.customText || ""}
          onChange={(e) => onUpdate({ ...data, customText: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.footer.customTextPlaceholder")}
          rows={2}
        />
      </div>
      
      <div className="space-y-3">
        <Label>{t("templateBuilder.blockEditor.footer.showElements")}</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.footer.elements.logo")}</Label>
            <Switch
              checked={data.showLogo}
              onCheckedChange={(checked) => onUpdate({ ...data, showLogo: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.footer.elements.studioName")}</Label>
            <Switch
              checked={data.showStudioName}
              onCheckedChange={(checked) => onUpdate({ ...data, showStudioName: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("templateBuilder.blockEditor.footer.elements.contactInfo")}</Label>
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
