import {
  createEmailLocalization,
  type EmailLocalization,
} from '../../_shared/email-i18n.ts';

export interface EmailTemplateData {
  userFullName?: string;
  businessName: string;
  brandColor?: string;
  dateFormat?: string;
  timeFormat?: string;
  baseUrl?: string;
  language?: string;
  localization?: EmailLocalization;
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
export function formatDate(
  dateString: string,
  format: string = 'DD/MM/YYYY',
  timezone: string = 'UTC'
): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date).reduce<Record<string, string>>(
      (acc, part) => {
        if (part.type !== 'literal') {
          acc[part.type] = part.value;
        }
        return acc;
      },
      {}
    );

    const year = parts.year ?? '';
    const month = parts.month ?? '';
    const day = parts.day ?? '';

    switch (format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
      default:
        return `${day}/${month}/${year}`;
    }
  } catch {
    return dateString;
  }
}

/**
 * Format time based on preference
 */
export function formatTime(
  timeString: string,
  format: string = '12-hour',
  timezone: string = 'UTC',
  dateString?: string
): string {
  if (!timeString) return '';

  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return timeString;
    }

    let referenceDate: Date;
    if (dateString) {
      referenceDate = new Date(`${dateString}T${timeString}`);
    } else {
      referenceDate = new Date();
      referenceDate.setHours(hours, minutes, 0, 0);
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: format === '12-hour',
    });

    return formatter.format(referenceDate);
  } catch {
    return timeString;
  }
}

/**
 * Format date and time together
 */
export function formatDateTime(dateString: string, timeString: string | null, templateData: EmailTemplateData): string {
  const formattedDate = formatDate(
    dateString,
    templateData.dateFormat,
    templateData.timezone
  );
  const formattedTime = timeString
    ? formatTime(
        timeString,
        templateData.timeFormat,
        templateData.timezone,
        dateString
      )
    : '';
  const localization =
    templateData.localization ||
    (templateData.localization = createEmailLocalization(templateData.language));
  const atText = localization.t('common.prepositions.at');
  
  return formattedTime ? `${formattedDate} ${atText} ${formattedTime}` : formattedDate;
}

/**
 * Create the base email template with header and footer
 */
export function createEmailTemplate(
  subject: string, 
  content: string, 
  templateData: EmailTemplateData
): string {
  const localization =
    templateData.localization ||
    (templateData.localization = createEmailLocalization(templateData.language));
  const t = localization.t;
  const brandColor = templateData.brandColor || '#1EB29F';
  const businessName = templateData.businessName;
  const baseUrl = templateData.baseUrl;
  
  return `
<!DOCTYPE html>
<html lang="${localization.language}">
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
      background-color: #ffffff;
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
    }
    .email-footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
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
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      ">${businessName}</h1>
    </div>
    
    <div class="email-body">
      ${content}
    </div>
    
    <div class="email-footer">
      <p style="margin: 0 0 12px 0;">
        ${t('common.footer.notice', { businessName })}
      </p>
      <p style="margin: 0;">
        ${t('common.footer.reason')}
      </p>
      ${baseUrl ? `
        <p style="margin: 0;">
          <a href="${baseUrl}" style="color: ${brandColor}; text-decoration: none;">
            ${t('common.cta.dashboard')}
          </a>
        </p>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
}
