import {
  createEmailLocalization,
  type EmailLocalization,
  type EmailLanguage,
} from '../../_shared/email-i18n.ts';

export interface EmailTemplateData {
  userFullName?: string;
  businessName: string;
  brandColor?: string;
  dateFormat?: string;
  timeFormat?: string;
  timezone?: string;
  baseUrl?: string;
  assetBaseUrl?: string;
  logoUrl?: string;
  platformName?: string;
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

  const trimmedTime = timeString.trim();
  const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})/);
  const fallback = timeMatch
    ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
    : trimmedTime;

  try {
    if (!timeMatch) {
      return trimmedTime;
    }

    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return fallback;
    }

    const isoTime = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:00`;

    let referenceDate: Date;
    if (dateString) {
      referenceDate = new Date(`${dateString}T${isoTime}`);
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
    return fallback;
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
  const platformName = templateData.platformName || 'Lumiso';
  const businessName = templateData.businessName;
  const baseUrl = templateData.baseUrl;
  const assetBaseUrl = templateData.assetBaseUrl || baseUrl;
  let logoUrl = templateData.logoUrl;

  if (!logoUrl && assetBaseUrl) {
    try {
      logoUrl = new URL('/lumiso-logo.png', assetBaseUrl).toString();
    } catch {
      const sanitized = assetBaseUrl.endsWith('/')
        ? assetBaseUrl.slice(0, -1)
        : assetBaseUrl ?? '';
      logoUrl = sanitized ? `${sanitized}/lumiso-logo.png` : undefined;
    }
  }
  
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
      background-color: #edf1f5;
      line-height: 1.6;
    }
    .email-wrapper {
      padding: 32px 16px;
      background-color: #edf1f5;
    }
    .email-container {
      max-width: 640px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
    }
    .email-header {
      background-color: #f1f5f9;
      padding: 32px 32px 24px;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    .email-body {
      padding: 32px;
    }
    .email-footer {
      background-color: #f8fafc;
      padding: 24px 32px 32px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    @media (max-width: 600px) {
      .email-wrapper {
        padding: 16px;
      }
      .email-container {
        margin: 0;
        box-shadow: none;
        border-radius: 16px;
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
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        ${
          logoUrl
            ? `<img src="${logoUrl}" alt="${t('common.alt.logo', { businessName: platformName })}" style="height: 40px; width: auto; display: block; margin: 0 auto 16px;" />`
            : `<div style="
                margin-bottom: 16px;
                font-size: 26px;
                font-weight: 700;
                color: #0f172a;
              ">${platformName}</div>`
        }
        ${
          businessName
            ? `<div style="margin-top: 20px;">
                <span style="
                  display: inline-block;
                  padding: 8px 20px;
                  border-radius: 999px;
                  background-color: ${brandColor}1a;
                  color: ${brandColor};
                  font-size: 13px;
                  font-weight: 600;
                  letter-spacing: 0.4px;
                ">${businessName}</span>
              </div>`
            : ''
        }
      </div>
      
      <div class="email-body">
        ${content}
      </div>
      
      <div class="email-footer">
        <p style="margin: 0 0 12px 0;">
          ${t('common.footer.notice', { businessName, platformName })}
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
  </div>
</body>
</html>`;
}

export interface SummaryStatConfig {
  value: string | number;
  label: string;
  emphasisColor?: string;
}

export function renderSummaryStatCards(
  stats: SummaryStatConfig[],
  brandColor: string
): string {
  if (!stats.length) {
    return '';
  }

  const columnWidth = Math.floor(100 / stats.length);

  return `
    <table role="presentation" width="100%" style="max-width: 520px; margin: 24px auto 0; border-collapse: separate; border-spacing: 0;">
      <tr>
        ${stats
          .map(
            (stat) => `
              <td width="${columnWidth}%" style="padding: 0 6px;">
                <div style="
                  background: #ffffff;
                  border-radius: 14px;
                  padding: 18px 12px;
                  border: 1px solid #e2e8f0;
                  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
                  text-align: center;
                ">
                  <div style="
                    font-size: 20px;
                    font-weight: 700;
                    color: ${stat.emphasisColor || brandColor};
                    margin-bottom: 6px;
                    line-height: 1;
                  ">${stat.value}</div>
                  <div style="
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    line-height: 1.3;
                  ">${stat.label}</div>
                </div>
              </td>
            `,
          )
          .join('')}
      </tr>
    </table>
  `;
}

export type { EmailLocalization, EmailLanguage };
