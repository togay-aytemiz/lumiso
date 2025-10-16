import { createEmailTemplate, EmailTemplateData, Session, Todo, Activity, Lead, formatDateTime, formatDate, formatTime } from './enhanced-email-base.ts';
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
  const tips =
    (localization.raw('dailySummary.empty.tips') as Array<
      { title: string; description: string }
    >) || [];
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
  
  let content = `
    <!-- Header Section -->
    <div style="
      background: linear-gradient(135deg, ${brandColor}15, ${lighterBrandColor}10);
      border-radius: 16px;
      padding: 32px;
      margin: 24px 0;
      border-left: 4px solid ${brandColor};
    ">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="
          font-size: 48px;
          margin-bottom: 8px;
          line-height: 1;
        ">🌅</div>
        <h2 style="
          color: #1f2937;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.2;
        ">${headerTitle}</h2>
        <p style="
          color: #6b7280;
          font-size: 16px;
          margin: 0;
          line-height: 1.4;
        ">${headerSubtitle}</p>
      </div>
      
      <!-- Empty State Stats -->
      <div style="
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      ">
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #6b7280;
            margin-bottom: 4px;
          ">0</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${statsSessionsLabel}</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #6b7280;
            margin-bottom: 4px;
          ">0</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${statsRemindersLabel}</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: ${totalOverdue > 0 ? '#ef4444' : '#6b7280'};
            margin-bottom: 4px;
          ">${totalOverdue}</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${statsOverdueLabel}</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: ${totalPastSessions > 0 ? '#f59e0b' : '#6b7280'};
            margin-bottom: 4px;
          ">${totalPastSessions}</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${statsPastLabel}</div>
        </div>
      </div>
    </div>
  `;

  // Business Growth Tips Section
  const tipAccentColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const tipsContent = tips
    .map((tip, index) => {
      const color = tipAccentColors[index % tipAccentColors.length];
      return `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid ${color};
        ">
          <h4 style="
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          ">${tip.title}</h4>
          <p style="
            color: #6b7280;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
          ">${tip.description}</p>
        </div>
      `;
    })
    .join('');

  content += `
    <div style="margin: 32px 0;">
      <h3 style="
        color: #1f2937;
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 20px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        text-align: center;
        justify-content: center;
      ">
        ${tipsTitle}
      </h3>
      
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      ">
        ${tipsContent}
      </div>
    </div>
  `;

  // Overdue Items (Alert Card) - only if there are any
  if (totalOverdue > 0) {
    content += `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin: 24px 0;
        border-left: 4px solid #ef4444;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        ">
          <div style="flex: 1;">
            <p style="
              margin: 0;
              color: #dc2626;
              font-weight: 600;
              font-size: 16px;
            ">
              ${overdueMessage}
            </p>
          </div>
        </div>
        ${templateData.baseUrl ? `
          <div style="text-align: left;">
            <a href="${templateData.baseUrl}/reminders" style="
              color: #dc2626;
              text-decoration: underline;
              font-size: 14px;
              font-weight: 500;
            ">${overdueLinkLabel}</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Past Sessions (Alert Card) - only if there are any
  if (totalPastSessions > 0) {
    content += `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin: 24px 0;
        border-left: 4px solid #f59e0b;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        ">
          <div style="flex: 1;">
            <p style="
              margin: 0;
              color: #d97706;
              font-weight: 600;
              font-size: 16px;
            ">
              ${pastMessage}
            </p>
          </div>
        </div>
        ${templateData.baseUrl ? `
          <div style="text-align: left;">
            <a href="${templateData.baseUrl}/sessions" style="
              color: #d97706;
              text-decoration: underline;
              font-size: 14px;
              font-weight: 500;
            ">${pastLinkLabel}</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Quick Actions
  if (templateData.baseUrl) {
    content += `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin: 32px 0;
      ">
        <h3 style="
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 16px 0;
          text-align: center;
        ">${quickActionsTitle}</h3>
        
        <div style="
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin: 0 auto;
        ">
          <a href="${templateData.baseUrl}" style="
            display: inline-block;
            background: ${brandColor};
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">${dashboardLabel}</a>
          <a href="${templateData.baseUrl}/leads" style="
            display: inline-block;
            background: #6b7280;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">${leadsLabel}</a>
          <a href="${templateData.baseUrl}/projects" style="
            display: inline-block;
            background: #6b7280;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">${projectsLabel}</a>
          <a href="${templateData.baseUrl}/sessions" style="
            display: inline-block;
            background: #6b7280;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">${sessionsLabel}</a>
        </div>
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
      background: linear-gradient(135deg, #22c55e15, #16a34a10);
      border-radius: 16px;
      padding: 24px;
      margin: 32px 0;
      border-left: 4px solid #22c55e;
      text-align: center;
    ">
      <p style="
        margin: 0;
        font-style: italic;
        color: #059669;
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
