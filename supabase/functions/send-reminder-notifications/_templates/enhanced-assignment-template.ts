import { createEmailTemplate, formatDate, formatDateTime, EmailTemplateData } from './enhanced-email-base.ts';

export interface AssignmentData {
  entityType: 'lead' | 'project';
  entityId: string;
  entityName: string;
  assigneeName: string;
  assignerName: string;
  dueDate?: string;
  notes?: string;
  projectType?: string;
  status?: string;
  organizationId: string;
}

export interface AssignmentEmailData extends EmailTemplateData {
  assignmentData: AssignmentData;
}

function generateAssignmentEmailContent(data: AssignmentEmailData): string {
  const { assignmentData, user, business } = data;
  const { entityType, entityName, assigneeName, assignerName, dueDate, notes, projectType, status } = assignmentData;

  const entityTypeLabel = entityType === 'lead' ? 'Lead' : 'Project';
  const detailsUrl = `https://my.lumiso.app/${entityType === 'lead' ? 'leads' : 'projects'}/${assignmentData.entityId}`;

  return `
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${data.business?.brandColor || '#1EB29F'} 0%, ${adjustBrightness(data.business?.brandColor || '#1EB29F', -10)} 100%); padding: 40px 0; text-align: center; border-radius: 12px 12px 0 0;">
      <div style="display: inline-block; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 50%; padding: 20px; margin-bottom: 20px;">
        <div style="width: 60px; height: 60px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
          <span style="font-size: 24px; color: ${data.business?.brandColor || '#1EB29F'};">📋</span>
        </div>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        New Assignment
      </h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">
        You've been assigned to a new ${entityTypeLabel.toLowerCase()}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 40px 30px;">
      <!-- Greeting -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2d3748; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">
          Hi ${assigneeName || 'there'}! 👋
        </h2>
        <p style="color: #4a5568; margin: 0; font-size: 16px; line-height: 1.6;">
          ${assignerName} has assigned you to a new ${entityTypeLabel.toLowerCase()}.
        </p>
      </div>

      <!-- Assignment Details Card -->
      <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 12px; padding: 30px; margin-bottom: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <div style="width: 50px; height: 50px; background: ${data.business?.brandColor || '#1EB29F'}; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
            <span style="font-size: 20px; color: white;">${entityType === 'lead' ? '👤' : '📁'}</span>
          </div>
          <div style="flex: 1;">
            <h3 style="color: #2d3748; margin: 0 0 4px 0; font-size: 18px; font-weight: 600;">
              ${entityTypeLabel}: ${entityName}
            </h3>
            ${status ? `<span style="display: inline-block; background: #e2e8f0; color: #4a5568; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; text-transform: uppercase;">${status}</span>` : ''}
          </div>
        </div>

        <!-- Details Grid -->
        <div style="display: grid; gap: 16px;">
          ${assignerName !== 'System' ? `
            <div style="display: flex; align-items: center;">
              <span style="font-weight: 600; color: #4a5568; width: 120px; flex-shrink: 0;">Assigned by:</span>
              <span style="color: #2d3748;">${assignerName}</span>
            </div>
          ` : ''}
          
          ${projectType ? `
            <div style="display: flex; align-items: center;">
              <span style="font-weight: 600; color: #4a5568; width: 120px; flex-shrink: 0;">Type:</span>
              <span style="color: #2d3748;">${projectType}</span>
            </div>
          ` : ''}
          
          ${dueDate ? `
            <div style="display: flex; align-items: center;">
              <span style="font-weight: 600; color: #4a5568; width: 120px; flex-shrink: 0;">Due Date:</span>
              <span style="color: #2d3748; font-weight: 500;">${formatDate(dueDate)}</span>
            </div>
          ` : ''}
          
          ${notes ? `
            <div>
              <span style="font-weight: 600; color: #4a5568; display: block; margin-bottom: 8px;">Notes:</span>
              <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid ${data.business?.brandColor || '#1EB29F'};">
                <p style="color: #2d3748; margin: 0; line-height: 1.6; font-style: italic;">
                  "${notes.length > 150 ? notes.substring(0, 150) + '...' : notes}"
                </p>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${detailsUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, ${data.business?.brandColor || '#1EB29F'} 0%, ${adjustBrightness(data.business?.brandColor || '#1EB29F', -10)} 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); transition: all 0.2s ease;">
          View ${entityTypeLabel} Details →
        </a>
      </div>

      <!-- Quick Tips -->
      <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
        <h4 style="color: #92400e; margin: 0 0 12px 0; font-size: 14px; font-weight: 600; display: flex; align-items: center;">
          <span style="margin-right: 8px;">💡</span> Quick Tips
        </h4>
        <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
          <li>Review all details carefully before starting work</li>
          <li>Update the status as you progress</li>
          <li>Reach out to ${assignerName !== 'System' ? assignerName : 'your team'} if you have questions</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f7fafc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
      <p style="color: #718096; margin: 0 0 16px 0; font-size: 14px;">
        This notification was sent because you have assignment notifications enabled.
      </p>
      <p style="color: #a0aec0; margin: 0; font-size: 12px;">
        ${business?.businessName || 'Lumiso'} • Professional Photography Management
      </p>
    </div>
  `;
}

// Helper function to adjust brightness
function adjustBrightness(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Adjust brightness
  const newR = Math.round(Math.min(255, Math.max(0, r + (r * percent / 100))));
  const newG = Math.round(Math.min(255, Math.max(0, g + (g * percent / 100))));
  const newB = Math.round(Math.min(255, Math.max(0, b + (b * percent / 100))));
  
  // Convert back to hex
  return '#' + newR.toString(16).padStart(2, '0') + newG.toString(16).padStart(2, '0') + newB.toString(16).padStart(2, '0');
}

export function generateAssignmentEmail(data: AssignmentEmailData): string {
  const content = generateAssignmentEmailContent(data);
  const subject = `New Assignment: ${data.assignmentData.entityName}`;
  
  return createEmailTemplate(subject, content, data);
}