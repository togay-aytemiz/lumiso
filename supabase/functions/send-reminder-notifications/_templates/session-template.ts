import { createEmailTemplate, EmailTemplateData } from './email-base.ts';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  leads?: {
    name: string;
    email: string;
  };
}

export function generateSessionEmail(
  upcomingSessions: Session[],
  templateData: EmailTemplateData
): string {
  const baseUrl = templateData.baseUrl || '';
  
  const content = `
    <div class="summary-stats">
      <div class="stat-number">${upcomingSessions.length}</div>
      <div class="stat-label">Upcoming Sessions</div>
    </div>
    
    <p>You have the following sessions coming up:</p>
    
    <h2 class="section-title">📸 Upcoming Sessions</h2>
    
    ${upcomingSessions.map(session => {
      const sessionDate = new Date(session.session_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      return `
        <div class="item-card">
          <div class="item-title">${session.leads?.name || 'Session'}</div>
          <div class="item-meta">
            📅 <strong>${sessionDate}</strong> at <strong>${session.session_time}</strong>
            ${session.leads?.email ? `<br>📧 ${session.leads.email}` : ''}
          </div>
          ${session.notes ? `
            <div style="margin: 8px 0; padding: 8px; background-color: #FFFBEB; border-left: 3px solid #F59E0B; font-size: 14px;">
              <strong>Notes:</strong> ${session.notes}
            </div>
          ` : ''}
          <div style="margin-top: 12px;">
            <span class="upcoming-badge">Upcoming</span>
            ${baseUrl ? `
              <a href="${baseUrl}/sessions/${session.id}" class="item-action" style="margin-left: 8px;">View Session →</a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('')}
    
    <p style="margin-top: 32px; color: #374151;">
      Make sure you're prepared for these sessions! Double-check your equipment, location details, and client preferences.
    </p>
    
    ${baseUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${baseUrl}/sessions" class="cta-button">View All Sessions</a>
      </div>
    ` : ''}
  `;
  
  return createEmailTemplate(
    `Upcoming Sessions - ${upcomingSessions.length} session(s) scheduled`,
    content,
    templateData
  );
}