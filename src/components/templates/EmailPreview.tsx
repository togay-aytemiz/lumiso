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
  sender = "Your Photography Studio <hello@yourstudio.com>", 
  recipient = "Sarah Johnson <sarah.johnson@example.com>",
  studioName = "Your Photography Studio",
  brandColor = "#1EB29F",
  logoUrl
}: EmailPreviewProps) {
  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif', 
      maxWidth: '600px', 
      margin: '0 auto', 
      background: 'white', 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Email Client Header - For Preview Only */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '16px', 
        borderBottom: '1px solid #e5e7eb', 
        background: '#f8fafc' 
      }}>
        <Mail className="w-5 h-5 text-slate-500" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{subject}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>From: {sender}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>To: {recipient}</div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Preview
        </Badge>
      </div>

      {/* Email Body - Matches actual sent email exactly */}
      <div>
        {/* Header Banner */}
        <div style={{ 
          position: 'relative', 
          height: '128px', 
          overflow: 'hidden', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
        }}>
          <div style={{ 
            position: 'absolute', 
            bottom: '16px', 
            left: '24px', 
            color: 'white' 
          }}>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              margin: '0' 
            }}>{studioName}</h2>
            <p style={{ 
              fontSize: '12px', 
              opacity: '0.9', 
              margin: '4px 0 0 0' 
            }}>Professional Photography</p>
          </div>
        </div>
        
        {/* Email Content */}
        <div style={{ padding: '24px' }}>
          <div style={{ 
            color: '#334155', 
            lineHeight: '1.6', 
            fontSize: '15px', 
            whiteSpace: 'pre-wrap' 
          }}>
            {htmlContent ? (
              <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            ) : (
              content
            )}
          </div>
        </div>
        
        {/* Professional Footer */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid #e2e8f0', 
          background: '#f8fafc' 
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '12px', 
            color: '#64748b' 
          }}>
            <div>
              <strong>{studioName}</strong>
              <div style={{ marginTop: '4px' }}>Professional Photography Services</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>{new Date().toLocaleDateString()}</div>
              <div style={{ marginTop: '4px', color: '#94a3b8' }}>Powered by Photography CRM</div>
            </div>
          </div>
        </div>
        
        {/* Brand Color Accent */}
        <div style={{ 
          height: '4px', 
          backgroundColor: brandColor 
        }}></div>
      </div>
    </div>
  );
}