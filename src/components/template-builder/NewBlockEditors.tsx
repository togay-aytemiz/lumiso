import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { DividerBlockData, ColumnsBlockData, SocialLinksBlockData, HeaderBlockData, RawHTMLBlockData } from "@/types/templateBuilder";

export function DividerBlockEditor({ data, onUpdate }: { data: DividerBlockData; onUpdate: (data: DividerBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Style</Label>
        <Select value={data.style} onValueChange={(value) => onUpdate({ ...data, style: value as "line" | "space" })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="line">Line Divider</SelectItem>
            <SelectItem value="space">Space/Gap</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {data.style === "space" && (
        <div>
          <Label>Height (px)</Label>
          <Input
            type="number"
            value={data.height || 20}
            onChange={(e) => onUpdate({ ...data, height: parseInt(e.target.value) || 20 })}
            placeholder="20"
          />
        </div>
      )}
      
      {data.style === "line" && (
        <div>
          <Label>Color</Label>
          <Input
            type="color"
            value={data.color || "#e5e5e5"}
            onChange={(e) => onUpdate({ ...data, color: e.target.value })}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

export function ColumnsBlockEditor({ data, onUpdate }: { data: ColumnsBlockData; onUpdate: (data: ColumnsBlockData) => void }) {
  const updateColumn = (index: number, content: string) => {
    const newContent = [...data.content];
    newContent[index] = content;
    onUpdate({ ...data, content: newContent });
  };

  const changeColumnCount = (count: number) => {
    const newContent = Array(count).fill("").map((_, i) => data.content[i] || "Column content...");
    onUpdate({ ...data, columns: count, content: newContent });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Number of Columns</Label>
        <Select value={data.columns.toString()} onValueChange={(value) => changeColumnCount(parseInt(value))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Column</SelectItem>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        {data.content.map((content, index) => (
          <div key={index}>
            <Label>Column {index + 1}</Label>
            <Textarea
              value={content}
              onChange={(e) => updateColumn(index, e.target.value)}
              placeholder={`Column ${index + 1} content...`}
              rows={3}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SocialLinksBlockEditor({ data, onUpdate }: { data: SocialLinksBlockData; onUpdate: (data: SocialLinksBlockData) => void }) {
  const updateLink = (platform: string, field: 'url' | 'show', value: string | boolean) => {
    const newLinks = data.links.map(link => 
      link.platform === platform ? { ...link, [field]: value } : link
    );
    onUpdate({ ...data, links: newLinks });
  };

  return (
    <div className="space-y-4">
      <Label>Social Links</Label>
      
      <div className="space-y-3">
        {data.links.map((link) => (
          <div key={link.platform} className="space-y-2 p-3 border rounded">
            <div className="flex items-center justify-between">
              <Label className="capitalize">{link.platform}</Label>
              <Switch
                checked={link.show}
                onCheckedChange={(checked) => updateLink(link.platform, 'show', checked)}
              />
            </div>
            {link.show && (
              <Input
                value={link.url}
                onChange={(e) => updateLink(link.platform, 'url', e.target.value)}
                placeholder={`https://${link.platform}.com/yourprofile`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeaderBlockEditor({ data, onUpdate }: { data: HeaderBlockData; onUpdate: (data: HeaderBlockData) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Show Logo</Label>
        <Switch
          checked={data.showLogo}
          onCheckedChange={(checked) => onUpdate({ ...data, showLogo: checked })}
        />
      </div>
      
      {data.showLogo && (
        <div>
          <Label>Logo Alignment</Label>
          <Select value={data.logoAlignment || "center"} onValueChange={(value) => onUpdate({ ...data, logoAlignment: value as "left" | "center" | "right" })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div>
        <Label>Tagline (optional)</Label>
        <Input
          value={data.tagline || ""}
          onChange={(e) => onUpdate({ ...data, tagline: e.target.value })}
          placeholder="Your photography tagline"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {data.tagline && (
          <div>
            <Label>Tagline Color</Label>
            <Input
              type="color"
              value={data.taglineColor || "#000000"}
              onChange={(e) => onUpdate({ ...data, taglineColor: e.target.value })}
              className="w-full"
            />
          </div>
        )}
        
        <div className={data.tagline ? "" : "col-span-2"}>
          <Label>Background Color</Label>
          <Input
            type="color"
            value={data.backgroundColor || "#ffffff"}
            onChange={(e) => onUpdate({ ...data, backgroundColor: e.target.value })}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

export function RawHTMLBlockEditor({ data, onUpdate }: { data: RawHTMLBlockData; onUpdate: (data: RawHTMLBlockData) => void }) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Raw HTML is for advanced users. Content will be sanitized for security.
        </AlertDescription>
      </Alert>
      
      <div>
        <Label>HTML Content</Label>
        <Textarea
          value={data.html}
          onChange={(e) => onUpdate({ ...data, html: e.target.value, sanitized: false })}
          placeholder="<div>Your custom HTML here...</div>"
          rows={8}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}