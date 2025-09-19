import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Globe, 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Youtube, 
  Plus, 
  Trash2,
  GripVertical,
  Music
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SocialChannel } from '@/hooks/useOrganizationSettings';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
  { key: 'tiktok', name: 'TikTok', icon: Music },
];

export function SocialChannelsSection({ socialChannels, onUpdate, isDirty }: SocialChannelsSectionProps) {
  const { t } = useTranslation('forms');
  const [customPlatformName, setCustomPlatformName] = useState('');

  const addPredefinedPlatform = (platformKey: string) => {
    const platform = PREDEFINED_PLATFORMS.find(p => p.key === platformKey);
    if (!platform || socialChannels[platformKey]) return;

    const maxOrder = Math.max(0, ...Object.values(socialChannels).map(c => c.order || 0));
    const newChannel: SocialChannel = {
      name: platform.name,
      url: '',
      platform: platformKey as any,
      enabled: true,
      order: maxOrder + 1,
    };

    onUpdate({
      ...socialChannels,
      [platformKey]: newChannel
    });
  };

  const addCustomPlatform = () => {
    if (!customPlatformName.trim()) return;

    const customKey = `custom_${Date.now()}`;
    const maxOrder = Math.max(0, ...Object.values(socialChannels).map(c => c.order || 0));
    const newChannel: SocialChannel = {
      name: customPlatformName.trim(),
      url: '',
      platform: 'custom',
      customPlatformName: customPlatformName.trim(),
      enabled: true,
      order: maxOrder + 1,
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sortedEntries = Object.entries(socialChannels)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));
    
    const [reorderedItem] = sortedEntries.splice(result.source.index, 1);
    sortedEntries.splice(result.destination.index, 0, reorderedItem);

    const reorderedChannels = Object.fromEntries(
      sortedEntries.map(([key, channel], index) => [
        key,
        { ...channel, order: index }
      ])
    );
    onUpdate(reorderedChannels);
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

  const channelEntries = Object.entries(socialChannels)
    .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

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
      <CardContent>
        <div className="space-y-4">
          {/* Existing Channels with Drag & Drop */}
          {channelEntries.length > 0 && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="social-channels">
                {(provided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {channelEntries.map(([key, channel], index) => {
                      const Icon = getChannelIcon(channel);
                      const hasValidUrl = channel.url && validateUrl(channel.url);
                      
                      return (
                        <Draggable key={key} draggableId={key} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
                                !hasValidUrl && channel.url && "border-destructive/50 bg-destructive/5",
                                snapshot.isDragging && "shadow-lg"
                              )}
                            >
                              <div 
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              
                              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              
                              <div className="min-w-0 w-20 flex-shrink-0">
                                <span className="text-sm font-medium truncate block">
                                  {channel.customPlatformName || channel.name}
                                </span>
                              </div>
                              
                              <div className="flex-1">
                                <Input
                                  placeholder={`https://${channel.platform === 'website' ? 'yourwebsite.com' : `${channel.platform}.com/yourprofile`}`}
                                  value={channel.url}
                                  onChange={(e) => updateChannel(key, { url: e.target.value })}
                                  className={cn(
                                    "h-9 text-sm",
                                    !hasValidUrl && channel.url && "border-destructive focus:ring-destructive"
                                  )}
                                />
                                {!hasValidUrl && channel.url && (
                                  <p className="text-xs text-destructive mt-1">Please enter a valid URL</p>
                                )}
                              </div>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0 flex-shrink-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Social Channel</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {channel.customPlatformName || channel.name}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => removeChannel(key)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Empty State */}
          {channelEntries.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('social_channels.no_channels')}</p>
              <p className="text-xs">{t('social_channels.add_links_description')}</p>
            </div>
          )}

          {/* Add Platform Buttons */}
          {availablePlatforms.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('social_channels.add_platform')}</Label>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <Button
                      key={platform.key}
                      variant="outline"
                      size="sm"
                      onClick={() => addPredefinedPlatform(platform.key)}
                      className="flex items-center gap-2 h-9"
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
              className="flex-1 h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addCustomPlatform}
              disabled={!customPlatformName.trim()}
              className="flex items-center gap-2 h-9"
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
        </div>
      </CardContent>
    </Card>
  );
}
