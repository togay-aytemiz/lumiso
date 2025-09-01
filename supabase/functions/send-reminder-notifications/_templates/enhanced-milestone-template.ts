import { createEmailTemplate } from './enhanced-email-base.ts';

// Interface for milestone-specific data
interface MilestoneData {
  projectId: string;
  projectName: string;
  projectType?: string | null;
  oldStatus: string;
  newStatus: string;
  lifecycle: string; // 'completed' or 'cancelled'
  milestoneUserName: string;
  notes?: string | null;
  organizationId: string;
}

// Interface for milestone email data
export interface MilestoneEmailData {
  user: {
    fullName: string;
    email: string;
  };
  business: {
    businessName: string;
    brandColor: string;
  };
  milestoneData: MilestoneData;
}

/**
 * Generates HTML content for milestone email
 */
function generateMilestoneEmailContent(data: MilestoneEmailData): string {
  const { user, business, milestoneData } = data;
  
  // Determine milestone type and styling
  const isCompleted = milestoneData.lifecycle === 'completed';
  const emoji = isCompleted ? '🎉' : '⚠️';
  const statusColor = isCompleted ? '#22c55e' : '#f59e0b';
  const actionText = isCompleted ? 'completed' : 'cancelled';
  
  // Lighten the brand color for gradient background
  const lighterBrandColor = adjustBrightness(business.brandColor, 20);
  
  return `
    <div style="
      background: linear-gradient(135deg, ${business.brandColor}15, ${lighterBrandColor}10);
      border-radius: 16px;
      padding: 32px;
      margin: 24px 0;
      border-left: 4px solid ${business.brandColor};
    ">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="
          font-size: 48px;
          margin-bottom: 8px;
          line-height: 1;
        ">${emoji}</div>
        <h2 style="
          color: #1f2937;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.2;
        ">Project Milestone Reached!</h2>
        <p style="
          color: #6b7280;
          font-size: 16px;
          margin: 0;
          line-height: 1.4;
        ">${milestoneData.milestoneUserName} ${actionText} a project you're assigned to</p>
      </div>

      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin-bottom: 24px;
      ">
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        ">
          <div style="
            background: ${business.brandColor}20;
            padding: 12px;
            border-radius: 8px;
            margin-right: 16px;
          ">
            <div style="
              color: ${business.brandColor};
              font-size: 20px;
              font-weight: 600;
            ">📋</div>
          </div>
          <div style="flex: 1;">
            <h3 style="
              color: #1f2937;
              font-size: 18px;
              font-weight: 600;
              margin: 0 0 4px 0;
              line-height: 1.3;
            ">${milestoneData.projectName}</h3>
            ${milestoneData.projectType ? `
              <span style="
                background: #f3f4f6;
                color: #6b7280;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">${milestoneData.projectType}</span>
            ` : ''}
          </div>
        </div>

        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px 0;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
        ">
          <div style="
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          ">
            <div style="
              color: #9ca3af;
              font-weight: 500;
              margin-bottom: 4px;
            ">${milestoneData.oldStatus}</div>
          </div>
          
          <div style="
            margin: 0 20px;
            color: ${business.brandColor};
            font-size: 20px;
          ">→</div>
          
          <div style="
            text-align: center;
            color: ${statusColor};
            font-size: 14px;
          ">
            <div style="
              color: ${statusColor};
              font-weight: 600;
              font-size: 16px;
            ">${milestoneData.newStatus}</div>
          </div>
        </div>

        ${milestoneData.notes ? `
          <div style="
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            margin-top: 16px;
          ">
            <div style="
              color: #6b7280;
              font-size: 12px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            ">Project Notes</div>
            <div style="
              color: #374151;
              font-size: 14px;
              line-height: 1.5;
            ">${milestoneData.notes}</div>
          </div>
        ` : ''}
      </div>

      <div style="text-align: center;">
        <a href="https://my.lumiso.app/projects/${milestoneData.projectId}" style="
          display: inline-block;
          background: ${business.brandColor};
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
        ">View Project Details</a>
      </div>
    </div>

    <div style="
      text-align: center;
      margin: 24px 0;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    ">
      <p style="
        color: #6b7280;
        font-size: 13px;
        margin: 0;
        line-height: 1.4;
      ">
        ${isCompleted 
          ? '🎊 Congratulations on reaching this milestone! Great work by the team.' 
          : '📋 This project status has been updated. Check the project details for more information.'
        }
      </p>
    </div>
  `;
}

/**
 * Helper function to adjust color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const num = parseInt(hex, 16);
  const r = (num >> 16) + percent;
  const g = (num >> 8 & 0x00FF) + percent;
  const b = (num & 0x0000FF) + percent;
  
  // Clamp values
  return `#${((1 << 24) + (Math.min(255, Math.max(0, r)) << 16) + 
    (Math.min(255, Math.max(0, g)) << 8) + Math.min(255, Math.max(0, b)))
    .toString(16).slice(1)}`;
}

/**
 * Main function to generate milestone email
 */
export function generateMilestoneEmail(data: MilestoneEmailData): string {
  const { milestoneData } = data;
  
  // Determine subject action
  const actionText = milestoneData.lifecycle === 'completed' ? 'completed' : 'cancelled';
  const subject = `Project Milestone: ${milestoneData.projectName} ${actionText}`;
  
  const content = generateMilestoneEmailContent(data);
  
  return createEmailTemplate(subject, content, {
    userFullName: data.user.fullName,
    businessName: data.business.businessName,
    brandColor: data.business.brandColor,
    baseUrl: 'https://my.lumiso.app'
  });
}