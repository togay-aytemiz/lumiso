import { Layout, GripVertical, Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import type { Block } from "@/pages/TemplateBuilder";

interface FooterBlockEditorProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onRemove: () => void;
}

export function FooterBlockEditor({ block, onUpdate, onRemove }: FooterBlockEditorProps) {
  const { settings } = useOrganizationSettings();
  
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
            <div className="p-1.5 rounded bg-muted-foreground/10">
              <Layout className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="font-medium text-sm">Footer Block</span>
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
              id={`show-logo-${block.id}`}
              checked={block.content.showLogo !== false}
              onCheckedChange={(checked) => updateContent({ showLogo: checked })}
            />
            <Label htmlFor={`show-logo-${block.id}`} className="text-sm">
              Show Logo
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id={`show-name-${block.id}`}
              checked={block.content.showStudioName !== false}
              onCheckedChange={(checked) => updateContent({ showStudioName: checked })}
            />
            <Label htmlFor={`show-name-${block.id}`} className="text-sm">
              Show Studio Name
            </Label>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id={`show-phone-${block.id}`}
              checked={block.content.showPhone !== false}
              onCheckedChange={(checked) => updateContent({ showPhone: checked })}
            />
            <Label htmlFor={`show-phone-${block.id}`} className="text-sm">
              Show Phone
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id={`show-socials-${block.id}`}
              checked={block.content.showSocials === true}
              onCheckedChange={(checked) => updateContent({ showSocials: checked })}
            />
            <Label htmlFor={`show-socials-${block.id}`} className="text-sm">
              Show Socials
            </Label>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded space-y-1">
          <div><strong>Current Settings Preview:</strong></div>
          <div>Studio: {settings?.photography_business_name || 'Not set'}</div>
          <div>Logo: {settings?.logo_url ? 'Available' : 'Not set'}</div>
          <div>Brand Color: {settings?.primary_brand_color || 'Default'}</div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Footer information is automatically pulled from your organization settings. 
          Update your studio details in General Settings to customize the footer.
        </div>
      </CardContent>
    </Card>
  );
}