import { createEmailTemplate, EmailTemplateData, Session, Todo, Activity, Lead, formatDateTime, formatDate } from './enhanced-email-base.ts';

interface OverdueItems {
  leads: Lead[];
  activities: Activity[];
}

export function generateDailySummaryEmail(
  upcomingSessions: Session[], 
  pendingTodos: Todo[], 
  overdueItems: OverdueItems, 
  templateData: EmailTemplateData
): string {
  const today = formatDate(new Date().toISOString(), templateData.dateFormat);
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  
  let content = `
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-number">${upcomingSessions.length}</span>
        <div class="stat-label">Today's Sessions</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${pendingTodos.length}</span>
        <div class="stat-label">Pending Tasks</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${totalOverdue}</span>
        <div class="stat-label">Overdue Items</div>
      </div>
    </div>
    
    <p>Here's your daily summary for <strong>${today}</strong>:</p>
  `;

  // Today's Sessions
  if (upcomingSessions.length > 0) {
    content += `
      <h3 class="section-title">📸 Today's Photography Sessions (${upcomingSessions.length})</h3>
    `;

    upcomingSessions.forEach(session => {
      const sessionTime = formatDateTime(session.session_date, session.session_time, templateData);
      
      content += `
        <div class="item-card">
          <div class="item-title">
            <span>Photography Session</span>
            <span class="upcoming-badge">Today</span>
          </div>
          <div class="item-meta">⏰ ${sessionTime}</div>
          ${session.leads ? `<div class="item-meta">👤 Client: ${session.leads.name}</div>` : ''}
          ${session.projects ? `<div class="item-relationship">Project: ${session.projects.name}</div>` : ''}
          ${session.notes ? `<div class="item-meta">📝 ${session.notes}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions/${session.id}" class="item-action">View Details</a>` : ''}
          </div>
        </div>
      `;
    });
  }

  // Pending Tasks
  if (pendingTodos.length > 0) {
    content += `
      <h3 class="section-title">✅ Pending Tasks (${pendingTodos.length})</h3>
    `;

    // Show up to 5 most recent tasks
    const recentTodos = pendingTodos.slice(0, 5);
    
    recentTodos.forEach(todo => {
      content += `
        <div class="item-card">
          <div class="item-title">
            <span>${todo.content}</span>
          </div>
          ${todo.projects ? `<div class="item-relationship">Project: ${todo.projects.name}</div>` : ''}
          <div class="item-meta">📅 Created: ${formatDate(todo.created_at, templateData.dateFormat)}</div>
          <div style="margin-top: 12px;">
            ${templateData.baseUrl && todo.projects ? `<a href="${templateData.baseUrl}/projects/${todo.projects.id}" class="item-action">View Project</a>` : ''}
          </div>
        </div>
      `;
    });

    if (pendingTodos.length > 5) {
      content += `
        <p style="font-style: italic; color: #6B7280; margin-top: 8px;">
          ... and ${pendingTodos.length - 5} more tasks
        </p>
      `;
    }
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
              ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads/${lead.id}" class="item-action">Follow Up</a>` : ''}
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
            ${activity.projects ? `<div class="item-relationship">Project: ${activity.projects.name}</div>` : ''}
            ${activity.leads ? `<div class="item-relationship">Lead: ${activity.leads.name}</div>` : ''}
            <div style="margin-top: 12px;">
              ${templateData.baseUrl && activity.projects ? `<a href="${templateData.baseUrl}/projects/${activity.projects.id}" class="item-action">View Project</a>` : ''}
            </div>
          </div>
        `;
      });
    }
  }

  // Quick Actions
  content += `
    <div style="margin-top: 32px; text-align: center;">
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/dashboard" class="cta-button">Dashboard</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads" class="cta-button">Manage Leads</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/projects" class="cta-button">View Projects</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/calendar" class="cta-button">Calendar</a>` : ''}
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