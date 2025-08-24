import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import newbornBg from "@/assets/newborn-bg.jpg";

interface EmailPreviewProps {
  subject: string;
  content: string;
  htmlContent?: string;
  sender?: string;
  recipient?: string;
  studioName?: string;
  brandColor?: string;
  logoUrl?: string;
}

export function EmailPreview({ 
  subject, 
  content, 
  htmlContent, 
  sender = "Sunset Photography Studio <hello@sunsetphoto.com>", 
  recipient = "Jane Smith <jane.smith@example.com>",
  studioName = "Sunset Photography Studio",
  brandColor = "#1EB29F",
  logoUrl
}: EmailPreviewProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      {/* Email Client Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-slate-50">
        <Mail className="w-5 h-5 text-slate-500" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">{subject}</div>
          <div className="text-xs text-slate-600">From: {sender}</div>
          <div className="text-xs text-slate-600">To: {recipient}</div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Preview
        </Badge>
      </div>

      {/* Professional Email Body */}
      <div className="bg-white">
        {/* Header Banner */}
        <div className="relative h-32 overflow-hidden">
          <img 
            src={newbornBg} 
            alt="Studio Banner" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"></div>
          <div className="absolute bottom-4 left-6 flex items-center gap-3">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt="Studio Logo" 
                className="w-10 h-10 rounded-full bg-white p-1"
              />
            )}
            <div className="text-white">
              <h2 className="text-lg font-bold">{studioName}</h2>
              <p className="text-xs opacity-90">Professional Photography</p>
            </div>
          </div>
        </div>

        {/* Email Content */}
        <div className="p-6">
          {htmlContent ? (
            <div 
              className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div 
              className="text-slate-700 leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: '15px', lineHeight: '1.6' }}
            >
              {content}
            </div>
          )}
        </div>

        {/* Professional Footer */}
        <div className="px-6 py-4 border-t bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div>
              <strong>{studioName}</strong>
              <div className="mt-1">Professional Photography Services</div>
            </div>
            <div className="text-right">
              <div>{new Date().toLocaleDateString()}</div>
              <div className="mt-1 text-slate-500">Powered by Photography CRM</div>
            </div>
          </div>
        </div>

        {/* Brand Color Accent */}
        <div 
          className="h-1" 
          style={{ backgroundColor: brandColor }}
        ></div>
      </div>
    </Card>
  );
}