import { createEmailTemplate, EmailTemplateData } from './email-base.ts';

interface Todo {
  id: string;
  content: string;
  created_at: string;
}

export function generateTaskNudgeEmail(
  oldTodos: Todo[],
  templateData: EmailTemplateData
): string {
  const baseUrl = templateData.baseUrl || '';
  
  const content = `
    <div class="summary-stats">
      <div class="stat-number">${oldTodos.length}</div>
      <div class="stat-label">Pending Tasks Need Some Love</div>
    </div>
    
    <p>You have some pending tasks that have been waiting for a while:</p>
    
    <h2 class="section-title">⏰ Tasks Waiting for Attention</h2>
    
    ${oldTodos.slice(0, 5).map(todo => {
      const daysSinceCreated = Math.floor((Date.now() - new Date(todo.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      return `
        <div class="item-card">
          <div class="item-title">${todo.content}</div>
          <div class="item-meta">
            ⏱️ <strong>Created:</strong> ${daysSinceCreated} days ago
            ${daysSinceCreated > 7 ? `
              <span class="overdue-badge" style="margin-left: 8px;">Getting old</span>
            ` : `
              <span style="background-color: #FEF3C7; color: #92400E; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-left: 8px;">Could use attention</span>
            `}
          </div>
        </div>
      `;
    }).join('')}
    
    ${oldTodos.length > 5 ? `
      <div style="text-align: center; padding: 16px; background-color: #F3F4F6; border-radius: 8px; margin: 16px 0;">
        <p style="color: #6B7280; margin: 0; font-style: italic;">
          ...and ${oldTodos.length - 5} more tasks waiting for your attention
        </p>
      </div>
    ` : ''}
    
    <p style="margin-top: 32px; color: #374151;">
      Maybe it's time to tackle some of these? 💪 Even completing one or two tasks can give you a great sense of accomplishment and momentum.
    </p>
    
    <div style="background-color: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="color: #1E40AF; margin: 0; font-weight: 500;">
        💡 Pro tip: Start with the smallest task to build momentum!
      </p>
    </div>
    
    ${baseUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${baseUrl}/projects" class="cta-button">View Your Tasks</a>
      </div>
    ` : ''}
  `;
  
  return createEmailTemplate(
    `Task Nudge - ${oldTodos.length} pending task(s)`,
    content,
    templateData
  );
}