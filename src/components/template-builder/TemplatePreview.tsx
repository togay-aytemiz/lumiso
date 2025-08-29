import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Send, Monitor, Smartphone } from "lucide-react";
import { TemplateBlock } from "@/types/templateBuilder";
import { EmailPreview } from "./previews/EmailPreview";
import { WhatsAppPreview } from "./previews/WhatsAppPreview";
import { SMSPreview } from "./previews/SMSPreview";
import { PlainTextPreview } from "./PlainTextPreview";
import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  blocks: TemplateBlock[];
  activeChannel: "email" | "whatsapp" | "sms" | "plaintext";
  onChannelChange: (channel: "email" | "whatsapp" | "sms" | "plaintext") => void;
  emailSubject?: string;
  preheader?: string;
  previewData?: Record<string, string>;
}

export function TemplatePreview({ blocks, activeChannel, onChannelChange, emailSubject, preheader, previewData }: TemplatePreviewProps) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const defaultMockData = {
    customer_name: "Sarah Johnson",
    session_date: "March 15, 2024",
    session_time: "2:00 PM",
    session_location: "Studio Downtown",
    business_name: "Radiant Photography",
    business_phone: "(555) 123-4567",
  };

  const mockData = previewData || defaultMockData;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Live Preview</h2>
            <p className="text-sm text-muted-foreground">See how your template looks across channels</p>
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
                  Desktop
                </Button>
                <Button
                  size="sm"
                  variant={previewDevice === "mobile" ? "default" : "ghost"}
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </Button>
              </>
            )}
            <Button size="sm" variant="outline">
              <Send className="h-4 w-4" />
              Test Send
            </Button>
          </div>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="border-b px-6 py-2">
        <Tabs value={activeChannel} onValueChange={(value) => onChannelChange(value as any)}>
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="email" className="flex items-center gap-2">
              📧 Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              💬 WhatsApp
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              📱 SMS
            </TabsTrigger>
            <TabsTrigger value="plaintext" className="flex items-center gap-2">
              📄 Plain
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={cn(
          "mx-auto transition-all duration-200",
          activeChannel === "email" 
            ? previewDevice === "desktop" 
              ? "max-w-2xl" 
              : "max-w-sm"
            : activeChannel === "plaintext"
              ? "max-w-2xl"
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

          {activeChannel === "plaintext" && (
            <PlainTextPreview
              blocks={blocks.filter(b => b.visible)}
              mockData={mockData}
            />
          )}
        </div>
      </div>
    </div>
  );
}