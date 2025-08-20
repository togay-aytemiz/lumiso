// Enhanced email template utilities with proper data relationships and formatting

export interface EmailTemplateData {
  userFullName: string;
  businessName?: string;
  logoUrl?: string;
  brandColor?: string;
  baseUrl?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  due_date?: string;
  status?: string;
  assignees?: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  status?: string;
  base_price?: number;
  assignees?: string[];
  leads?: { name: string; email?: string; phone?: string };
  project_types?: { name: string };
}

export interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  leads?: { name: string; email?: string; phone?: string };
  projects?: { name: string; id: string };
}

export interface Todo {
  id: string;
  content: string;
  created_at: string;
  projects?: { name: string; id: string };
}

export interface Activity {
  id: string;
  content: string;
  reminder_date?: string;
  type: string;
  leads?: { name: string; email?: string };
  projects?: { name: string; id: string };
}

// Format date according to user preference
export function formatDate(dateString: string, format: string = 'DD/MM/YYYY'): string {
  const date = new Date(dateString);
  
  switch (format) {
    case 'MM/DD/YYYY':
      return date.toLocaleDateString('en-US');
    case 'YYYY-MM-DD':
      return date.toISOString().split('T')[0];
    case 'DD/MM/YYYY':
    default:
      return date.toLocaleDateString('en-GB');
  }
}

// Format time according to user preference
export function formatTime(timeString: string, format: string = '12-hour'): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  if (format === '24-hour') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } else {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
}

// Format date and time together
export function formatDateTime(dateString: string, timeString?: string, templateData?: EmailTemplateData): string {
  const formattedDate = formatDate(dateString, templateData?.dateFormat);
  if (timeString) {
    const formattedTime = formatTime(timeString, templateData?.timeFormat);
    return `${formattedDate} at ${formattedTime}`;
  }
  return formattedDate;
}

// Calculate days between dates
export function daysBetween(date1: string, date2: string = new Date().toISOString()): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export const getEmailBaseStyles = (brandColor = '#1EB29F') => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1F2937;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .email-header {
      background: linear-gradient(135deg, ${brandColor}, ${adjustBrightness(brandColor, -20)});
      padding: 32px 24px;
      text-align: center;
    }
    
    .logo {
      height: 48px;
      margin-bottom: 16px;
    }
    
    .company-name {
      color: #FFFFFF;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }
    
    .email-body {
      padding: 32px 24px;
    }
    
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      margin: 24px 0 16px 0;
      border-bottom: 2px solid #E5E7EB;
      padding-bottom: 8px;
    }
    
    .item-card {
      background-color: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      transition: box-shadow 0.2s ease;
    }
    
    .item-card:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .item-title {
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .item-meta {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 8px;
    }
    
    .item-relationship {
      font-size: 13px;
      color: #9CA3AF;
      font-style: italic;
      margin-bottom: 8px;
    }
    
    .item-action {
      display: inline-block;
      background-color: ${adjustBrightness(brandColor, 90)};
      color: #1F2937;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      border: 1px solid ${adjustBrightness(brandColor, 60)};
      margin-right: 8px;
      margin-top: 8px;
    }
    
    .item-action:hover {
      background-color: ${adjustBrightness(brandColor, 85)};
      border-color: ${adjustBrightness(brandColor, 50)};
      color: #111827;
    }
    
    .summary-stats {
      background-color: #EFF6FF;
      border: 1px solid #DBEAFE;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      text-align: center;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
    }
    
    .stat-item {
      text-align: center;
    }
    
    .stat-number {
      font-size: 24px;
      font-weight: 700;
      color: ${brandColor};
      display: block;
    }
    
    .stat-label {
      font-size: 14px;
      color: #6B7280;
      margin-top: 4px;
    }
    
    .cta-button {
      display: inline-block;
      background-color: ${adjustBrightness(brandColor, 90)};
      color: #1F2937;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 8px 16px 0;
      text-align: center;
      border: 1px solid ${adjustBrightness(brandColor, 60)};
      transition: all 0.2s ease;
    }
    
    .cta-button:hover {
      background-color: ${adjustBrightness(brandColor, 85)};
      border-color: ${adjustBrightness(brandColor, 50)};
      color: #111827;
    }
    
    .email-footer {
      background-color: #F3F4F6;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #E5E7EB;
    }
    
    .footer-text {
      font-size: 12px;
      color: #6B7280;
      margin: 0;
    }
    
    .overdue-badge {
      background-color: #FEF2F2;
      color: #B91C1C;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .upcoming-badge {
      background-color: #EFF6FF;
      color: #1D4ED8;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .high-priority {
      background-color: #FEF2F2;
      border-color: #FECACA;
    }
    
    .medium-priority {
      background-color: #FFFBEB;
      border-color: #FED7AA;
    }
    
    .low-priority {
      background-color: #F0FDF4;
      border-color: #BBF7D0;
    }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 0;
        border-radius: 0;
      }
      
      .email-body {
        padding: 24px 16px;
      }
      
      .summary-stats {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .cta-button {
        display: block;
        margin: 8px 0;
      }
    }
  </style>
`;

// Helper function to adjust color brightness
function adjustBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

export const createEmailTemplate = (
  title: string,
  content: string,
  templateData: EmailTemplateData
) => {
  const { userFullName, businessName = "Photography CRM", logoUrl, brandColor = "#1EB29F", baseUrl = "" } = templateData;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      ${getEmailBaseStyles(brandColor)}
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" class="logo" />` : ''}
          <h1 class="company-name">${businessName}</h1>
        </div>
        
        <div class="email-body">
          <div class="greeting">Hi ${userFullName},</div>
          ${content}
        </div>
        
        <div class="email-footer">
          <p class="footer-text">
            This is an automated notification from ${businessName}.<br>
            ${baseUrl ? `<a href="${baseUrl}" style="color: ${brandColor};">Visit your dashboard</a>` : ''}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};