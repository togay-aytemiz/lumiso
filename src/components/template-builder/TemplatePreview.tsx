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
  showSendTestButton?: boolean;
}

export function TemplatePreview({ blocks, activeChannel, onChannelChange, emailSubject, preheader, previewData, showSendTestButton = true }: TemplatePreviewProps) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isLoading, setIsLoading] = useState(false);
  const { user, session } = useAuth();
  const { t } = useTranslation('pages');

  const defaultMockData = {
    customer_name: t('templateBuilder.preview.mockData.customerName'),
    lead_name: t('templateBuilder.preview.mockData.leadName'),
    lead_email: t('templateBuilder.preview.mockData.leadEmail'),
    lead_phone: t('templateBuilder.preview.mockData.leadPhone'),
    lead_status: t('templateBuilder.preview.mockData.leadStatus'),
    lead_due_date: t('templateBuilder.preview.mockData.leadDueDate'),
    lead_created_date: t('templateBuilder.preview.mockData.leadCreatedDate'),
    lead_updated_date: t('templateBuilder.preview.mockData.leadUpdatedDate'),
    session_name: t('templateBuilder.preview.mockData.sessionName'),
    session_date: t('templateBuilder.preview.mockData.sessionDate'),
    session_time: t('templateBuilder.preview.mockData.sessionTime'),
    session_location: t('templateBuilder.preview.mockData.sessionLocation'),
    session_type: t('templateBuilder.preview.mockData.sessionType'),
    session_duration: t('templateBuilder.preview.mockData.sessionDuration'),
    session_status: t('templateBuilder.preview.mockData.sessionStatus'),
    session_meeting_url: t('templateBuilder.preview.mockData.sessionMeeting'),
    session_notes: t('templateBuilder.preview.mockData.sessionNotes'),
    business_name: t('templateBuilder.preview.mockData.businessName'),
    business_phone: t('templateBuilder.preview.mockData.businessPhone'),
    project_name: t('templateBuilder.preview.mockData.projectName'),
    project_package_name: t('templateBuilder.preview.mockData.projectPackage'),
  };

  const visibleBlocks = blocks.filter(block => block.visible);

  const mockData = {
    ...defaultMockData,
    ...(previewData ?? {})
  };
  const disabledChannels: TemplateChannel[] = ["whatsapp", "sms"];
  const soonLabel = t('templateBuilder.preview.channels.soon');

  const getDeviceButtonClasses = (isActive: boolean) =>
    isActive
      ? "btn-surface-action btn-surface-amber rounded-xl px-3 text-sm font-semibold border-amber-300 bg-amber-200 text-amber-950 shadow-sm ring-1 ring-amber-200"
      : "px-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-transparent focus-visible:ring-0";

  const getDeviceButtonVariant = (isActive: boolean) => (isActive ? "pill" : "ghost");

  const getDeviceIconClasses = (isActive: boolean) =>
    isActive ? "text-amber-800" : "text-muted-foreground";

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
    if (!user?.email || !session?.access_token) {
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
          blocks: visibleBlocks,
          mockData: mockData,
          isTest: true
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
                  variant={getDeviceButtonVariant(previewDevice === "desktop")}
                  className={getDeviceButtonClasses(previewDevice === "desktop")}
                  onClick={() => setPreviewDevice("desktop")}
                  aria-pressed={previewDevice === "desktop"}
                >
                  <Monitor className={cn("h-4 w-4", getDeviceIconClasses(previewDevice === "desktop"))} />
                  {t('templateBuilder.preview.desktop')}
                </Button>
                <Button
                  size="sm"
                  variant={getDeviceButtonVariant(previewDevice === "mobile")}
                  className={getDeviceButtonClasses(previewDevice === "mobile")}
                  onClick={() => setPreviewDevice("mobile")}
                  aria-pressed={previewDevice === "mobile"}
                >
                  <Smartphone className={cn("h-4 w-4", getDeviceIconClasses(previewDevice === "mobile"))} />
                  {t('templateBuilder.preview.mobile')}
                </Button>
              </>
            )}
            {showSendTestButton && (
              <Button 
                size="sm" 
                variant="secondary"
                className="bg-muted text-foreground border border-border hover:bg-muted/80"
                onClick={sendTestEmail}
                disabled={isLoading || visibleBlocks.length === 0}
              >
                <Send className="h-4 w-4" />
                {isLoading ? t('templateBuilder.preview.sending') : t('templateBuilder.preview.testSend')}
              </Button>
            )}
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
              blocks={visibleBlocks}
              mockData={mockData}
              device={previewDevice}
              emailSubject={emailSubject}
              preheader={preheader}
            />
          )}
          
          {activeChannel === "whatsapp" && (
            <WhatsAppPreview
              blocks={visibleBlocks}
              mockData={mockData}
            />
          )}
          
          {activeChannel === "sms" && (
            <SMSPreview
              blocks={visibleBlocks}
              mockData={mockData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
