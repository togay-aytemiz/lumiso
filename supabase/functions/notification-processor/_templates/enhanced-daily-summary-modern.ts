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
        ">📊</div>
        <h2 style="
          color: #1f2937;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.2;
        ">${t('dailySummary.modern.headerTitle')}</h2>
        <p style="
          color: #6b7280;
          font-size: 16px;
          margin: 0;
          line-height: 1.4;
        ">${t('dailySummary.modern.headerSubtitle', { date: today })}</p>
      </div>
      
      <!-- Summary Stats -->
      <div style="
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 24px;
      ">
        <div style="
          text-align: center;
          background: white;
          padding: 16px 12px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          flex: 1;
          min-width: 70px;
          border: 1px solid #f3f4f6;
        ">
          <div style="
            font-size: 20px;
            font-weight: 700;
            color: ${brandColor};
            margin-bottom: 6px;
            line-height: 1;
          ">${upcomingSessions.length}</div>
          <div style="
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1.2;
          ">${statsSessionsLabel}</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px 12px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          flex: 1;
          min-width: 70px;
          border: 1px solid #f3f4f6;
        ">
          <div style="
            font-size: 20px;
            font-weight: 700;
            color: ${brandColor};
            margin-bottom: 6px;
            line-height: 1;
          ">${totalTodayReminders}</div>
          <div style="
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1.2;
          ">${statsRemindersLabel}</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px 12px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          flex: 1;
          min-width: 70px;
          border: 1px solid #f3f4f6;
        ">
          <div style="
            font-size: 20px;
            font-weight: 700;
            color: ${totalOverdue > 0 ? '#ef4444' : '#6b7280'};
            margin-bottom: 6px;
            line-height: 1;
          ">${totalOverdue}</div>
          <div style="
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1.2;
          ">${statsOverdueLabel}</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px 12px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          flex: 1;
          min-width: 70px;
          border: 1px solid #f3f4f6;
        ">
          <div style="
            font-size: 20px;
            font-weight: 700;
            color: ${totalPastSessions > 0 ? '#f59e0b' : '#6b7280'};
            margin-bottom: 6px;
            line-height: 1;
          ">${totalPastSessions}</div>
          <div style="
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1.2;
          ">${statsPastLabel}</div>
        </div>
      </div>
    </div>
  `;

  // Today's Sessions
  if (upcomingSessions.length > 0) {
    content += `
      <div style="margin: 32px 0;">
        <h3 style="
          color: #1f2937;
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
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin-bottom: 16px;
          border-left: 4px solid ${brandColor};
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          ">
            <h4 style="
              color: #1f2937;
              font-size: 16px;
              font-weight: 600;
              margin: 0;
              line-height: 1.3;
            ">${sessionName}</h4>
            <span style="
              background: ${brandColor}10;
              color: ${brandColor};
              padding: 4px 8px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">${todayBadge}</span>
          </div>
          
          <div style="
            margin-bottom: 16px;
          ">
            <div style="
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 8px;
              line-height: 1.4;
            ">⏰ ${sessionTime}</div>
            ${session.leads ? `
              <div style="
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 8px;
                line-height: 1.4;
              ">👤 ${clientLabel}: <strong style="color: #374151;">${session.leads.name}</strong></div>
            ` : ''}
            ${session.projects ? `
              <div style="
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 8px;
                line-height: 1.4;
              ">📋 ${projectLabel}: <strong style="color: #374151;">${session.projects.name}</strong></div>
            ` : ''}
            ${session.location ? `
              <div style="
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 8px;
                line-height: 1.4;
              ">📍 ${session.location}</div>
            ` : ''}
            ${session.notes ? `
              <div style="
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 4px;
                line-height: 1.4;
              ">📝 ${session.notes}</div>
            ` : ''}
          </div>
          
          ${templateData.baseUrl ? `
            <div style="text-align: right;">
              <a href="${templateData.baseUrl}/sessions/${session.id}" style="
                display: inline-block;
                background: ${brandColor};
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 500;
                font-size: 13px;
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
      <div style="margin: 32px 0;">
        <h3 style="
          color: #1f2937;
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
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin-bottom: 16px;
          border-left: 4px solid #f59e0b;
        ">
          <h4 style="
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            line-height: 1.3;
          ">${reminder.content}</h4>
          
          <div style="
            margin-bottom: 16px;
          ">
            <div style="
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 8px;
              line-height: 1.4;
            ">📅 ${formatDate(reminder.reminder_date, templateData.dateFormat, templateData.timezone)} ${reminder.reminder_time ? `${atText} ${formatTime(reminder.reminder_time, templateData.timeFormat, templateData.timezone, reminder.reminder_date)}` : ''}</div>
            ${reminder.leads ? `
              <div style="
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 8px;
                line-height: 1.4;
              ">👤 ${clientLabel}: <strong style="color: #374151;">${reminder.leads.name}</strong></div>
            ` : ''}
            ${reminder.projects ? `
              <div style="
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 4px;
                line-height: 1.4;
              ">📋 ${projectLabel}: <strong style="color: #374151;">${reminder.projects.name}</strong></div>
            ` : ''}
          </div>
          
          ${templateData.baseUrl ? `
            <div style="text-align: right;">
              <a href="${templateData.baseUrl}/reminders" style="
                display: inline-block;
                background: #f59e0b;
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 500;
                font-size: 13px;
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

  // Past Sessions (Alert Card)
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
          gap: 12px;
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
            min-width: 100px;
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
            min-width: 100px;
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
            min-width: 100px;
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
            min-width: 100px;
          ">${sessionsLabel}</a>
        </div>
      </div>
    `;
  }

  return createEmailTemplate(
    t('dailySummary.modern.pageTitle', { date: today }),
    content,
    templateData
  );
}
