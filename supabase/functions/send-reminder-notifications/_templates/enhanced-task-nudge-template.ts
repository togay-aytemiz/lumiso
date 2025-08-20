import { createEmailTemplate, EmailTemplateData, Todo, formatDate, daysBetween } from './enhanced-email-base.ts';

export function generateTaskNudgeEmail(oldTodos: Todo[], templateData: EmailTemplateData): string {
  let content = `
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-number">${oldTodos.length}</span>
        <div class="stat-label">Pending Tasks</div>
      </div>
    </div>
    
    <p>You have <strong>${oldTodos.length} task${oldTodos.length === 1 ? '' : 's'}</strong> that have been pending for a while and could use your attention:</p>
    
    <h3 class="section-title">📋 Tasks Waiting for Completion</h3>
  `;

  // Show up to 5 oldest tasks
  const tasksToShow = oldTodos.slice(0, 5);
  
  tasksToShow.forEach(todo => {
    const daysPending = daysBetween(todo.created_at);
    const urgencyClass = daysPending > 14 ? 'high-priority' : daysPending > 7 ? 'medium-priority' : 'low-priority';
    
    content += `
      <div class="item-card ${urgencyClass}">
        <div class="item-title">
          <span>${todo.content}</span>
          <span class="${daysPending > 7 ? 'overdue-badge' : 'upcoming-badge'}">${daysPending} days old</span>
        </div>
        ${todo.projects ? `<div class="item-relationship">Project: ${todo.projects.name}</div>` : ''}
        <div class="item-meta">📅 Created: ${formatDate(todo.created_at, templateData.dateFormat)}</div>
        <div style="margin-top: 12px;">
          ${templateData.baseUrl && todo.projects ? `<a href="${templateData.baseUrl}/projects/${todo.projects.id}" class="item-action">View Project</a>` : ''}
          ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/projects" class="item-action">Manage Tasks</a>` : ''}
        </div>
      </div>
    `;
  });

  if (oldTodos.length > 5) {
    content += `
      <p style="font-style: italic; color: #6B7280; margin-top: 16px;">
        ... and ${oldTodos.length - 5} more pending tasks waiting for your attention.
      </p>
    `;
  }

  content += `
    <div style="margin-top: 32px; text-align: center;">
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/projects" class="cta-button">View All Tasks</a>` : ''}
      ${templateData.baseUrl ? `<a href="${templateData.baseUrl}/dashboard" class="cta-button">Go to Dashboard</a>` : ''}
    </div>
    
    <div style="margin-top: 24px; padding: 16px; background-color: #FEF3C7; border-radius: 8px; border-left: 4px solid #F59E0B;">
      <p style="margin: 0; font-size: 14px; color: #92400E;">
        <strong>💡 Productivity Tip:</strong> Try the "2-minute rule" - if a task takes less than 2 minutes, do it right away. 
        For larger tasks, break them down into smaller, manageable steps.
      </p>
    </div>
    
    <p style="margin-top: 16px; font-size: 14px; color: #6B7280;">
      Completing these tasks will help keep your projects on track and your clients happy. 
      Small progress every day leads to big results! 🚀
    </p>
  `;

  return createEmailTemplate(
    `${oldTodos.length} Pending Tasks Need Your Attention`,
    content,
    templateData
  );
}