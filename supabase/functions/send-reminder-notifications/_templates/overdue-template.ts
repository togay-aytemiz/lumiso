import { createEmailTemplate, EmailTemplateData } from './email-base.ts';

interface OverdueItem {
  id: string;
  name: string;
  due_date?: string;
  content?: string;
  reminder_date?: string;
}

interface OverdueItems {
  leads: OverdueItem[];
  activities: OverdueItem[];
}

export function generateOverdueEmail(
  overdueItems: OverdueItems,
  templateData: EmailTemplateData
): string {
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  const baseUrl = templateData.baseUrl || '';
  
  const content = `
    <div class="summary-stats">
      <div class="stat-number">${totalOverdue}</div>
      <div class="stat-label">Overdue Items Need Your Attention</div>
    </div>
    
    <p>You have the following overdue items that need your attention:</p>
    
    ${overdueItems.leads.length > 0 ? `
      <h2 class="section-title">📋 Overdue Leads</h2>
      ${overdueItems.leads.map(lead => `
        <div class="item-card">
          <div class="item-title">${lead.name}</div>
          <div class="item-meta">
            <span class="overdue-badge">Due: ${lead.due_date}</span>
          </div>
          ${baseUrl ? `
            <a href="${baseUrl}/leads/${lead.id}" class="item-action">View Lead →</a>
          ` : ''}
        </div>
      `).join('')}
    ` : ''}
    
    ${overdueItems.activities.length > 0 ? `
      <h2 class="section-title">⚡ Overdue Activities</h2>
      ${overdueItems.activities.map(activity => `
        <div class="item-card">
          <div class="item-title">${activity.content}</div>
          <div class="item-meta">
            <span class="overdue-badge">Due: ${activity.reminder_date}</span>
          </div>
        </div>
      `).join('')}
    ` : ''}
    
    <p style="margin-top: 32px; color: #374151;">
      Please review and update these items when you have a chance. Staying on top of your leads and activities helps maintain excellent client relationships.
    </p>
    
    ${baseUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${baseUrl}" class="cta-button">Open Your Dashboard</a>
      </div>
    ` : ''}
  `;
  
  return createEmailTemplate(
    `Overdue Items - ${totalOverdue} item(s) need attention`,
    content,
    templateData
  );
}