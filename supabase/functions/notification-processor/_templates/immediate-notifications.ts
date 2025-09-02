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
export interface ImmediateNotificationEmailData {
  user: {
    fullName: string;
    email: string;
  };
  business: {
    businessName: string;
    brandColor?: string;
  };
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
    <div style="text-align: center; margin: 32px 0;">
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
 * Generate unified immediate notification email
 */
export function generateImmediateNotificationEmail(emailData: ImmediateNotificationEmailData): string {
  const brandColor = emailData.business.brandColor || '#1EB29F';
  const data = emailData.notificationData;
  
  let content = generateNotificationHeader(data, brandColor);
  
  // Add entity-specific details
  switch (data.type) {
    case 'project-assignment':
      content += `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin: 24px 0;
        ">
          <h3 style="
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 16px 0;
          ">Project Details</h3>
          <div style="color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>Project:</strong> ${data.project.name}<br>
            ${data.project.type ? `<strong>Type:</strong> ${data.project.type}<br>` : ''}
            ${data.project.status ? `<strong>Status:</strong> ${data.project.status}<br>` : ''}
            ${data.project.leadName ? `<strong>Client:</strong> ${data.project.leadName}<br>` : ''}
            ${data.project.notes ? `<strong>Notes:</strong> ${data.project.notes}` : ''}
          </div>
        </div>
      `;
      break;
      
    case 'lead-assignment':
      content += `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin: 24px 0;
        ">
          <h3 style="
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 16px 0;
          ">Lead Details</h3>
          <div style="color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>Lead:</strong> ${data.lead.name}<br>
            ${data.lead.status ? `<strong>Status:</strong> ${data.lead.status}<br>` : ''}
            ${data.lead.notes ? `<strong>Notes:</strong> ${data.lead.notes}` : ''}
          </div>
        </div>
      `;
      break;
      
    case 'project-milestone':
      const isCompleted = data.project.lifecycle === 'completed';
      content += `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          margin: 24px 0;
        ">
          <h3 style="
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 16px 0;
          ">Project Update</h3>
          <div style="color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>Project:</strong> ${data.project.name}<br>
            ${data.project.type ? `<strong>Type:</strong> ${data.project.type}<br>` : ''}
            ${data.project.leadName ? `<strong>Client:</strong> ${data.project.leadName}<br>` : ''}
            <div style="
              background: ${isCompleted ? '#22c55e' : '#f59e0b'}15;
              padding: 12px;
              border-radius: 8px;
              margin: 16px 0;
              border-left: 4px solid ${isCompleted ? '#22c55e' : '#f59e0b'};
            ">
              <strong>Status Update:</strong> ${data.project.oldStatus} → ${data.project.newStatus}
            </div>
            ${data.project.notes ? `<strong>Notes:</strong> ${data.project.notes}` : ''}
          </div>
        </div>
      `;
      break;
  }

  content += generateCallToAction(data, brandColor);

  const templateData: EmailTemplateData = {
    userFullName: emailData.user.fullName,
    businessName: emailData.business.businessName,
    brandColor: brandColor,
    baseUrl: 'https://my.lumiso.app'
  };

  return createEmailTemplate(
    generateSubject(data),
    content,
    templateData
  );
}

/**
 * Generate email subject based on notification type
 */
export function generateSubject(data: ImmediateNotificationData): string {
  switch (data.type) {
    case 'project-assignment':
      return `📋 New Project Assignment: ${data.project.name}`;
    case 'lead-assignment':
      return `👤 New Lead Assignment: ${data.lead.name}`;
    case 'project-milestone':
      const isCompleted = data.project.lifecycle === 'completed';
      return isCompleted 
        ? `🎉 Project Completed: ${data.project.name}`
        : `⚠️ Project Cancelled: ${data.project.name}`;
    default:
      return 'New Notification';
  }
}