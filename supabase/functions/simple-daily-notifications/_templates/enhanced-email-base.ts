export interface EmailTemplateData {
  userFullName: string;
  businessName: string;
  brandColor?: string;
  dateFormat?: string;
  timeFormat?: string;
  baseUrl?: string;
}

export interface Session {
  id: string;
  session_date: string;
  session_time?: string;
  notes?: string;
  location?: string;
  leads?: { name: string };
  projects?: { name: string; project_types?: { name: string } };
}

export interface Todo {
  id: string;
  content: string;
  created_at: string;
  projects?: { id: string; name: string; leads?: { name: string } };
}

export interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time?: string;
  lead_id?: string;
  project_id?: string;
  leads?: { name: string };
  projects?: { name: string };
}

export interface Lead {
  id: string;
  name: string;
  notes?: string;
  status?: string;
}

/**
 * Format date based on preference
 */
export function formatDate(dateString: string, format: string = 'DD/MM/YYYY'): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format time based on preference
 */
export function formatTime(timeString: string, format: string = '12-hour'): string {
  if (!timeString) return '';
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (format === '24-hour') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // 12-hour format
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format date and time together
 */
export function formatDateTime(dateString: string, timeString: string | null, templateData: EmailTemplateData): string {
  const formattedDate = formatDate(dateString, templateData.dateFormat);
  const formattedTime = timeString ? formatTime(timeString, templateData.timeFormat) : '';
  
  return formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate;
}

/**
 * Create the base email template with header and footer
 */
export function createEmailTemplate(
  subject: string, 
  content: string, 
  templateData: EmailTemplateData
): string {
  const brandColor = templateData.brandColor || '#1EB29F';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8fafc;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #f8fafc;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, ${brandColor}, ${brandColor}dd);
      padding: 24px;
      text-align: center;
      color: white;
    }
    .email-body {
      padding: 24px;
      background-color: #f8fafc;
    }
    .email-footer {
      background-color: #e2e8f0;
      padding: 24px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #cbd5e1;
    }
    .lumiso-logo {
      max-height: 40px;
      width: auto;
    }
    @media (max-width: 600px) {
      .email-container {
        margin: 0;
        box-shadow: none;
      }
      .email-body {
        padding: 16px;
      }
      .email-footer {
        padding: 16px;
      }
      .lumiso-logo {
        max-height: 32px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <img 
        src="https://my.lumiso.app/lumiso-logo.png" 
        alt="Lumiso" 
        class="lumiso-logo"
        style="
          max-height: 40px;
          width: auto;
          margin: 0;
        "
      />
    </div>
    
    <div class="email-body">
      ${content}
    </div>
    
    <div class="email-footer">
      <p style="margin: 0 0 12px 0;">
        This email was sent by <strong>Lumiso</strong>
      </p>
      ${templateData.baseUrl ? `
        <p style="margin: 0;">
          <a href="${templateData.baseUrl}" style="color: ${brandColor}; text-decoration: none;">
            Visit Dashboard
          </a>
        </p>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
}