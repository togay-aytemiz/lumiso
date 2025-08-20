import { createEmailTemplate, EmailTemplateData, Lead, Project, Session, formatDate, formatDateTime } from './enhanced-email-base.ts';

export interface WeeklyStats {
  leadsAdded: number;
  leadsConverted: number;
  leadsLost: number;
  projectsCreated: number;
  projectsCompleted: number;
  sessionsCompleted: number;
  sessionsScheduled: number;
  totalRevenue: number;
  recentLeads: Lead[];
  recentProjects: Project[];
  upcomingSessions: Session[];
}

export function generateWeeklyRecapEmail(stats: WeeklyStats, templateData: EmailTemplateData): string {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartFormatted = formatDate(weekStart.toISOString(), templateData.dateFormat);
  const todayFormatted = formatDate(new Date().toISOString(), templateData.dateFormat);

  let content = `
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-number">${stats.leadsAdded}</span>
        <div class="stat-label">New Leads</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${stats.projectsCreated}</span>
        <div class="stat-label">New Projects</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${stats.sessionsCompleted}</span>
        <div class="stat-label">Sessions Completed</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">$${stats.totalRevenue.toLocaleString()}</span>
        <div class="stat-label">Revenue Generated</div>
      </div>
    </div>
    
    <p>Here's your weekly photography business recap from <strong>${weekStartFormatted}</strong> to <strong>${todayFormatted}</strong>:</p>
  `;

  // Lead Performance
  content += `
    <h3 class="section-title">📈 Lead Performance This Week</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px;">
      <div style="background-color: #F0FDF4; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #22C55E;">${stats.leadsAdded}</div>
        <div style="font-size: 14px; color: #059669;">New Leads Added</div>
      </div>
      <div style="background-color: #EFF6FF; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #3B82F6;">${stats.leadsConverted}</div>
        <div style="font-size: 14px; color: #1D4ED8;">Leads Converted</div>
      </div>
      <div style="background-color: #FEF2F2; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #EF4444;">${stats.leadsLost}</div>
        <div style="font-size: 14px; color: #DC2626;">Leads Lost</div>
      </div>
    </div>
  `;

  // Conversion Rate
  const conversionRate = stats.leadsAdded > 0 ? ((stats.leadsConverted / stats.leadsAdded) * 100).toFixed(1) : '0';
  content += `
    <div style="background-color: #FFFBEB; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <div style="font-size: 18px; font-weight: 600; color: #92400E; margin-bottom: 8px;">
        📊 Conversion Rate: ${conversionRate}%
      </div>
      <div style="font-size: 14px; color: #B45309;">
        ${stats.leadsConverted} out of ${stats.leadsAdded} new leads converted to projects this week.
      </div>
    </div>
  `;

  // Recent Leads
  if (stats.recentLeads.length > 0) {
    content += `
      <h3 class="section-title">🎯 Recent Leads (${stats.recentLeads.length})</h3>
    `;

    stats.recentLeads.slice(0, 5).forEach(lead => {
      content += `
        <div class="item-card">
          <div class="item-title">
            <span>${lead.name}</span>
            <span class="upcoming-badge">${lead.status || 'New'}</span>
          </div>
          ${lead.email ? `<div class="item-meta">📧 ${lead.email}</div>` : ''}
          ${lead.phone ? `<div class="item-meta">📞 ${lead.phone}</div>` : ''}
          <div style="margin-top: 12px;">
            ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads/${lead.id}" class="item-action">View Lead</a>` : ''}
          </div>
        </div>
      `;
    });
  }

  // Project Updates
  content += `
    <h3 class="section-title">🎨 Project Updates</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px;">
      <div style="background-color: #F0F9FF; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #0EA5E9;">${stats.projectsCreated}</div>
        <div style="font-size: 14px; color: #0284C7;">New Projects</div>
      </div>
      <div style="background-color: #F0FDF4; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #22C55E;">${stats.projectsCompleted}</div>
        <div style="font-size: 14px; color: #059669;">Projects Completed</div>
      </div>
    </div>
  `;

  // Session Activity
  content += `
    <h3 class="section-title">📸 Session Activity</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px;">
      <div style="background-color: #F3E8FF; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #9333EA;">${stats.sessionsCompleted}</div>
        <div style="font-size: 14px; color: #7C3AED;">Sessions Completed</div>
      </div>
      <div style="background-color: #FEF3C7; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #F59E0B;">${stats.sessionsScheduled}</div>
        <div style="font-size: 14px; color: #D97706;">Sessions Scheduled</div>
      </div>
    </div>
  `;

  // Upcoming Sessions Preview
  if (stats.upcomingSessions.length > 0) {
    content += `
      <h3 class="section-title">📅 Next Week's Sessions Preview (${stats.upcomingSessions.length})</h3>
    `;

    stats.upcomingSessions.slice(0, 3).forEach(session => {
      const sessionTime = formatDateTime(session.session_date, session.session_time, templateData);
      content += `
        <div class="item-card">
          <div class="item-title">
            <span>Photography Session</span>
            <span class="upcoming-badge">Upcoming</span>
          </div>
          <div class="item-meta">📅 ${sessionTime}</div>
          ${session.leads ? `<div class="item-meta">👤 Client: ${session.leads.name}</div>` : ''}
          ${session.projects ? `<div class="item-relationship">Project: ${session.projects.name}</div>` : ''}
        </div>
      `;
    });

    if (stats.upcomingSessions.length > 3) {
      content += `
        <p style="font-style: italic; color: #6B7280;">
          ... and ${stats.upcomingSessions.length - 3} more sessions next week
        </p>
      `;
    }
  }

  // Revenue Summary
  if (stats.totalRevenue > 0) {
    content += `
      <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22C55E;">
        <div style="font-size: 20px; font-weight: 600; color: #059669; margin-bottom: 8px;">
          💰 Revenue This Week: $${stats.totalRevenue.toLocaleString()}
        </div>
        <div style="font-size: 14px; color: #065F46;">
          Great work! Your photography business generated $${stats.totalRevenue.toLocaleString()} in revenue this week.
        </div>
      </div>
    `;
  }

  // Action Items and Goals
  content += `
    <div class="inline-buttons">
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/dashboard" class="cta-button">Dashboard</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/leads" class="cta-button">Manage Leads</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/projects" class="cta-button">View Projects</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/analytics" class="cta-button">Analytics</a>` : ''}
    </div>
  `;

  // Weekly Insights
  let insights = [];
  if (stats.leadsAdded > stats.leadsConverted && stats.leadsConverted > 0) {
    insights.push("Consider following up with unconverted leads - they might just need a little more nurturing.");
  }
  if (stats.sessionsCompleted > 0) {
    insights.push("Great job completing sessions this week! Don't forget to follow up with delivery timelines.");
  }
  if (stats.projectsCreated > stats.projectsCompleted) {
    insights.push("You have new projects in the pipeline - make sure to plan your workflow efficiently.");
  }
  if (parseFloat(conversionRate) > 20) {
    insights.push("Excellent conversion rate! Your lead qualification process is working well.");
  }

  if (insights.length > 0) {
    content += `
      <div style="margin-top: 24px; padding: 20px; background-color: #EFF6FF; border-radius: 8px; border-left: 4px solid #3B82F6;">
        <div style="font-size: 16px; font-weight: 600; color: #1E40AF; margin-bottom: 12px;">
          💡 Weekly Insights
        </div>
        <ul style="margin: 0; padding-left: 20px; color: #1E3A8A;">
          ${insights.map(insight => `<li style="margin-bottom: 8px;">${insight}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Motivational close
  const motivationalMessages = [
    "Keep up the amazing work! Your dedication to your craft shows in these results. 🌟",
    "Another successful week in the books! Your photography business is thriving. 📸",
    "Progress is progress, no matter how small. Every week brings new opportunities! 🚀",
    "Your passion for photography is building a successful business. Keep going! 💪",
    "Each client you serve and each photo you take is building your legacy. Amazing work! ✨"
  ];
  const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

  content += `
    <div style="margin-top: 24px; padding: 16px; background-color: #F8FAFC; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-style: italic; color: #475569; font-size: 16px;">
        ${randomMessage}
      </p>
    </div>
  `;

  return createEmailTemplate(
    `Weekly Business Recap - ${weekStartFormatted} to ${todayFormatted}`,
    content,
    templateData
  );
}