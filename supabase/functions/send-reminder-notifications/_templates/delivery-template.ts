import { createEmailTemplate, EmailTemplateData } from './email-base.ts';

interface Project {
  id: string;
  name: string;
  created_at: string;
  leads?: {
    name: string;
    email: string;
  };
}

export function generateDeliveryEmail(
  pendingDeliveries: Project[],
  templateData: EmailTemplateData
): string {
  const baseUrl = templateData.baseUrl || '';
  
  const content = `
    <div class="summary-stats">
      <div class="stat-number">${pendingDeliveries.length}</div>
      <div class="stat-label">Projects Ready for Delivery Follow-up</div>
    </div>
    
    <p>The following projects might need delivery follow-up:</p>
    
    <h2 class="section-title">📦 Projects Ready for Delivery</h2>
    
    ${pendingDeliveries.map(project => {
      const createdDate = new Date(project.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const daysSince = Math.floor((Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      return `
        <div class="item-card">
          <div class="item-title">${project.name}</div>
          <div class="item-meta">
            👤 <strong>Client:</strong> ${project.leads?.name || 'N/A'}
            ${project.leads?.email ? `<br>📧 ${project.leads.email}` : ''}
            <br>📅 <strong>Created:</strong> ${createdDate} (${daysSince} days ago)
          </div>
          <div style="margin-top: 12px;">
            ${daysSince > 14 ? `
              <span class="overdue-badge">Needs attention</span>
            ` : `
              <span style="background-color: #FEF3C7; color: #92400E; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">Ready for delivery</span>
            `}
            ${baseUrl ? `
              <a href="${baseUrl}/projects/${project.id}" class="item-action" style="margin-left: 8px;">View Project →</a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('')}
    
    <p style="margin-top: 32px; color: #374151;">
      Consider following up on the delivery status of these projects. Timely delivery and communication helps build strong client relationships and encourages referrals.
    </p>
    
    ${baseUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${baseUrl}/projects" class="cta-button">View All Projects</a>
      </div>
    ` : ''}
  `;
  
  return createEmailTemplate(
    `Delivery Follow-up - ${pendingDeliveries.length} project(s) to review`,
    content,
    templateData
  );
}