import { createEmailTemplate, EmailTemplateData, Session, Todo, Activity, Lead, formatDateTime, formatDate, formatTime } from './enhanced-email-base.ts';

interface OverdueItems {
  leads: Lead[];
  activities: Activity[];
}

export function generateDailySummaryEmail(
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
  
  let content = `
    <p>Here's your daily summary for <strong>${today}</strong>:</p>
    
    
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-number">${upcomingSessions.length}</span>
        <div class="stat-label">Today's Sessions</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${totalTodayReminders}</span>
        <div class="stat-label">Today's Reminders</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${totalOverdue}</span>
        <div class="stat-label">Overdue Items</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${totalPastSessions}</span>
        <div class="stat-label">Past Sessions</div>
      </div>
    </div>
  `;

  // Today's Sessions
  if (upcomingSessions.length > 0) {
    content += `
      <h3 class="section-title">📸 Today's Sessions (${upcomingSessions.length})</h3>
    `;

    upcomingSessions.forEach(session => {
      const sessionTime = formatDateTime(session.session_date, session.session_time, templateData);
    // Use project type name as session name, fallback to generic name
    const sessionName = session.projects?.project_types?.name 
      ? `${session.projects.project_types.name} Session`
      : (session.notes || 'Photography Session');
      
      content += `
        <div class="item-card">
          <div class="item-title">
            <span>${sessionName}</span>
            <span class="upcoming-badge">Today</span>
          </div>
          <div class="item-meta">⏰ ${sessionTime}</div>
          ${session.leads ? `<div class="item-meta">👤 Client: ${session.leads.name}</div>` : ''}
          ${session.projects ? `<div class="item-relationship">📋 Project: ${session.projects.name}</div>` : ''}
          ${session.location ? `<div class="item-meta">📍 ${session.location}</div>` : ''}
          ${session.notes ? `<div class="item-meta">📝 ${session.notes}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions/${session.id}" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">View Details →</a>` : ''}
          </div>
        </div>
      `;
    });
  }

  // Today's Reminders
  if (todayReminders.length > 0) {
    content += `
      <h3 class="section-title">⏰ Today's Reminders (${todayReminders.length})</h3>
    `;

    todayReminders.forEach(reminder => {
      content += `
        <div class="item-card">
          <div class="item-title">
            <span>${reminder.content}</span>
          </div>
          <div class="item-meta">📅 ${formatDate(reminder.reminder_date, templateData.dateFormat)} ${reminder.reminder_time ? `at ${formatTime(reminder.reminder_time, templateData.timeFormat)}` : ''}</div>
          ${reminder.leads ? `<div class="item-meta">👤 Client: ${reminder.leads.name}</div>` : ''}
          ${reminder.projects ? `<div class="item-relationship">📋 Project: ${reminder.projects.name}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/reminders" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">View Reminders →</a>` : ''}
          </div>
        </div>
      `;
    });
  }

  // Overdue Items (simplified one line)
  if (totalOverdue > 0) {
    content += `
      <div style="padding: 16px; background-color: #FEF2F2; border-radius: 8px; border-left: 4px solid #EF4444; margin: 20px 0;">
        <p style="margin: 0; color: #DC2626; font-weight: 500;">
          🚨 You have <strong>${totalOverdue}</strong> overdue item${totalOverdue > 1 ? 's' : ''} that need attention.
          ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/reminders" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 600; margin-left: 8px; padding: 6px 12px; background: rgba(30,178,159,0.1); border-radius: 4px;">View Reminders →</a>` : ''}
        </p>
      </div>
    `;
  }

  // Past Sessions (simplified one line)
  if (totalPastSessions > 0) {
    content += `
      <div style="padding: 16px; background-color: #FEF7ED; border-radius: 8px; border-left: 4px solid #F59E0B; margin: 20px 0;">
        <p style="margin: 0; color: #D97706; font-weight: 500;">
          📋 You have <strong>${totalPastSessions}</strong> past session${totalPastSessions > 1 ? 's' : ''} that need${totalPastSessions === 1 ? 's' : ''} action.
          ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 600; margin-left: 8px; padding: 6px 12px; background: rgba(30,178,159,0.1); border-radius: 4px;">View Sessions →</a>` : ''}
        </p>
      </div>
    `;
  }

    // Quick Actions (compact buttons)
    content += `
      <div class="inline-buttons">
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}" class="cta-button">Dashboard</a>` : ''}
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads" class="cta-button">Leads</a>` : ''}
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/projects" class="cta-button">Projects</a>` : ''}
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions" class="cta-button">Sessions</a>` : ''}
      </div>
    `;

  // Motivational message
  const messages = [
    "Every great shot starts with preparation. Have an amazing day! 📸",
    "Your creativity makes every session special. Make today count! ✨",
    "Great photography is about capturing moments. Seize yours today! 🌟",
    "Behind every great photo is a dedicated photographer. That's you! 💪",
    "Turn today's sessions into tomorrow's masterpieces! 🎨"
  ];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  content += `
    <div style="margin-top: 24px; padding: 16px; background-color: #F0FDF4; border-radius: 8px; border-left: 4px solid #22C55E;">
      <p style="margin: 0; font-style: italic; color: #059669;">
        ${randomMessage}
      </p>
    </div>
  `;

  return createEmailTemplate(
    `Daily Summary - ${today}`,
    content,
    templateData
  );
}