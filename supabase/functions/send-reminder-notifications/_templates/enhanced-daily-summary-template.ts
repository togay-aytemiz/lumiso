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

  // Overdue Items (if any)
  if (totalOverdue > 0) {
    content += `
      <h3 class="section-title">🚨 Overdue Items Requiring Attention (${totalOverdue})</h3>
    `;

    if (overdueItems.leads.length > 0) {
      content += `<p><strong>Overdue Leads:</strong></p>`;
      overdueItems.leads.slice(0, 3).forEach(lead => {
        content += `
          <div class="item-card high-priority">
            <div class="item-title">
              <span>${lead.name}</span>
              <span class="overdue-badge">Overdue</span>
            </div>
            ${lead.due_date ? `<div class="item-meta">📅 Due: ${formatDate(lead.due_date, templateData.dateFormat)}</div>` : ''}
            <div style="margin-top: 12px;">
              ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads/${lead.id}" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">Follow Up →</a>` : ''}
            </div>
          </div>
        `;
      });
    }

     if (overdueItems.activities.length > 0) {
       content += `<p><strong>Overdue Activities:</strong></p>`;
       overdueItems.activities.slice(0, 3).forEach(activity => {
         content += `
           <div class="item-card high-priority">
             <div class="item-title">
               <span>${activity.content}</span>
               <span class="overdue-badge">Overdue</span>
             </div>
             ${activity.reminder_date ? `<div class="item-meta">📅 Due: ${formatDate(activity.reminder_date, templateData.dateFormat)}</div>` : ''}
               <div style="margin-top: 12px;">
                 ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/reminders" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">View Reminders →</a>` : ''}
               </div>
           </div>
         `;
       });
     }

     if (overdueItems.activities.length > 3) {
       content += `
         <div style="text-align: center; margin-top: 16px;">
           <p style="color: #6B7280; margin-bottom: 12px;">
             ... and ${overdueItems.activities.length - 3} more overdue items
           </p>
           ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/reminders" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">See All Reminders →</a>` : ''}
         </div>
       `;
     }
   }

  // Past Sessions that need action
  if (totalPastSessions > 0) {
    content += `
      <h3 class="section-title">📋 Past Sessions Needing Follow-up (${totalPastSessions})</h3>
      <p>These sessions have passed and may need your attention:</p>
    `;

    pastSessions.slice(0, 3).forEach(session => {
      const daysPassed = Math.ceil((new Date().getTime() - new Date(session.session_date).getTime()) / (1000 * 60 * 60 * 24));
      const sessionName = session.projects?.project_types?.name 
        ? `${session.projects.project_types.name} Session`
        : (session.notes || 'Photography Session');
      
      content += `
        <div class="item-card medium-priority">
          <div class="item-title">
            <span>${sessionName}</span>
            <span class="overdue-badge">${daysPassed} day${daysPassed > 1 ? 's' : ''} ago</span>
          </div>
          <div class="item-meta">📅 ${formatDate(session.session_date, templateData.dateFormat)} at ${formatTime(session.session_time, templateData.timeFormat)}</div>
          ${session.leads ? `<div class="item-meta">👤 Client: ${session.leads.name}</div>` : ''}
          ${session.projects ? `<div class="item-relationship">📋 Project: ${session.projects.name}</div>` : ''}
          ${session.location ? `<div class="item-meta">📍 ${session.location}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions/${session.id}" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px; margin-right: 8px;">Update Status</a>` : ''}
            ${templateData.baseUrl && session.projects ? `<a href="${templateData.baseUrl}/projects/${session.projects.id}" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">View Project</a>` : ''}
          </div>
        </div>
      `;
    });

    if (pastSessions.length > 3) {
      content += `
        <div style="text-align: center; margin-top: 16px;">
          <p style="color: #6B7280; margin-bottom: 12px;">
            ... and ${pastSessions.length - 3} more past sessions
          </p>
          ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions" style="color: ${templateData.brandColor}; text-decoration: none; font-weight: 500; padding: 8px 16px; background: rgba(30,178,159,0.1); border-radius: 4px;">See All Sessions →</a>` : ''}
        </div>
      `;
    }
  }

    // Quick Actions
    content += `
      <div class="inline-buttons">
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}" class="cta-button">Dashboard</a>` : ''}
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads" class="cta-button">Manage Leads</a>` : ''}
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/projects" class="cta-button">View Projects</a>` : ''}
        ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions" class="cta-button">All Sessions</a>` : ''}
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