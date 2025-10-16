import {
  createEmailTemplate,
  EmailTemplateData,
  Session,
  Lead,
  Activity,
  formatDateTime,
  formatDate,
  formatTime,
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
 * Generate modern daily summary with unified design system
 */
export function generateModernDailySummaryEmail(
  upcomingSessions: Session[], 
  todayReminders: Activity[], 
  overdueItems: OverdueItems, 
  pastSessions: Session[],
  templateData: EmailTemplateData
): string {
  const today = formatDate(new Date().toISOString(), templateData.dateFormat);
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  const totalPastSessions = pastSessions.length;
  const totalTodayReminders = todayReminders.length;
  const brandColor = templateData.brandColor || '#1EB29F';
  const lighterBrandColor = adjustBrightness(brandColor, 20);
  const localization =
    templateData.localization ||
    (templateData.localization = createEmailLocalization(templateData.language));
  const t = localization.t;
  const statsSessionsLabel = t('dailySummary.modern.stats.sessions');
  const statsRemindersLabel = t('dailySummary.modern.stats.reminders');
  const statsOverdueLabel = t('dailySummary.modern.stats.overdue');
  const statsPastLabel = t('dailySummary.modern.stats.past');
  const sessionsHeading = t('dailySummary.modern.sections.sessionsTitle', {
    count: upcomingSessions.length,
  });
  const remindersHeading = t('dailySummary.modern.sections.remindersTitle', {
    count: todayReminders.length,
  });
  const defaultSessionName = t(
    'dailySummary.modern.sections.defaultSessionName',
  );
  const clientLabel = t('common.labels.client');
  const projectLabel = t('common.labels.project');
  const todayBadge = t('common.badges.today');
  const atText = t('common.prepositions.at');
  const viewLabel = `${t('common.actions.view')} →`;
  const overdueMessage =
    totalOverdue === 1
      ? t('dailySummary.modern.messages.overdueOne')
      : t('dailySummary.modern.messages.overdueOther', {
          count: totalOverdue,
        });
  const pastMessage =
    totalPastSessions === 1
      ? t('dailySummary.modern.messages.pastOne')
      : t('dailySummary.modern.messages.pastOther', {
          count: totalPastSessions,
        });
  const overdueLinkLabel = t('dailySummary.modern.links.overdue');
  const pastLinkLabel = t('dailySummary.modern.links.pastSessions');
  const quickActionsTitle = t('dailySummary.modern.quickActionsTitle');
  const dashboardLabel = t('common.cta.dashboard');
  const leadsLabel = t('common.cta.leads');
  const projectsLabel = t('common.cta.projects');
  const sessionsLabel = t('common.cta.sessions');
  const summaryStatsMarkup = renderSummaryStatCards(
    [
      { value: upcomingSessions.length, label: statsSessionsLabel },
      { value: totalTodayReminders, label: statsRemindersLabel },
      {
        value: totalOverdue,
        label: statsOverdueLabel,
        emphasisColor: totalOverdue > 0 ? '#ef4444' : '#6b7280',
      },
      {
        value: totalPastSessions,
        label: statsPastLabel,
        emphasisColor: totalPastSessions > 0 ? '#f59e0b' : '#6b7280',
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
        ">📊</div>
        <h2 style="
          color: #0f172a;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.25;
        ">${t('dailySummary.modern.headerTitle')}</h2>
        <p style="
          color: #475569;
          font-size: 15px;
          margin: 0;
          line-height: 1.45;
        ">${t('dailySummary.modern.headerSubtitle', { date: today })}</p>
      </div>
      ${summaryStatsMarkup}
    </div>
  `;

  // Today's Sessions
  if (upcomingSessions.length > 0) {
    content += `
      <div style="margin: 32px auto; max-width: 560px;">
        <h3 style="
          color: #0f172a;
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          📸 ${sessionsHeading}
        </h3>
    `;

    upcomingSessions.forEach(session => {
      const sessionTime = formatDateTime(session.session_date, session.session_time, templateData);
      const sessionName = session.projects?.project_types?.name 
        ? `${session.projects.project_types.name} Session`
        : (session.notes || defaultSessionName);
      
      content += `
        <div style="
          background: #ffffff;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
          margin-bottom: 20px;
          border: 1px solid #e4e8f1;
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          ">
            <h4 style="
              color: #0f172a;
              font-size: 17px;
              font-weight: 600;
              margin: 0;
              line-height: 1.35;
            ">${sessionName}</h4>
            <span style="
              background: ${brandColor}14;
              color: ${brandColor};
              padding: 6px 12px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.6px;
            ">${todayBadge}</span>
          </div>
          
          <div style="
            margin-bottom: 20px;
          ">
            <div style="
              color: #475569;
              font-size: 14px;
              margin-bottom: 10px;
              line-height: 1.5;
            ">⏰ ${sessionTime}</div>
            ${session.leads ? `
              <div style="
                color: #475569;
                font-size: 14px;
                margin-bottom: 10px;
                line-height: 1.5;
              ">👤 ${clientLabel}: <strong style="color: #0f172a;">${session.leads.name}</strong></div>
            ` : ''}
            ${session.projects ? `
              <div style="
                color: #475569;
                font-size: 14px;
                margin-bottom: 10px;
                line-height: 1.5;
              ">📋 ${projectLabel}: <strong style="color: #0f172a;">${session.projects.name}</strong></div>
            ` : ''}
            ${session.location ? `
              <div style="
                color: #475569;
                font-size: 14px;
                margin-bottom: 10px;
                line-height: 1.5;
              ">📍 ${session.location}</div>
            ` : ''}
            ${session.notes ? `
              <div style="
                color: #475569;
                font-size: 14px;
                margin-bottom: 0;
                line-height: 1.5;
              ">📝 ${session.notes}</div>
            ` : ''}
          </div>
          
          ${templateData.baseUrl ? `
            <div style="
              display: flex;
              justify-content: flex-end;
            ">
              <a href="${templateData.baseUrl}/sessions/${session.id}" style="
                display: inline-block;
                background: ${brandColor};
                color: white;
                padding: 10px 18px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: 500;
                font-size: 13px;
                letter-spacing: 0.3px;
              ">${viewLabel}</a>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    content += `</div>`;
  }

  // Today's Reminders
  if (todayReminders.length > 0) {
    content += `
      <div style="margin: 32px auto; max-width: 560px;">
        <h3 style="
          color: #0f172a;
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          ⏰ ${remindersHeading}
        </h3>
    `;

    todayReminders.forEach(reminder => {
      content += `
        <div style="
          background: #ffffff;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
          margin-bottom: 20px;
          border: 1px solid #efe5d6;
        ">
          <h4 style="
            color: #0f172a;
            font-size: 17px;
            font-weight: 600;
            margin: 0 0 14px 0;
            line-height: 1.35;
          ">${reminder.content}</h4>
          
          <div style="
            margin-bottom: 20px;
          ">
            <div style="
              color: #475569;
              font-size: 14px;
              margin-bottom: 10px;
              line-height: 1.5;
            ">📅 ${formatDate(reminder.reminder_date, templateData.dateFormat, templateData.timezone)} ${reminder.reminder_time ? `${atText} ${formatTime(reminder.reminder_time, templateData.timeFormat, templateData.timezone, reminder.reminder_date)}` : ''}</div>
            ${reminder.leads ? `
              <div style="
                color: #475569;
                font-size: 14px;
                margin-bottom: 10px;
                line-height: 1.5;
              ">👤 ${clientLabel}: <strong style="color: #0f172a;">${reminder.leads.name}</strong></div>
            ` : ''}
            ${reminder.projects ? `
              <div style="
                color: #475569;
                font-size: 14px;
                margin-bottom: 0;
                line-height: 1.5;
              ">📋 ${projectLabel}: <strong style="color: #0f172a;">${reminder.projects.name}</strong></div>
            ` : ''}
          </div>
          
          ${templateData.baseUrl ? `
            <div style="
              display: flex;
              justify-content: flex-end;
            ">
              <a href="${templateData.baseUrl}/reminders" style="
                display: inline-block;
                background: #f59e0b;
                color: white;
                padding: 10px 18px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: 500;
                font-size: 13px;
                letter-spacing: 0.3px;
              ">${viewLabel}</a>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    content += `</div>`;
  }

  // Overdue Items (Alert Card)
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

  // Past Sessions (Alert Card)
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

  return createEmailTemplate(
    t('dailySummary.modern.pageTitle', { date: today }),
    content,
    templateData
  );
}
