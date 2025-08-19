import { createEmailTemplate, EmailTemplateData } from './email-base.ts';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  leads?: {
    name: string;
    email: string;
  };
}

interface Todo {
  id: string;
  content: string;
  created_at: string;
}

interface OverdueItems {
  leads: Array<{ id: string; name: string; due_date: string }>;
  activities: Array<{ id: string; content: string; reminder_date: string }>;
}

export function generateDailySummaryEmail(
  upcomingSessions: Session[],
  pendingTodos: Todo[],
  overdueItems: OverdueItems,
  templateData: EmailTemplateData
): string {
  const baseUrl = templateData.baseUrl || '';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #374151; margin-bottom: 8px;">Daily Summary for ${today}</h2>
      <p style="color: #6B7280; margin: 0;">Here's what's on your agenda today</p>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin: 32px 0;">
      <div class="summary-stats">
        <div class="stat-number">${upcomingSessions.length}</div>
        <div class="stat-label">Today's Sessions</div>
      </div>
      <div class="summary-stats">
        <div class="stat-number">${pendingTodos.length}</div>
        <div class="stat-label">Pending Todos</div>
      </div>
      ${totalOverdue > 0 ? `
        <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #DC2626;">${totalOverdue}</div>
          <div style="font-size: 14px; color: #991B1B; margin-top: 4px;">Overdue Items</div>
        </div>
      ` : ''}
    </div>
    
    ${upcomingSessions.length > 0 ? `
      <h2 class="section-title">📸 Today's Sessions</h2>
      ${upcomingSessions.map(session => `
        <div class="item-card">
          <div class="item-title">${session.leads?.name || 'Session'}</div>
          <div class="item-meta">
            🕐 <strong>${session.session_time}</strong>
            ${session.leads?.email ? `<br>📧 ${session.leads.email}` : ''}
          </div>
          ${baseUrl ? `
            <a href="${baseUrl}/sessions/${session.id}" class="item-action">View Session →</a>
          ` : ''}
        </div>
      `).join('')}
    ` : `
      <div style="text-align: center; padding: 32px; color: #6B7280;">
        <p>🎉 No sessions scheduled for today - enjoy your free time!</p>
      </div>
    `}
    
    ${pendingTodos.length > 0 ? `
      <h2 class="section-title">✅ Pending Todos</h2>
      ${pendingTodos.slice(0, 5).map(todo => `
        <div class="item-card">
          <div class="item-title">${todo.content}</div>
        </div>
      `).join('')}
      ${pendingTodos.length > 5 ? `
        <p style="text-align: center; color: #6B7280; font-style: italic;">
          ...and ${pendingTodos.length - 5} more todos
        </p>
      ` : ''}
    ` : `
      <div style="text-align: center; padding: 32px; color: #6B7280;">
        <p>✨ All caught up on todos - great job!</p>
      </div>
    `}
    
    ${totalOverdue > 0 ? `
      <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #DC2626; margin-top: 0;">⚠️ Overdue Items (${totalOverdue})</h3>
        <p style="color: #991B1B; margin-bottom: 16px;">You have overdue items that need attention!</p>
        ${baseUrl ? `
          <a href="${baseUrl}" style="background-color: #DC2626; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: 500;">Review Overdue Items</a>
        ` : ''}
      </div>
    ` : ''}
    
    <p style="margin-top: 32px; color: #374151; text-align: center;">
      Have a productive day! 🚀
    </p>
    
    ${baseUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${baseUrl}" class="cta-button">Open Your Dashboard</a>
      </div>
    ` : ''}
  `;
  
  return createEmailTemplate(
    `Daily Summary - ${today}`,
    content,
    templateData
  );
}