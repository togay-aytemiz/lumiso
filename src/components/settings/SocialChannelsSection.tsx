import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Youtube, 
  Plus, 
  Trash2,
  GripVertical
} from 'lucide-react';
import { SocialChannel } from '@/hooks/useOrganizationSettings';
import { cn } from '@/lib/utils';

interface SocialChannelsSectionProps {
  socialChannels: Record<string, SocialChannel>;
  onUpdate: (channels: Record<string, SocialChannel>) => void;
  isDirty: boolean;
}

const PREDEFINED_PLATFORMS = [
  { key: 'website', name: 'Website', icon: Globe },
  { key: 'facebook', name: 'Facebook', icon: Facebook },
  { key: 'instagram', name: 'Instagram', icon: Instagram },
  { key: 'twitter', name: 'Twitter/X', icon: Twitter },
  { key: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { key: 'youtube', name: 'YouTube', icon: Youtube },
];

export function SocialChannelsSection({ socialChannels, onUpdate, isDirty }: SocialChannelsSectionProps) {
  const [customPlatformName, setCustomPlatformName] = useState('');

  const addPredefinedPlatform = (platformKey: string) => {
    const platform = PREDEFINED_PLATFORMS.find(p => p.key === platformKey);
    if (!platform || socialChannels[platformKey]) return;

    const newChannel: SocialChannel = {
      name: platform.name,
      url: '',
      platform: platformKey as any,
      enabled: true,
    };

    onUpdate({
      ...socialChannels,
      [platformKey]: newChannel
    });
  };

  const addCustomPlatform = () => {
    if (!customPlatformName.trim()) return;

    const customKey = `custom_${Date.now()}`;
    const newChannel: SocialChannel = {
      name: customPlatformName.trim(),
      url: '',
      platform: 'custom',
      customPlatformName: customPlatformName.trim(),
      enabled: true,
    };

    onUpdate({
      ...socialChannels,
      [customKey]: newChannel
    });
    setCustomPlatformName('');
  };

  const updateChannel = (key: string, updates: Partial<SocialChannel>) => {
    onUpdate({
      ...socialChannels,
      [key]: { ...socialChannels[key], ...updates }
    });
  };

  const removeChannel = (key: string) => {
    const { [key]: removed, ...remaining } = socialChannels;
    onUpdate(remaining);
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getChannelIcon = (channel: SocialChannel) => {
    const platform = PREDEFINED_PLATFORMS.find(p => p.key === channel.platform);
    return platform?.icon || Globe;
  };

  const availablePlatforms = PREDEFINED_PLATFORMS.filter(
    platform => !socialChannels[platform.key]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Social Channels
          {isDirty && <Badge variant="secondary">Unsaved Changes</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Add your social media and website links to display in email footers
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Channels */}
        <div className="space-y-3">
          {Object.entries(socialChannels).map(([key, channel]) => {
            const Icon = getChannelIcon(channel);
            const hasValidUrl = channel.url && validateUrl(channel.url);
            
            return (
              <div 
                key={key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border bg-card",
                  !hasValidUrl && channel.url && "border-destructive/50 bg-destructive/5"
                )}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Label className="text-sm font-medium">
                      {channel.customPlatformName || channel.name}
                    </Label>
                    <Input
                      placeholder={`https://${channel.platform === 'website' ? 'yourwebsite.com' : `${channel.platform}.com/yourprofile`}`}
                      value={channel.url}
                      onChange={(e) => updateChannel(key, { url: e.target.value })}
                      className={cn(
                        "text-sm",
                        !hasValidUrl && channel.url && "border-destructive focus:ring-destructive"
                      )}
                    />
                    {!hasValidUrl && channel.url && (
                      <p className="text-xs text-destructive">Please enter a valid URL</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChannel(key)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {Object.keys(socialChannels).length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No social channels added yet</p>
            <p className="text-xs">Add your social media links to display in email footers</p>
          </div>
        )}

        {/* Add Platform Buttons */}
        {availablePlatforms.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Add Platform</Label>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <Button
                    key={platform.key}
                    variant="outline"
                    size="sm"
                    onClick={() => addPredefinedPlatform(platform.key)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {platform.name}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Custom Platform */}
        <div className="flex gap-2">
          <Input
            placeholder="Custom platform name (e.g., TikTok, Behance)"
            value={customPlatformName}
            onChange={(e) => setCustomPlatformName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomPlatform()}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addCustomPlatform}
            disabled={!customPlatformName.trim()}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Custom
          </Button>
        </div>

        {/* Helper Text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Social links will appear in email template footers when enabled</p>
          <p>• Drag to reorder how they appear in emails</p>
          <p>• Only channels with valid URLs will be displayed</p>
        </div>
      </CardContent>
    </Card>
  );
}
