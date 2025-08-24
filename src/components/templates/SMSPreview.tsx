import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Signal, Wifi, Battery } from "lucide-react";

interface SMSPreviewProps {
  content: string;
  senderName?: string;
}

export function SMSPreview({ 
  content, 
  senderName = "Studio Name"
}: SMSPreviewProps) {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <Card className="w-full max-w-sm mx-auto bg-background border-2">
      {/* Phone Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b text-xs">
        <div className="flex items-center gap-1">
          <Signal className="w-3 h-3" />
          <Wifi className="w-3 h-3" />
        </div>
        <div className="font-medium">
          {currentTime}
        </div>
        <div className="flex items-center gap-1">
          <span>95%</span>
          <Battery className="w-3 h-3" />
        </div>
      </div>

      {/* SMS Header */}
      <div className="flex items-center gap-3 p-3 border-b">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{senderName}</div>
          <div className="text-xs text-muted-foreground">SMS</div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Preview
        </Badge>
      </div>

      {/* SMS Messages */}
      <div className="p-4 min-h-[250px] space-y-3">
        {/* Incoming message (from business) */}
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-muted p-3 rounded-2xl rounded-bl-md">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {content}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {currentTime}
            </div>
          </div>
        </div>

        {/* Sample response (outgoing) */}
        <div className="flex justify-end">
          <div className="max-w-[85%] bg-primary text-primary-foreground p-3 rounded-2xl rounded-br-md">
            <div className="text-sm">
              Perfect! See you then 👍
            </div>
            <div className="text-xs text-primary-foreground/70 mt-1">
              {currentTime}
            </div>
          </div>
        </div>
      </div>

      {/* SMS Footer */}
      <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground text-center">
        Text Message Preview
      </div>
    </Card>
  );
}