import { createEmailTemplate, EmailTemplateData } from './enhanced-email-base.ts';
import { WeeklyStats } from './weekly-recap-template.ts';

export function generateWeeklyRecapEmailSimplified(
  stats: WeeklyStats,
  agingProjects: any[],
  templateData: EmailTemplateData
): string {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date();
  
  const weekRange = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
  
  // Generate content sections
  let sections = [];

  // Key metrics section
  sections.push(`
    <div style="margin-bottom: 32px;">
      <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 20px;">
        📈 This Week's Performance
      </h2>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #059669;">${stats.leadsAdded}</div>
          <div style="color: #065f46; font-size: 14px;">New Leads</div>
        </div>
        
        <div style="background: ${stats.leadsLost > 0 ? '#fef2f2' : '#f3f4f6'}; border: 1px solid ${stats.leadsLost > 0 ? '#fecaca' : '#d1d5db'}; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${stats.leadsLost > 0 ? '#dc2626' : '#6b7280'};">${stats.leadsLost}</div>
          <div style="color: ${stats.leadsLost > 0 ? '#7f1d1d' : '#4b5563'}; font-size: 14px;">Leads Lost</div>
        </div>
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${stats.projectsCreated}</div>
          <div style="color: #1e40af; font-size: 14px;">Projects Started</div>
        </div>
        
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #0284c7;">${stats.sessionsCompleted}</div>
          <div style="color: #0c4a6e; font-size: 14px;">Sessions Completed</div>
        </div>
      </div>
    </div>
  `);

  // Lead conversion health
  const conversionRate = stats.leadsAdded > 0 ? Math.round((stats.leadsConverted / stats.leadsAdded) * 100) : 0;
  const lossRate = stats.leadsAdded > 0 ? Math.round((stats.leadsLost / stats.leadsAdded) * 100) : 0;
  
  sections.push(`
    <div style="margin-bottom: 32px;">
      <h2 style="color: #1f2937; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
        🎯 Lead Conversion Health
      </h2>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #374151; font-weight: 500;">Conversion Rate</span>
            <span style="color: #059669; font-weight: 600;">${conversionRate}%</span>
          </div>
          <div style="background: #e5e7eb; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="background: #10b981; height: 100%; width: ${conversionRate}%; transition: width 0.3s ease;"></div>
          </div>
        </div>
        
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #374151; font-weight: 500;">Loss Rate</span>
            <span style="color: ${lossRate > 30 ? '#dc2626' : '#6b7280'}; font-weight: 600;">${lossRate}%</span>
          </div>
          <div style="background: #e5e7eb; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="background: ${lossRate > 30 ? '#ef4444' : '#94a3b8'}; height: 100%; width: ${lossRate}%; transition: width 0.3s ease;"></div>
          </div>
        </div>
      </div>
    </div>
  `);

  // Session activity
  if (stats.sessionsCompleted > 0 || stats.sessionsScheduled > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          📸 Session Activity
        </h2>
        
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #374151;">Sessions Completed:</span>
            <span style="color: #059669; font-weight: 600;">${stats.sessionsCompleted}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #374151;">Sessions Scheduled (upcoming):</span>
            <span style="color: #2563eb; font-weight: 600;">${stats.sessionsScheduled}</span>
          </div>
          ${stats.sessionsCompleted > 0 ? `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              <div style="color: #059669; font-size: 14px;">
                🎉 Great job completing ${stats.sessionsCompleted} session${stats.sessionsCompleted === 1 ? '' : 's'} this week!
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Aging projects alert
  if (agingProjects.length > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #dc2626; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          ⚠️ Projects Needing Attention (${agingProjects.length})
        </h2>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px;">
          <p style="color: #7f1d1d; margin-bottom: 16px;">
            These projects have been in active status for over 30 days:
          </p>
          
          ${agingProjects.slice(0, 5).map(project => {
            const daysOld = Math.floor((Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return `
              <div style="background: white; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                <div style="font-weight: 600; color: #dc2626;">${project.name}</div>
                <div style="color: #7f1d1d; font-size: 14px;">${daysOld} days in active status</div>
              </div>
            `;
          }).join('')}
          
          ${agingProjects.length > 5 ? `
            <div style="color: #7f1d1d; font-size: 14px; margin-top: 8px;">
              ... and ${agingProjects.length - 5} more aging projects
            </div>
          ` : ''}
          
          ${templateData.baseUrl ? `
            <div style="margin-top: 16px;">
              <a href="${templateData.baseUrl}/projects" style="color: #dc2626; text-decoration: underline; font-weight: 500;">
                Review and update project statuses →
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Revenue summary
  if (stats.totalRevenue > 0) {
    sections.push(`
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          💰 Revenue Summary
        </h2>
        
        <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 20px; text-align: center;">
          <div style="font-size: 32px; font-weight: bold; color: #059669; margin-bottom: 8px;">
            $${stats.totalRevenue.toLocaleString()}
          </div>
          <div style="color: #065f46; font-size: 16px;">
            Total project value started this week
          </div>
        </div>
      </div>
    `);
  }

  // Quick actions
  if (templateData.baseUrl) {
    sections.push(`
      <div style="margin-top: 32px; padding: 24px; background: #f3f4f6; border-radius: 12px;">
        <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin-bottom: 16px;">Owner Dashboard</h3>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <a href="${templateData.baseUrl}/analytics" style="background: ${templateData.brandColor}; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">📊 Analytics</a>
          <a href="${templateData.baseUrl}/leads" style="background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">👥 Leads</a>
          <a href="${templateData.baseUrl}/projects" style="background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">📁 Projects</a>
        </div>
      </div>
    `);
  }

  const content = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1f2937; font-size: 24px; font-weight: bold; margin-bottom: 8px;">
        📈 Weekly Business Recap
      </h1>
      <p style="color: #6b7280; font-size: 16px; margin-bottom: 32px;">
        ${weekRange}
      </p>
      
      ${sections.join('')}
      
      <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px;">
        <p>Keep up the excellent work! 🌟</p>
        <p style="margin-top: 8px;">This recap is sent weekly to organization owners only.</p>
      </div>
    </div>
  `;

  return createEmailTemplate(
    `Weekly Business Recap - ${weekRange}`,
    content,
    templateData
  );
}