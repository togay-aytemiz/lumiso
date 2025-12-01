import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Globe,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Plus,
  Trash2,
  GripVertical,
  Music,
} from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SocialChannel } from '@/hooks/useOrganizationSettings';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface SocialChannelsSectionProps {
  socialChannels: Record<string, SocialChannel>;
  onUpdate: (channels: Record<string, SocialChannel>) => void;
  isDirty: boolean;
  variant?: "card" | "embedded";
  className?: string;
}

const XIcon: LucideIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ color = 'currentColor', size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      strokeWidth={strokeWidth}
      {...props}
    >
      <path
        fill={color}
        fillRule="evenodd"
        d="M4 3h4.7l3.36 4.74L15.32 3H20l-6 7.08L20 21h-4.7l-3.63-5.12L7.93 21H4l6.19-7.3L4 3Z"
      />
    </svg>
  )
);
XIcon.displayName = 'XIcon';

const PREDEFINED_PLATFORMS: Array<{
  key: SocialChannel['platform'];
  name: string;
  icon: LucideIcon;
}> = [
  { key: 'website', name: 'Website', icon: Globe },
  { key: 'facebook', name: 'Facebook', icon: Facebook },
  { key: 'instagram', name: 'Instagram', icon: Instagram },
  { key: 'twitter', name: 'x.com (Twitter)', icon: XIcon },
  { key: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { key: 'youtube', name: 'YouTube', icon: Youtube },
  { key: 'tiktok', name: 'TikTok', icon: Music },
];

const PLATFORM_URL_PREFIXES: Partial<Record<SocialChannel['platform'], string>> = {
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/',
  twitter: 'https://x.com/',
  linkedin: 'https://linkedin.com/',
  youtube: 'https://youtube.com/',
  tiktok: 'https://tiktok.com/',
};

const PLATFORM_URL_ALIASES: Partial<Record<SocialChannel['platform'], string[]>> = {
  twitter: ['https://twitter.com/'],
};

const normalizeHost = (host: string) => host.replace(/^www\./, '');

const buildPrefixVariants = (prefix: string): string[] => {
  try {
    const base = new URL(prefix);
    const normalizedHost = normalizeHost(base.host);
    const hosts = [normalizedHost, `www.${normalizedHost}`];
    const protocols = base.protocol === 'http:' ? ['http:', 'https:'] : ['https:', 'http:'];
    const path = base.pathname || '/';
    const suffix = `${path}${base.search}${base.hash}`;

    const variants = hosts.flatMap((host) =>
      protocols.map((protocol) => `${protocol}//${host}${suffix}`)
    );

    return Array.from(new Set(variants));
  } catch {
    return [prefix];
  }
};

const getUsernameFromUrl = (url: string, platform: SocialChannel['platform']) => {
  if (!url) return '';
  const prefix = PLATFORM_URL_PREFIXES[platform];
  const aliasPrefixes = PLATFORM_URL_ALIASES[platform] ?? [];
  if (!prefix) return url;

  const trimmedUrl = url.trim();
  const variants = Array.from(
    new Set([
      ...buildPrefixVariants(prefix),
      ...aliasPrefixes.flatMap((alias) => buildPrefixVariants(alias)),
    ])
  );

  for (const variant of variants) {
    if (trimmedUrl.startsWith(variant)) {
      return trimmedUrl.slice(variant.length).replace(/^\/+/, '');
    }
  }

  try {
    const parsed = new URL(trimmedUrl);
    const allowedHosts = new Set(
      variants
        .map((variant) => {
          try {
            return normalizeHost(new URL(variant).host);
          } catch {
            return null;
          }
        })
        .filter((host): host is string => Boolean(host))
    );
    const parsedHost = normalizeHost(parsed.host);

    if (allowedHosts.has(parsedHost)) {
      const path = parsed.pathname.replace(/^\/+/, '');
      const queryAndHash = `${parsed.search}${parsed.hash}`;
      return `${path}${queryAndHash}`.replace(/^\/+/, '');
    }
  } catch {
    // Ignore parsing errors for malformed URLs
  }

  return trimmedUrl.replace(/^https?:\/\//, '');
};

const buildUrlFromUsername = (platform: SocialChannel['platform'], username: string) => {
  const prefix = PLATFORM_URL_PREFIXES[platform];
  const cleanedUsername = username.trim().replace(/^\/+/, '');

  if (!cleanedUsername) return '';
  if (!prefix) return cleanedUsername;

  return `${prefix}${cleanedUsername}`;
};

export function SocialChannelsSection({
  socialChannels,
  onUpdate,
  isDirty,
  variant = "card",
  className,
}: SocialChannelsSectionProps) {
  const { t } = useTranslation('forms');
  const [customPlatformName, setCustomPlatformName] = useState('');

  const addPredefinedPlatform = (platformKey: string) => {
    const platform = PREDEFINED_PLATFORMS.find(p => p.key === platformKey);
    if (!platform || socialChannels[platformKey]) return;

    const maxOrder = Math.max(0, ...Object.values(socialChannels).map(c => c.order || 0));
    const newChannel: SocialChannel = {
      name: platform.name,
      url: '',
      platform: platformKey,
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

  const getChannelDisplayName = (channel: SocialChannel) => {
    const platform = PREDEFINED_PLATFORMS.find(p => p.key === channel.platform);
    return channel.customPlatformName || platform?.name || channel.name;
  };

  const availablePlatforms = PREDEFINED_PLATFORMS.filter(
    platform => !socialChannels[platform.key]
  );

  const channelEntries = Object.entries(socialChannels)
    .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

  const content = (
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
                  const hasValidUrl = channel.url ? validateUrl(channel.url) : true;
                  const showInvalid = !!channel.url && !hasValidUrl;
                  const platformPrefix = PLATFORM_URL_PREFIXES[channel.platform];
                  const usernameValue = platformPrefix
                    ? getUsernameFromUrl(channel.url, channel.platform)
                    : channel.url;

                  return (
                    <Draggable key={key} draggableId={key} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors",
                            !hasValidUrl && channel.url && "border-destructive/50 bg-destructive/5",
                            snapshot.isDragging && "shadow-lg"
                          )}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab rounded-lg p-1 text-muted-foreground transition hover:bg-muted/40 active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                          <div className="min-w-0 w-20 flex-shrink-0">
                            <span className="block truncate text-sm font-medium">
                              {getChannelDisplayName(channel)}
                            </span>
                          </div>

                          <div className="flex-1">
                            {platformPrefix ? (
                              <div
                                className={cn(
                                  "flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background transition",
                                  "focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                                  showInvalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive"
                                )}
                              >
                                <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground">
                                  {platformPrefix}
                                </span>
                                <Input
                                  value={usernameValue}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    const normalizedUsername = rawValue.startsWith('http')
                                      ? getUsernameFromUrl(rawValue, channel.platform)
                                      : rawValue;
                                    const nextUrl = buildUrlFromUsername(channel.platform, normalizedUsername);
                                    updateChannel(key, { url: nextUrl });
                                  }}
                                  placeholder={t('social_channels.username_placeholder', { platform: getChannelDisplayName(channel) })}
                                  className="h-9 border-0 rounded-none rounded-r-md px-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                              </div>
                            ) : (
                              <Input
                                placeholder={`https://${channel.platform === 'website' ? 'yourwebsite.com' : `${channel.platform}.com/yourprofile`}`}
                                value={channel.url}
                                onChange={(e) => updateChannel(key, { url: e.target.value })}
                                className={cn(
                                  "h-9 text-sm",
                                  showInvalid && "border-destructive focus-visible:ring-destructive"
                                )}
                              />
                            )}
                            {showInvalid && (
                              <p className="mt-1 text-xs text-destructive">
                                {t('social_channels.url_invalid')}
                              </p>
                            )}
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 flex-shrink-0 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('social_channels.remove_channel_title')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('social_channels.remove_channel_description', { name: getChannelDisplayName(channel) })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common:buttons.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeChannel(key)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t('social_channels.remove_button')}
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
        <div className="py-6 text-center text-muted-foreground">
          <Globe className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">{t('social_channels.no_channels')}</p>
          <p className="text-xs">{t('social_channels.add_links_description')}</p>
        </div>
      )}

      {/* Add Platform Buttons */}
      {availablePlatforms.length > 0 && (
        <div>
          <Label className="mb-2 block text-sm font-medium">
            {t('social_channels.add_platform')}
          </Label>
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
          placeholder={t('social_channels.custom_platform_placeholder')}
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
          {t('social_channels.add_custom')}
        </Button>
      </div>

      {/* Helper Text */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>• {t('social_channels.help_text.appear_in_emails')}</p>
        <p>• {t('social_channels.help_text.drag_to_reorder')}</p>
        <p>• {t('social_channels.help_text.valid_urls_only')}</p>
      </div>
    </div>
  );

  if (variant === "embedded") {
    return (
      <div className={cn("space-y-4", className)}>
        {isDirty && (
          <Badge variant="secondary" className="w-fit">
            {t('social_channels.unsaved_changes')}
          </Badge>
        )}
        {content}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('social_channels.title')}
          {isDirty && (
            <Badge variant="secondary">{t('social_channels.unsaved_changes')}</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('social_channels.description')}
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
