import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Monitor, Smartphone } from "lucide-react";
import { TemplateBlock } from "@/types/templateBuilder";
import { EmailPreview } from "./previews/EmailPreview";
import { WhatsAppPreview } from "./previews/WhatsAppPreview";
import { SMSPreview } from "./previews/SMSPreview";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "@/components/ui/segmented-control";

type TemplateChannel = "email" | "whatsapp" | "sms";

const isTemplateChannel = (value: string): value is TemplateChannel =>
  value === "email" || value === "whatsapp" || value === "sms";

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return undefined;
};

interface TemplatePreviewProps {
  blocks: TemplateBlock[];
  activeChannel: TemplateChannel;
  onChannelChange: (channel: TemplateChannel) => void;
  emailSubject?: string;
  preheader?: string;
  previewData?: Record<string, string>;
}

export function TemplatePreview({ blocks, activeChannel, onChannelChange, emailSubject, preheader, previewData }: TemplatePreviewProps) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation('pages');

  const defaultMockData = {
    customer_name: t('templateBuilder.preview.mockData.customerName'),
    session_date: t('templateBuilder.preview.mockData.sessionDate'),
    session_time: t('templateBuilder.preview.mockData.sessionTime'),
    session_location: t('templateBuilder.preview.mockData.sessionLocation'),
    business_name: t('templateBuilder.preview.mockData.businessName'),
    business_phone: t('templateBuilder.preview.mockData.businessPhone'),
  };

  const mockData = previewData || defaultMockData;
  const disabledChannels: TemplateChannel[] = ["whatsapp", "sms"];
  const soonLabel = t('templateBuilder.preview.channels.soon');

  const renderChannelLabel = (icon: string, label: string, showSoon = false) => (
    <span className="flex items-center gap-2">
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {showSoon && (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          {soonLabel}
        </span>
      )}
    </span>
  );

  const channelOptions = [
    {
      value: "email",
      label: renderChannelLabel("📧", t('templateBuilder.preview.channels.email')),
      ariaLabel: t('templateBuilder.preview.channels.email'),
    },
    {
      value: "whatsapp",
      label: renderChannelLabel("💬", t('templateBuilder.preview.channels.whatsapp'), true),
      ariaLabel: t('templateBuilder.preview.channels.whatsapp'),
      disabled: true,
    },
    {
      value: "sms",
      label: renderChannelLabel("📱", t('templateBuilder.preview.channels.sms'), true),
      ariaLabel: t('templateBuilder.preview.channels.sms'),
      disabled: true,
    },
  ];

  const handleChannelChange = (value: string) => {
    if (isTemplateChannel(value) && !disabledChannels.includes(value)) {
      onChannelChange(value);
    }
  };

  const sendTestEmail = async () => {
    if (!user?.email) {
      toast({
        title: t('templateBuilder.preview.toast.errorTitle'),
        description: t('templateBuilder.preview.toast.noUserEmail'),
        variant: "destructive",
      });
      return;
    }

    if (blocks.length === 0) {
      toast({
        title: t('templateBuilder.preview.toast.errorTitle'), 
        description: t('templateBuilder.preview.toast.noBlocks'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-template-email', {
        body: {
          to: user.email,
          subject: emailSubject || 'Test Email from Template Builder',
          preheader: preheader,
          blocks: blocks.filter(b => b.visible),
          mockData: mockData,
          isTest: true
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: t('templateBuilder.preview.toast.successTitle'),
        description: t('templateBuilder.preview.toast.testEmailSent', { email: user.email }),
      });
    } catch (error: unknown) {
      console.error('Error sending test email:', error);
      toast({
        title: t('templateBuilder.preview.toast.errorTitle'),
        description:
          getErrorMessage(error) ??
          t('templateBuilder.preview.toast.sendFailed'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{t('templateBuilder.preview.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('templateBuilder.preview.description')}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {activeChannel === "email" && (
              <>
                <Button
                  size="sm"
                  variant={previewDevice === "desktop" ? "default" : "ghost"}
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor className="h-4 w-4" />
                  {t('templateBuilder.preview.desktop')}
                </Button>
                <Button
                  size="sm"
                  variant={previewDevice === "mobile" ? "default" : "ghost"}
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                  {t('templateBuilder.preview.mobile')}
                </Button>
              </>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={sendTestEmail}
              disabled={isLoading || blocks.length === 0}
            >
              <Send className="h-4 w-4" />
              {isLoading ? t('templateBuilder.preview.sending') : t('templateBuilder.preview.testSend')}
            </Button>
          </div>
        </div>
      </div>

      {/* Channel Selector */}
      <div className="border-b px-6 py-3">
        <SegmentedControl
          value={activeChannel}
          onValueChange={handleChannelChange}
          options={channelOptions}
          className="w-full max-w-xl justify-between"
        />
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={cn(
          "mx-auto transition-all duration-200",
          activeChannel === "email"
            ? previewDevice === "desktop"
              ? "max-w-2xl"
              : "max-w-sm"
            : "max-w-sm"
        )}>
          {activeChannel === "email" && (
            <EmailPreview
              blocks={blocks.filter(b => b.visible)}
              mockData={mockData}
              device={previewDevice}
              emailSubject={emailSubject}
              preheader={preheader}
            />
          )}
          
          {activeChannel === "whatsapp" && (
            <WhatsAppPreview
              blocks={blocks.filter(b => b.visible)}
              mockData={mockData}
            />
          )}
          
          {activeChannel === "sms" && (
            <SMSPreview
              blocks={blocks.filter(b => b.visible)}
              mockData={mockData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
