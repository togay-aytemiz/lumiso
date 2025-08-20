import { createEmailTemplate, EmailTemplateData, Session, formatDateTime, daysBetween } from './enhanced-email-base.ts';

export function generateSessionEmail(upcomingSessions: Session[], templateData: EmailTemplateData): string {
  let content = `
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-number">${upcomingSessions.length}</span>
        <div class="stat-label">Upcoming Sessions</div>
      </div>
    </div>
    
    <p>You have <strong>${upcomingSessions.length} session${upcomingSessions.length === 1 ? '' : 's'}</strong> coming up:</p>
    
    <h3 class="section-title">📸 Upcoming Photography Sessions</h3>
  `;

  upcomingSessions.forEach(session => {
    const sessionDateTime = formatDateTime(session.session_date, session.session_time, templateData);
    const daysUntil = daysBetween(session.session_date);
    const isToday = daysUntil === 0;
    const isTomorrow = daysUntil === 1;
    
    let timeLabel = '';
    if (isToday) timeLabel = 'Today';
    else if (isTomorrow) timeLabel = 'Tomorrow';
    else timeLabel = `In ${daysUntil} days`;

    content += `
      <div class="item-card ${isToday ? 'high-priority' : isTomorrow ? 'medium-priority' : 'low-priority'}">
        <div class="item-title">
          <span>Photography Session</span>
          <span class="${isToday || isTomorrow ? 'overdue-badge' : 'upcoming-badge'}">${timeLabel}</span>
        </div>
        <div class="item-meta">📅 ${sessionDateTime}</div>
        ${session.leads ? `
          <div class="item-meta">👤 Client: ${session.leads.name}</div>
          ${session.leads.email ? `<div class="item-meta">📧 ${session.leads.email}</div>` : ''}
          ${session.leads.phone ? `<div class="item-meta">📞 ${session.leads.phone}</div>` : ''}
        ` : ''}
        ${session.projects ? `<div class="item-relationship">Part of project: ${session.projects.name}</div>` : ''}
        ${session.notes ? `<div class="item-meta">📝 ${session.notes}</div>` : ''}
        <div style="margin-top: 12px;">
          ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions/${session.id}" class="item-action">View Session</a>` : ''}
          ${templateData.baseUrl && session.projects ? `<a href="${templateData.baseUrl}/projects/${session.projects.id}" class="item-action">View Project</a>` : ''}
          ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/calendar" class="item-action">View Calendar</a>` : ''}
        </div>
      </div>
    `;
  });

  content += `
    <div style="margin-top: 32px; text-align: center;">
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/sessions" class="cta-button">Manage All Sessions</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/calendar" class="cta-button">View Calendar</a>` : ''}
    </div>
    
    <p style="margin-top: 24px; font-size: 14px; color: #6B7280;">
      <strong>💡 Preparation Tips:</strong>
    </p>
    <ul style="font-size: 14px; color: #6B7280; margin-left: 20px;">
      <li>Check your equipment and backup batteries</li>
      <li>Confirm location and timing with your client</li>
      <li>Review any special requests or shot lists</li>
      <li>Plan for weather contingencies if shooting outdoors</li>
    </ul>
  `;

  return createEmailTemplate(
    `${upcomingSessions.length} Photography Session${upcomingSessions.length === 1 ? '' : 's'} Coming Up`,
    content,
    templateData
  );
}