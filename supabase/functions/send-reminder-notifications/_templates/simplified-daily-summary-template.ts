import { createEmailTemplate, EmailTemplateData, formatDate, formatTime } from './enhanced-email-base.ts';

export function generateDailySummaryEmailSimplified(
  upcomingSessions: any[],
  overdueSessions: any[],
  overdueReminders: any[],
  upcomingReminders: any[],
  pendingTodos: any[],  
  templateData: EmailTemplateData
): string {
  const today = formatDate(new Date().toISOString(), templateData.dateFormat);
  
  // Generate sections
  let sections = [];
  
  // Today's upcoming Sessions section
  if (upcomingSessions.length > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          📸 Today's Photography Sessions (${upcomingSessions.length})
        </h2>
        ${upcomingSessions.slice(0, 5).map(session => `
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: between; align-items: start;">
              <div>
                <div style="font-weight: 600; color: #1f2937;">${session.leads?.name || 'Session'}</div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">
                  ${session.session_time ? formatTime(session.session_time, templateData.timeFormat) : 'Time TBD'} • ${session.projects?.name || 'Project'}
                </div>
                ${session.leads?.phone ? `<div style="color: #6b7280; font-size: 14px;">📞 ${session.leads.phone}</div>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `);
  }

  // Overdue Sessions section
  if (overdueSessions.length > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #dc2626; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          🚨 Overdue Sessions (${overdueSessions.length}) - Action Needed
        </h2>
        ${overdueSessions.slice(0, 3).map(session => `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #dc2626;">${session.leads?.name || 'Session'}</div>
            <div style="color: #7f1d1d; font-size: 14px; margin-top: 4px;">
              Was scheduled: ${formatDate(session.session_date, templateData.dateFormat)} ${session.session_time ? 'at ' + formatTime(session.session_time, templateData.timeFormat) : ''} • ${session.projects?.name || 'Project'}
            </div>
            ${templateData.baseUrl ? `
              <a href="${templateData.baseUrl}/sessions" style="color: #dc2626; text-decoration: underline; font-size: 14px;">
                Reschedule this session →
              </a>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `);
  }

  // Overdue Reminders section
  if (overdueReminders.length > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #dc2626; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          ⏰ Overdue Reminders (${overdueReminders.length}) - Action Needed
        </h2>
        ${overdueReminders.slice(0, 3).map(reminder => `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #dc2626;">${reminder.content}</div>
            <div style="color: #7f1d1d; font-size: 14px; margin-top: 4px;">
              Due: ${formatDate(reminder.reminder_date, templateData.dateFormat)} • ${reminder.leads?.name || reminder.projects?.name || 'No Project/Lead'}
            </div>
            ${reminder.leads?.email ? `<div style="color: #7f1d1d; font-size: 13px;">📧 ${reminder.leads.email}</div>` : ''}
            ${reminder.leads?.phone ? `<div style="color: #7f1d1d; font-size: 13px;">📞 ${reminder.leads.phone}</div>` : ''}
            ${templateData.baseUrl ? `
              <a href="${templateData.baseUrl}/reminders" style="color: #dc2626; text-decoration: underline; font-size: 14px;">
                Mark as complete →
              </a>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `);
  }

  // Upcoming Reminders section - TODAY's reminders  
  if (upcomingReminders.length > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #f59e0b; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          🔔 Today's Reminders (${upcomingReminders.length})
        </h2>
        ${upcomingReminders.slice(0, 5).map(reminder => `
          <div style="background: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #92400e;">${reminder.content}</div>
            <div style="color: #78350f; font-size: 14px; margin-top: 4px;">
              Due: ${formatDate(reminder.reminder_date, templateData.dateFormat)} • ${reminder.leads?.name || reminder.projects?.name || 'No Project/Lead'}
            </div>
            ${reminder.leads?.email ? `<div style="color: #78350f; font-size: 13px;">📧 ${reminder.leads.email}</div>` : ''}
            ${reminder.leads?.phone ? `<div style="color: #78350f; font-size: 13px;">📞 ${reminder.leads.phone}</div>` : ''}
            ${templateData.baseUrl ? `
              <a href="${templateData.baseUrl}/reminders" style="color: #92400e; text-decoration: underline; font-size: 14px;">
                View reminder →
              </a>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `);
  }

  // Pending Tasks section
  if (pendingTodos.length > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #3b82f6; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          📋 Pending Tasks (${pendingTodos.length})
        </h2>
        ${pendingTodos.slice(0, 5).map(todo => `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #1e40af;">${todo.content}</div>
            <div style="color: #1e3a8a; font-size: 14px; margin-top: 4px;">
              Project: ${todo.projects?.name || 'Unknown'}
            </div>
          </div>
        `).join('')}
        ${pendingTodos.length > 5 ? `
          <div style="color: #6b7280; font-size: 14px; font-style: italic;">
            ... and ${pendingTodos.length - 5} more tasks
          </div>
        ` : ''}
      </div>
    `);
  }

  // No activity message
  if (sections.length === 0) {
    sections.push(`
      <div style="text-align: center; padding: 48px 24px; background: #f9fafb; border-radius: 12px; margin-bottom: 32px;">
        <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
        <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 8px;">All Caught Up!</h2>
        <p style="color: #6b7280; font-size: 16px;">No urgent tasks or overdue items today. Great work!</p>
      </div>
    `);
  }

  // Quick actions section with big CTA
  if (templateData.baseUrl) {
    sections.push(`
      <div style="margin-top: 32px; padding: 24px; background: #f3f4f6; border-radius: 12px;">
        <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin-bottom: 16px;">Quick Actions</h3>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px;">
          <a href="${templateData.baseUrl}/" style="background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin-right: 16px;">📊 Dashboard</a>
          <a href="${templateData.baseUrl}/sessions" style="background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin-right: 16px;">📸 Sessions</a>
          <a href="${templateData.baseUrl}/projects" style="background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">📁 Projects</a>
        </div>
        
        <!-- Big CTA Button like Pipedrive -->
        <div style="text-align: center; margin-top: 24px;">
          <a href="${templateData.baseUrl}/" style="
            display: inline-block;
            background: ${templateData.brandColor || '#1EB29F'};
            color: white !important;
            text-decoration: none !important;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            box-shadow: 0 4px 12px rgba(30, 178, 159, 0.3);
          ">
            🚀 Open Lumiso
          </a>
        </div>
        
        <!-- Manage notifications link -->
        <div style="text-align: center; margin-top: 16px;">
          <a href="${templateData.baseUrl}/settings/notifications" style="color: #6b7280; text-decoration: none; font-size: 14px;">
            ⚙️ Manage email notifications
          </a>
        </div>
      </div>
    `);
  }

  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1f2937; font-size: 24px; font-weight: bold; margin-bottom: 24px;">
        📊 Daily Summary - ${today}
      </h1>
      
      ${sections.join('')}
      
      <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px;">
        <p>Have a productive day! 🚀</p>
      </div>
    </div>
  `;

  return createEmailTemplate(
    `Daily Summary - ${today}`,
    content,
    templateData
  );
}