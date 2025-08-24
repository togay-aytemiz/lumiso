import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

interface EmailPreviewProps {
  subject: string;
  content: string;
  htmlContent?: string;
  sender?: string;
  recipient?: string;
}

export function EmailPreview({ 
  subject, 
  content, 
  htmlContent, 
  sender = "Studio Name <hello@studio.com>", 
  recipient = "Jane Smith <jane.smith@example.com>" 
}: EmailPreviewProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      {/* Email Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        <Mail className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{subject}</div>
          <div className="text-xs text-muted-foreground">
            From: {sender}
          </div>
          <div className="text-xs text-muted-foreground">
            To: {recipient}
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Preview
        </Badge>
      </div>

      {/* Email Body */}
      <div className="p-6 bg-background">
        {htmlContent ? (
          <div 
            className="prose prose-sm max-w-none [&_*]:text-foreground"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {content}
          </div>
        )}
      </div>

      {/* Email Footer */}
      <div className="px-6 py-4 border-t bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Sent via Photography CRM</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </Card>
  );
}