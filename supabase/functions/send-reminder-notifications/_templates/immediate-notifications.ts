import { createEmailTemplate, EmailTemplateData } from './enhanced-email-base.ts';

// Base interface for all immediate notifications
interface BaseImmediateNotificationData {
  organizationId: string;
  triggeredByUser: {
    name: string;
    id: string;
  };
}

// Project Assignment specific data
export interface ProjectAssignmentData extends BaseImmediateNotificationData {
  type: 'project-assignment';
  project: {
    id: string;
    name: string;
    type?: string;
    status?: string;
    notes?: string;
    leadName?: string;
  };
  assignee: {
    name: string;
    email: string;
  };
}

// Lead Assignment specific data  
export interface LeadAssignmentData extends BaseImmediateNotificationData {
  type: 'lead-assignment';
  lead: {
    id: string;
    name: string;
    status?: string;
    notes?: string;
  };
  assignee: {
    name: string;
    email: string;
  };
}

// Project Milestone specific data
export interface ProjectMilestoneData extends BaseImmediateNotificationData {
  type: 'project-milestone';
  project: {
    id: string;
    name: string;
    type?: string;
    oldStatus: string;
    newStatus: string;
    lifecycle: 'completed' | 'cancelled';
    notes?: string;
    leadName?: string;
  };
  assignee: {
    name: string;
    email: string;
  };
}

// Union type for all notification data
export type ImmediateNotificationData = ProjectAssignmentData | LeadAssignmentData | ProjectMilestoneData;

// Extended email template data
export interface ImmediateNotificationEmailData extends EmailTemplateData {
  notificationData: ImmediateNotificationData;
}

/**
 * Helper function to adjust color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  hex = hex.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Generate the notification header with emoji and title
 */
function generateNotificationHeader(data: ImmediateNotificationData, brandColor: string): string {
  let emoji = '';
  let title = '';
  let subtitle = '';
  
  switch (data.type) {
    case 'project-assignment':
      emoji = '📋';
      title = 'New Project Assignment';
      subtitle = `${data.triggeredByUser.name} assigned you to a project`;
      break;
    case 'lead-assignment':
      emoji = '👤';
      title = 'New Lead Assignment';
      subtitle = `${data.triggeredByUser.name} assigned you to a lead`;
      break;
    case 'project-milestone':
      emoji = data.project.lifecycle === 'completed' ? '🎉' : '⚠️';
      title = 'Project Milestone Reached';
      subtitle = `${data.triggeredByUser.name} ${data.project.lifecycle === 'completed' ? 'completed' : 'cancelled'} a project you're assigned to`;
      break;
  }

  const lighterBrandColor = adjustBrightness(brandColor, 20);

  return `
    <div style="
      background: linear-gradient(135deg, ${brandColor}15, ${lighterBrandColor}10);
      border-radius: 16px;
      padding: 32px;
      margin: 24px 0;
      border-left: 4px solid ${brandColor};
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
        ">${title}</h2>
        <p style="
          color: #6b7280;
          font-size: 16px;
          margin: 0;
          line-height: 1.4;
        ">${subtitle}</p>
      </div>
  `;
}

/**
 * Generate project assignment content card
 */
function generateProjectAssignmentCard(data: ProjectAssignmentData, brandColor: string): string {
  return `
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
          background: ${brandColor}20;
          padding: 12px;
          border-radius: 8px;
          margin-right: 16px;
        ">
          <div style="
            color: ${brandColor};
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
          ">${data.project.name}${data.project.leadName ? ` • Client: ${data.project.leadName}` : ''}</h3>
          ${data.project.type ? `
            <span style="
              background: #f3f4f6;
              color: #6b7280;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">${data.project.type}</span>
          ` : ''}
        </div>
      </div>

      ${data.project.status ? `
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        ">
          <span style="
            font-weight: 600;
            color: #6b7280;
            margin-right: 12px;
          ">Status:</span>
          <span style="
            background: ${brandColor}10;
            color: ${brandColor};
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
          ">${data.project.status}</span>
        </div>
      ` : ''}

      ${data.project.notes ? `
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
          ">${data.project.notes}</div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate lead assignment content card
 */
function generateLeadAssignmentCard(data: LeadAssignmentData, brandColor: string): string {
  return `
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
          background: ${brandColor}20;
          padding: 12px;
          border-radius: 8px;
          margin-right: 16px;
        ">
          <div style="
            color: ${brandColor};
            font-size: 20px;
            font-weight: 600;
          ">👤</div>
        </div>
        <div style="flex: 1;">
          <h3 style="
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 4px 0;
            line-height: 1.3;
          ">${data.lead.name}</h3>
          ${data.lead.status ? `
            <span style="
              background: #f3f4f6;
              color: #6b7280;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">${data.lead.status}</span>
          ` : ''}
        </div>
      </div>


      ${data.lead.notes ? `
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
          ">Lead Notes</div>
          <div style="
            color: #374151;
            font-size: 14px;
            line-height: 1.5;
          ">${data.lead.notes}</div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate project milestone content card
 */
function generateProjectMilestoneCard(data: ProjectMilestoneData, brandColor: string): string {
  const isCompleted = data.project.lifecycle === 'completed';
  const statusColor = isCompleted ? '#22c55e' : '#f59e0b';

  return `
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
          background: ${brandColor}20;
          padding: 12px;
          border-radius: 8px;
          margin-right: 16px;
        ">
          <div style="
            color: ${brandColor};
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
          ">${data.project.name}${data.project.leadName ? ` • Client: ${data.project.leadName}` : ''}</h3>
          ${data.project.type ? `
            <span style="
              background: #f3f4f6;
              color: #6b7280;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">${data.project.type}</span>
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
          ">${data.project.oldStatus}</div>
        </div>
        
        <div style="
          margin: 0 20px;
          color: ${brandColor};
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
          ">${data.project.newStatus}</div>
        </div>
      </div>

      ${data.project.notes ? `
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
          ">${data.project.notes}</div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate call-to-action button
 */
function generateCallToAction(data: ImmediateNotificationData, brandColor: string): string {
  let buttonText = '';
  let url = '';

  switch (data.type) {
    case 'project-assignment':
    case 'project-milestone':
      buttonText = 'View Project Details';
      url = `https://my.lumiso.app/projects/${data.project.id}`;
      break;
    case 'lead-assignment':
      buttonText = 'View Lead Details';
      url = `https://my.lumiso.app/leads/${data.lead.id}`;
      break;
  }

  return `
    <div style="text-align: center;">
      <a href="${url}" style="
        display: inline-block;
        background: ${brandColor};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
      ">${buttonText}</a>
    </div>
  `;
}

/**
 * Generate footer message
 */
function generateFooterMessage(data: ImmediateNotificationData): string {
  let message = '';

  switch (data.type) {
    case 'project-assignment':
      message = '📋 You have been assigned to this project. Check the details and get started!';
      break;
    case 'lead-assignment':
      message = '👤 You have been assigned to this lead. Time to make contact and move forward!';
      break;
    case 'project-milestone':
      const isCompleted = data.project.lifecycle === 'completed';
      message = isCompleted 
        ? '🎊 Congratulations on reaching this milestone! Great work by the team.' 
        : '📋 This project status has been updated. Check the project details for more information.';
      break;
  }

  return `
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
      ">${message}</p>
    </div>
  `;
}

/**
 * Generate the complete notification content
 */
function generateImmediateNotificationContent(data: ImmediateNotificationEmailData): string {
  const { notificationData, business } = data;
  const brandColor = business?.brandColor || '#1EB29F';

  // Generate header
  let content = generateNotificationHeader(notificationData, brandColor);

  // Generate content card based on notification type
  switch (notificationData.type) {
    case 'project-assignment':
      content += generateProjectAssignmentCard(notificationData, brandColor);
      break;
    case 'lead-assignment':
      content += generateLeadAssignmentCard(notificationData, brandColor);
      break;
    case 'project-milestone':
      content += generateProjectMilestoneCard(notificationData, brandColor);
      break;
  }

  // Generate call-to-action
  content += generateCallToAction(notificationData, brandColor);

  // Close header div
  content += `</div>`;

  // Generate footer message
  content += generateFooterMessage(notificationData);

  return content;
}

/**
 * Generate email subject with emoji
 */
export function generateSubject(data: ImmediateNotificationData): string {
  switch (data.type) {
    case 'project-assignment':
      return `📋 New Assignment: ${data.project.name}`;
    case 'lead-assignment':
      return `👤 New Assignment: ${data.lead.name}`;
    case 'project-milestone':
      const emoji = data.project.lifecycle === 'completed' ? '🎉' : '⚠️';
      const action = data.project.lifecycle === 'completed' ? 'Completed' : 'Cancelled';
      return `${emoji} Project ${action}: ${data.project.name}`;
  }
}

/**
 * Main function to generate immediate notification email
 */
export function generateImmediateNotificationEmail(data: ImmediateNotificationEmailData): string {
  const subject = generateSubject(data.notificationData);
  const content = generateImmediateNotificationContent(data);
  
  return createEmailTemplate(subject, content, {
    userFullName: data.user?.fullName || '',
    businessName: data.business?.businessName || 'Lumiso',
    brandColor: data.business?.brandColor || '#1EB29F',
    baseUrl: 'https://my.lumiso.app'
  });
}