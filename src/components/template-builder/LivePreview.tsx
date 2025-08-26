import { useState } from "react";
import { Monitor, Smartphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { EmailPreview } from "@/components/templates/EmailPreview";
import { SMSPreview } from "@/components/templates/SMSPreview";
import { WhatsAppPreview } from "@/components/templates/WhatsAppPreview";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import type { Block } from "@/pages/TemplateBuilder";

interface LivePreviewProps {
  blocks: Block[];
  templateName: string;
  onTestSend: (channel: string) => void;
}

export function LivePreview({ blocks, templateName, onTestSend }: LivePreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const { settings } = useOrganizationSettings();

  // Convert blocks to content for each channel
  const generateContentForChannel = (channel: 'email' | 'sms' | 'whatsapp') => {
    const visibleBlocks = blocks.filter(block => block.isVisible);
    
    return visibleBlocks
      .sort((a, b) => a.order - b.order)
      .map(block => renderBlockForChannel(block, channel))
      .filter(Boolean)
      .join(channel === 'email' ? '\n\n' : '\n');
  };

  const renderBlockForChannel = (block: Block, channel: 'email' | 'sms' | 'whatsapp'): string => {
    switch (block.type) {
      case 'text':
        return block.content.text || '';
        
      case 'session-details':
        const details = [];
        if (block.content.showDate) {
          details.push(channel === 'email' ? 
            'Date: {session_date}' : 
            '📅 {session_date}'
          );
        }
        if (block.content.showTime) {
          details.push(channel === 'email' ? 
            'Time: {session_time}' : 
            '🕐 {session_time}'
          );
        }
        if (block.content.showLocation) {
          details.push(channel === 'email' ? 
            'Location: {session_location}' : 
            '📍 {session_location}'
          );
        }
        if (block.content.notes) {
          details.push(block.content.notes);
        }
        return details.join(channel === 'email' ? '\n' : '\n');
        
      case 'cta':
        if (channel === 'sms') {
          return block.content.primaryText ? 
            `${block.content.primaryText}: ${block.content.primaryUrl || '[URL]'}` : '';
        }
        return block.content.primaryText || '';
        
      case 'image':
        if (channel === 'sms') return '';
        return block.content.caption || '[Image]';
        
      case 'footer':
        return channel === 'email' ? 
          '{studio_name}\n{studio_phone}' : 
          '—\n{studio_name} • {studio_phone}';
        
      default:
        return '';
    }
  };

  const emailContent = generateContentForChannel('email');
  const smsContent = generateContentForChannel('sms');
  const whatsappContent = generateContentForChannel('whatsapp');

  const getCharacterCount = (content: string) => {
    // Replace placeholders with sample text for accurate count
    const withSampleData = content
      .replace(/\{customer_name\}/g, 'John Smith')
      .replace(/\{session_date\}/g, 'March 15, 2024')
      .replace(/\{session_time\}/g, '2:00 PM')
      .replace(/\{session_location\}/g, 'Downtown Studio')
      .replace(/\{studio_name\}/g, settings?.photography_business_name || 'Studio Name')
      .replace(/\{studio_phone\}/g, '(555) 123-4567');
    
    return withSampleData.length;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Live Preview</h2>
            <p className="text-sm text-muted-foreground">
              See how your template looks across channels
            </p>
          </div>
          
          {/* Desktop/Mobile toggle for email */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'desktop' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('desktop')}
              className="h-7 px-2"
            >
              <Monitor className="h-3 w-3" />
            </Button>
            <Button
              variant={viewMode === 'mobile' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('mobile')}
              className="h-7 px-2"
            >
              <Smartphone className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
      
      <Separator />
      
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="email" className="flex-1 flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="sms">SMS</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 p-6">
            <TabsContent value="email" className="h-full m-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Email Preview</Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onTestSend('email')}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Test Send
                  </Button>
                </div>
                <div className={viewMode === 'mobile' ? 'max-w-sm mx-auto' : ''}>
                  <EmailPreview
                    subject={`${templateName} - {session_date}`}
                    content={emailContent}
                    htmlContent={emailContent.replace(/\n/g, '<br>')}
                    sender={settings?.photography_business_name || 'Studio Name'}
                    recipient="customer@example.com"
                    studioName={settings?.photography_business_name || 'Studio Name'}
                    brandColor={settings?.primary_brand_color}
                    logoUrl={settings?.logo_url}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="whatsapp" className="h-full m-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">WhatsApp Preview</Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onTestSend('whatsapp')}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Test Send
                  </Button>
                </div>
                <WhatsAppPreview
                  content={whatsappContent}
                  senderName={settings?.photography_business_name || 'Studio Name'}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="sms" className="h-full m-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">SMS Preview</Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getCharacterCount(smsContent)} chars
                    </Badge>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onTestSend('sms')}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Test Send
                  </Button>
                </div>
                <SMSPreview
                  content={smsContent}
                  senderName={settings?.photography_business_name || 'Studio Name'}
                />
                {getCharacterCount(smsContent) > 160 && (
                  <p className="text-xs text-warning">
                    ⚠️ Message exceeds 160 characters and may be split into multiple SMS
                  </p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}