import {
  createEmailTemplate,
  EmailTemplateData,
  Session,
  Activity,
  Lead,
  formatDate,
  renderSummaryStatCards,
} from './enhanced-email-base.ts';
import { createEmailLocalization } from '../../_shared/email-i18n.ts';

interface OverdueItems {
  leads: Lead[];
  activities: Activity[];
}

/**
 * Helper function to adjust color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  hex = hex.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Generate empty daily summary with business tips and any existing overdue/past items
 */
export function generateEmptyDailySummaryEmail(
  overdueItems: OverdueItems, 
  pastSessions: Session[],
  templateData: EmailTemplateData
): string {
  const today = formatDate(
    new Date().toISOString(),
    templateData.dateFormat,
    templateData.timezone
  );
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  const totalPastSessions = pastSessions.length;
  const brandColor = templateData.brandColor || '#1EB29F';
  const lighterBrandColor = adjustBrightness(brandColor, 20);
  const localization =
    templateData.localization ||
    (templateData.localization = createEmailLocalization(templateData.language));
  const t = localization.t;
  const statsSessionsLabel = t('dailySummary.empty.stats.sessions');
  const statsRemindersLabel = t('dailySummary.empty.stats.reminders');
  const statsOverdueLabel = t('dailySummary.empty.stats.overdue');
  const statsPastLabel = t('dailySummary.empty.stats.past');
  const headerTitle = t('dailySummary.empty.headerTitle');
  const headerSubtitle = t('dailySummary.empty.headerSubtitle', { date: today });
  const tipsTitle = t('dailySummary.empty.tipsTitle');
  const rawTips = localization.raw('dailySummary.empty.tips');
  const tips = Array.isArray(rawTips)
    ? rawTips.filter(
        (tip): tip is { title: string; description: string } =>
          typeof tip === 'object' &&
          tip !== null &&
          typeof (tip as { title?: unknown }).title === 'string' &&
          typeof (tip as { description?: unknown }).description === 'string',
      )
    : [];
  const overdueMessage =
    totalOverdue === 1
      ? t('dailySummary.empty.messages.overdueOne')
      : t('dailySummary.empty.messages.overdueOther', { count: totalOverdue });
  const pastMessage =
    totalPastSessions === 1
      ? t('dailySummary.empty.messages.pastOne')
      : t('dailySummary.empty.messages.pastOther', { count: totalPastSessions });
  const motivationalKeyNode = localization.raw(
    'dailySummary.empty.motivationalKey',
  );
  const motivationalMessages =
    typeof motivationalKeyNode === 'string'
      ? localization.list(motivationalKeyNode)
      : [];
  const quickActionsTitle = t('dailySummary.modern.quickActionsTitle');
  const dashboardLabel = t('common.cta.dashboard');
  const leadsLabel = t('common.cta.leads');
  const projectsLabel = t('common.cta.projects');
  const sessionsLabel = t('common.cta.sessions');
  const overdueLinkLabel = t('dailySummary.modern.links.overdue');
  const pastLinkLabel = t('dailySummary.modern.links.pastSessions');
  const summaryStatsMarkup = renderSummaryStatCards(
    [
      { value: 0, label: statsSessionsLabel, emphasisColor: '#64748b' },
      { value: 0, label: statsRemindersLabel, emphasisColor: '#64748b' },
      {
        value: totalOverdue,
        label: statsOverdueLabel,
        emphasisColor: totalOverdue > 0 ? '#ef4444' : '#64748b',
      },
      {
        value: totalPastSessions,
        label: statsPastLabel,
        emphasisColor: totalPastSessions > 0 ? '#f59e0b' : '#64748b',
      },
    ],
    brandColor,
  );
  
  let content = `
    <div style="
      background: linear-gradient(135deg, ${brandColor}1a, ${lighterBrandColor}0f);
      border-radius: 20px;
      padding: 40px 32px 32px;
      margin: 24px auto;
      max-width: 560px;
      border: 1px solid ${brandColor}26;
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
    ">
      <div style="text-align: center; margin-bottom: 12px;">
        <div style="
          font-size: 44px;
          margin-bottom: 12px;
          line-height: 1;
        ">🌅</div>
        <h2 style="
          color: #0f172a;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.25;
        ">${headerTitle}</h2>
        <p style="
          color: #475569;
          font-size: 15px;
          margin: 0;
          line-height: 1.45;
        ">${headerSubtitle}</p>
      </div>
      ${summaryStatsMarkup}
    </div>
  `;

  // Business Growth Tips Section
  const tipAccentColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const tipsContent = tips
    .map((tip, index) => {
      const color = tipAccentColors[index % tipAccentColors.length];
      return `
        <tr>
          <td width="100%" style="padding-bottom: 16px;">
            <div style="
              background: #ffffff;
              border-radius: 18px;
              padding: 24px;
              box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
              border: 1px solid #e4e8f1;
            ">
              <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 12px;
              ">
                <span style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  width: 12px;
                  height: 12px;
                  background: ${color};
                  border-radius: 999px;
                "></span>
                <h4 style="
                  color: #0f172a;
                  font-size: 16px;
                  font-weight: 600;
                  margin: 0;
                ">${tip.title}</h4>
              </div>
              <p style="
                color: #475569;
                font-size: 14px;
                margin: 0;
                line-height: 1.6;
              ">${tip.description}</p>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  content += `
    <div style="margin: 32px auto; max-width: 560px;">
      <h3 style="
        color: #0f172a;
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 20px 0;
        text-align: center;
      ">
        ${tipsTitle}
      </h3>

      <table role="presentation" width="100%" style="border-collapse: separate; border-spacing: 0;">
        <tbody>
          ${tipsContent}
        </tbody>
      </table>
    </div>
  `;

  // Overdue Items (Alert Card) - only if there are any
  if (totalOverdue > 0) {
    content += `
      <div style="
        max-width: 560px;
        margin: 24px auto;
        background: #ffffff;
        border-radius: 18px;
        padding: 24px;
        border: 1px solid #fecaca;
        box-shadow: 0 14px 32px rgba(185, 28, 28, 0.12);
      ">
        <p style="
          margin: 0 0 12px 0;
          color: #b91c1c;
          font-weight: 600;
          font-size: 15px;
          line-height: 1.5;
        ">
          ${overdueMessage}
        </p>
        ${templateData.baseUrl ? `
          <a href="${templateData.baseUrl}/reminders" style="
            display: inline-block;
            margin-top: 4px;
            color: #ffffff;
            background: #dc2626;
            padding: 10px 18px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 0.3px;
          ">${overdueLinkLabel} →</a>
        ` : ''}
      </div>
    `;
  }

  // Past Sessions (Alert Card) - only if there are any
  if (totalPastSessions > 0) {
    content += `
      <div style="
        max-width: 560px;
        margin: 24px auto;
        background: #ffffff;
        border-radius: 18px;
        padding: 24px;
        border: 1px solid #fcdca9;
        box-shadow: 0 14px 32px rgba(217, 119, 6, 0.12);
      ">
        <p style="
          margin: 0 0 12px 0;
          color: #c2410c;
          font-weight: 600;
          font-size: 15px;
          line-height: 1.5;
        ">
          ${pastMessage}
        </p>
        ${templateData.baseUrl ? `
          <a href="${templateData.baseUrl}/sessions" style="
            display: inline-block;
            margin-top: 4px;
            color: #ffffff;
            background: #f59e0b;
            padding: 10px 18px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 0.3px;
          ">${pastLinkLabel} →</a>
        ` : ''}
      </div>
    `;
  }

  // Quick Actions
  if (templateData.baseUrl) {
    content += `
      <div style="
        max-width: 560px;
        margin: 32px auto;
        background: #ffffff;
        border-radius: 18px;
        padding: 28px 24px;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
        border: 1px solid #e4e8f1;
      ">
        <h3 style="
          color: #0f172a;
          font-size: 19px;
          font-weight: 600;
          margin: 0 0 20px 0;
          text-align: center;
        ">${quickActionsTitle}</h3>
        
        <table role="presentation" width="100%" style="max-width: 420px; margin: 0 auto; border-collapse: separate; border-spacing: 0;">
          <tr>
            <td style="padding: 6px;">
              <a href="${templateData.baseUrl}" style="
                display: block;
                background: ${brandColor};
                color: #ffffff;
                padding: 12px 16px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                text-align: center;
                letter-spacing: 0.3px;
              ">${dashboardLabel}</a>
            </td>
            <td style="padding: 6px;">
              <a href="${templateData.baseUrl}/leads" style="
                display: block;
                background: #1f2937;
                color: #ffffff;
                padding: 12px 16px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                text-align: center;
                letter-spacing: 0.3px;
              ">${leadsLabel}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px;">
              <a href="${templateData.baseUrl}/projects" style="
                display: block;
                background: #334155;
                color: #ffffff;
                padding: 12px 16px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                text-align: center;
                letter-spacing: 0.3px;
              ">${projectsLabel}</a>
            </td>
            <td style="padding: 6px;">
              <a href="${templateData.baseUrl}/sessions" style="
                display: block;
                background: #475569;
                color: #ffffff;
                padding: 12px 16px;
                border-radius: 12px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                text-align: center;
                letter-spacing: 0.3px;
              ">${sessionsLabel}</a>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  // Motivational message
  const fallbackMessages = [
    'Every quiet day is a chance to build the future. Use this time wisely! 🌟',
    "No sessions today? Perfect opportunity to nurture your business growth! 💪",
    "Great photographers use downtime to create opportunities. Today's your day! ✨",
    "Success isn't just about busy days - it's about making every day count! 🎯",
    "Today's focus time: grow your business, connect with leads, plan your success! 🚀",
  ];
  const messages = motivationalMessages.length ? motivationalMessages : fallbackMessages;
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  content += `
    <div style="
      max-width: 560px;
      margin: 32px auto;
      background: linear-gradient(135deg, #22c55e1a, #16a34a0f);
      border-radius: 20px;
      padding: 28px 24px;
      border: 1px solid #bbf7d0;
      text-align: center;
      box-shadow: 0 16px 36px rgba(22, 163, 74, 0.12);
    ">
      <p style="
        margin: 0;
        font-style: italic;
        color: #047857;
        font-size: 16px;
        line-height: 1.5;
      ">
        ${randomMessage}
      </p>
    </div>
  `;

  return createEmailTemplate(
    t('dailySummary.empty.pageTitle', { date: today }),
    content,
    templateData
  );
}
