import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Settings } from "lucide-react";
import { DividerBlockData, ColumnsBlockData, SocialLinksBlockData, HeaderBlockData, RawHTMLBlockData } from "@/types/templateBuilder";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useTranslation } from "react-i18next";

export function DividerBlockEditor({ data, onUpdate }: { data: DividerBlockData; onUpdate: (data: DividerBlockData) => void }) {
  const { t } = useTranslation("pages");
  return (
    <div className="space-y-4">
      <div>
        <Label>{t("templateBuilder.blockEditor.divider.style")}</Label>
        <Select value={data.style} onValueChange={(value) => onUpdate({ ...data, style: value as "line" | "space" })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="line">{t("templateBuilder.blockEditor.divider.styleOptions.line")}</SelectItem>
            <SelectItem value="space">{t("templateBuilder.blockEditor.divider.styleOptions.space")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {data.style === "space" && (
        <div>
          <Label>{t("templateBuilder.blockEditor.divider.heightLabel")}</Label>
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
          <Label>{t("templateBuilder.blockEditor.divider.colorLabel")}</Label>
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
  const { t } = useTranslation("pages");
  const updateColumn = (index: number, content: string) => {
    const newContent = [...data.content];
    newContent[index] = content;
    onUpdate({ ...data, content: newContent });
  };

  const changeColumnCount = (count: number) => {
    const newContent = Array.from({ length: count }, (_, i) => data.content[i] ?? t("templateBuilder.blockEditor.columns.columnPlaceholder", { index: i + 1 }));
    onUpdate({ ...data, columns: count, content: newContent });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{t("templateBuilder.blockEditor.columns.countLabel")}</Label>
        <Select value={data.columns.toString()} onValueChange={(value) => changeColumnCount(parseInt(value))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t("templateBuilder.blockEditor.columns.options.one")}</SelectItem>
            <SelectItem value="2">{t("templateBuilder.blockEditor.columns.options.two")}</SelectItem>
            <SelectItem value="3">{t("templateBuilder.blockEditor.columns.options.three")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        {data.content.map((content, index) => (
          <div key={index}>
            <Label>{t("templateBuilder.blockEditor.columns.columnLabel", { index: index + 1 })}</Label>
            <Textarea
              value={content}
              onChange={(e) => updateColumn(index, e.target.value)}
              placeholder={t("templateBuilder.blockEditor.columns.columnPlaceholder", { index: index + 1 })}
              rows={3}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SocialLinksBlockEditor({ data, onUpdate }: { data: SocialLinksBlockData; onUpdate: (data: SocialLinksBlockData) => void }) {
  const { settings, loading } = useOrganizationSettings();
  const { t } = useTranslation("pages");
  
  const toggleChannelVisibility = (channelKey: string, visible: boolean) => {
    const newVisibility = { ...(data.channelVisibility || {}) };
    newVisibility[channelKey] = visible;
    onUpdate({ ...data, channelVisibility: newVisibility });
  };

  const socialChannelsArray = settings?.socialChannels 
    ? Object.entries(settings.socialChannels)
        .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
        .filter(([, channel]) => channel.url?.trim())
    : [];

  const isChannelVisible = (channelKey: string) => {
    return data.channelVisibility?.[channelKey] !== false;
  };

  // Show skeleton loading while fetching settings
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {t("templateBuilder.blockEditor.socialLinks.instructions")}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {socialChannelsArray.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {t("templateBuilder.blockEditor.socialLinks.instructions")}
          </div>
          <div className="space-y-3">
            {socialChannelsArray.map(([key, channel]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                <div className="flex-1">
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{channel.url}</div>
                </div>
                <Switch
                  checked={isChannelVisible(key)}
                  onCheckedChange={(checked) => toggleChannelVisibility(key, checked)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            {t("templateBuilder.blockEditor.socialLinks.emptyDescription")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function HeaderBlockEditor({ data, onUpdate }: { data: HeaderBlockData; onUpdate: (data: HeaderBlockData) => void }) {
  const { t } = useTranslation("pages");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t("templateBuilder.blockEditor.header.showLogo")}</Label>
        <Switch
          checked={data.showLogo}
          onCheckedChange={(checked) => onUpdate({ ...data, showLogo: checked })}
        />
      </div>
      
      {data.showLogo && (
        <div>
          <Label>{t("templateBuilder.blockEditor.header.logoAlignment")}</Label>
          <Select value={data.logoAlignment || "center"} onValueChange={(value) => onUpdate({ ...data, logoAlignment: value as "left" | "center" | "right" })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">{t("templateBuilder.blockEditor.header.logoAlignmentOptions.left")}</SelectItem>
              <SelectItem value="center">{t("templateBuilder.blockEditor.header.logoAlignmentOptions.center")}</SelectItem>
              <SelectItem value="right">{t("templateBuilder.blockEditor.header.logoAlignmentOptions.right")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div>
        <Label>{t("templateBuilder.blockEditor.header.tagline")}</Label>
        <Input
          value={data.tagline || ""}
          onChange={(e) => onUpdate({ ...data, tagline: e.target.value })}
          placeholder={t("templateBuilder.blockEditor.header.taglinePlaceholder")}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {data.tagline && (
          <div>
            <Label>{t("templateBuilder.blockEditor.header.taglineColor")}</Label>
            <Input
              type="color"
              value={data.taglineColor || "#000000"}
              onChange={(e) => onUpdate({ ...data, taglineColor: e.target.value })}
              className="w-full"
            />
          </div>
        )}
        
        <div className={data.tagline ? "" : "col-span-2"}>
          <Label>{t("templateBuilder.blockEditor.header.backgroundColor")}</Label>
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
  const { t } = useTranslation("pages");
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t("templateBuilder.blockEditor.rawHtml.alert")}
        </AlertDescription>
      </Alert>
      
      <div>
        <Label>{t("templateBuilder.blockEditor.rawHtml.label")}</Label>
        <Textarea
          value={data.html}
          onChange={(e) => onUpdate({ ...data, html: e.target.value, sanitized: false })}
          placeholder={t("templateBuilder.blockEditor.rawHtml.placeholder")}
          rows={8}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
