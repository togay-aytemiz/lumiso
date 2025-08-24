import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Check, CheckCheck } from "lucide-react";

interface WhatsAppPreviewProps {
  content: string;
  senderName?: string;
  isRead?: boolean;
}

export function WhatsAppPreview({ 
  content, 
  senderName = "Studio Name",
  isRead = true
}: WhatsAppPreviewProps) {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <Card className="w-full max-w-md mx-auto bg-gradient-to-b from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
      {/* WhatsApp Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-emerald-600 text-white">
        <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{senderName}</div>
          <div className="text-xs text-emerald-100">Online</div>
        </div>
        <Badge variant="secondary" className="text-xs bg-emerald-700 text-emerald-100 border-emerald-600">
          Preview
        </Badge>
      </div>

      {/* Chat Area */}
      <div className="p-4 min-h-[300px] bg-emerald-50 dark:bg-emerald-950 relative">
        {/* Chat background pattern */}
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800"></div>
        
        <div className="relative">
          {/* Outgoing Message (from business) */}
          <div className="flex justify-end mb-4">
            <div className="max-w-[80%] bg-emerald-500 text-white p-3 rounded-lg rounded-br-sm shadow-sm">
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {content}
              </div>
              <div className="flex items-center justify-end gap-1 mt-2 text-xs text-emerald-100">
                <span>{currentTime}</span>
                {isRead ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>

          {/* Sample response (incoming) */}
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white dark:bg-muted p-3 rounded-lg rounded-bl-sm shadow-sm">
              <div className="text-sm text-foreground">
                Thank you! Looking forward to it! 📸
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {currentTime}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Footer */}
      <div className="px-4 py-2 border-t bg-background/50 text-xs text-muted-foreground text-center">
        WhatsApp Business Preview
      </div>
    </Card>
  );
}