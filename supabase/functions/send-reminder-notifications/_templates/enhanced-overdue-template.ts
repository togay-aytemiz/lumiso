import { createEmailTemplate, EmailTemplateData, Lead, Activity, formatDate, daysBetween } from './enhanced-email-base.ts';

interface OverdueItems {
  leads: Lead[];
  activities: Activity[];
}

export function generateOverdueEmail(overdueItems: OverdueItems, templateData: EmailTemplateData): string {
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  
  let content = `
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-number">${totalOverdue}</span>
        <div class="stat-label">Total Overdue Items</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${overdueItems.leads.length}</span>
        <div class="stat-label">Overdue Leads</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${overdueItems.activities.length}</span>
        <div class="stat-label">Overdue Activities</div>
      </div>
    </div>
    
    <p>You have <strong>${totalOverdue} overdue item${totalOverdue === 1 ? '' : 's'}</strong> that need your immediate attention:</p>
  `;

  if (overdueItems.leads.length > 0) {
    content += `
      <h3 class="section-title">📋 Overdue Leads (${overdueItems.leads.length})</h3>
    `;

    overdueItems.leads.forEach(lead => {
      const daysOverdue = lead.due_date ? daysBetween(lead.due_date) : 0;
      const urgencyClass = daysOverdue > 7 ? 'high-priority' : daysOverdue > 3 ? 'medium-priority' : 'low-priority';
      
      content += `
        <div class="item-card ${urgencyClass}">
          <div class="item-title">
            <span>${lead.name}</span>
            <span class="overdue-badge">${daysOverdue} days overdue</span>
          </div>
          ${lead.email ? `<div class="item-meta">📧 ${lead.email}</div>` : ''}
          ${lead.phone ? `<div class="item-meta">📞 ${lead.phone}</div>` : ''}
          ${lead.due_date ? `<div class="item-meta">📅 Due: ${formatDate(lead.due_date, templateData.dateFormat)}</div>` : ''}
          ${lead.status ? `<div class="item-meta">Status: ${lead.status}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads/${lead.id}" class="item-action">View Lead</a>` : ''}
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads/${lead.id}?action=edit" class="item-action">Update Status</a>` : ''}
          </div>
        </div>
      `;
    });
  }

  if (overdueItems.activities.length > 0) {
    content += `
      <h3 class="section-title">⚡ Overdue Activities (${overdueItems.activities.length})</h3>
    `;

    overdueItems.activities.forEach(activity => {
      const daysOverdue = activity.reminder_date ? daysBetween(activity.reminder_date) : 0;
      const urgencyClass = daysOverdue > 7 ? 'high-priority' : daysOverdue > 3 ? 'medium-priority' : 'low-priority';
      
      content += `
        <div class="item-card ${urgencyClass}">
          <div class="item-title">
            <span>${activity.content}</span>
            <span class="overdue-badge">${daysOverdue} days overdue</span>
          </div>
          <div class="item-meta">Type: ${activity.type}</div>
          ${activity.reminder_date ? `<div class="item-meta">📅 Due: ${formatDate(activity.reminder_date, templateData.dateFormat)}</div>` : ''}
          ${activity.leads ? `<div class="item-relationship">Related to lead: ${activity.leads.name}</div>` : ''}
          ${activity.projects ? `<div class="item-relationship">Related to project: ${activity.projects.name}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl && activity.leads ? `<a href="${templateData.baseUrl}/leads/${activity.leads.name}" class="item-action">View Lead</a>` : ''}
            ${templateData.baseUrl && activity.projects ? `<a href="${templateData.baseUrl}/projects/${activity.projects.id}" class="item-action">View Project</a>` : ''}
          </div>
        </div>
      `;
    });
  }

  content += `
    <div style="margin-top: 32px; text-align: center;">
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/dashboard" class="cta-button">Go to Dashboard</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads" class="cta-button">Manage All Leads</a>` : ''}
    </div>
    
    <p style="margin-top: 24px; font-size: 14px; color: #6B7280;">
      <strong>💡 Tip:</strong> Regular follow-ups are crucial for converting leads into clients. 
      Consider setting shorter reminder intervals for high-priority leads.
    </p>
  `;

  return createEmailTemplate(
    `${totalOverdue} Overdue Items Need Attention`,
    content,
    templateData
  );
}