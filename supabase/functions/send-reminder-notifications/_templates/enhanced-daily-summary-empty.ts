import { createEmailTemplate, EmailTemplateData, Session, Todo, Activity, Lead, formatDateTime, formatDate, formatTime } from './enhanced-email-base.ts';

interface OverdueItems {
  leads: Lead[];
  activities: Activity[];
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
 * Generate empty daily summary with business tips and any existing overdue/past items
 */
export function generateEmptyDailySummaryEmail(
  overdueItems: OverdueItems, 
  pastSessions: Session[],
  templateData: EmailTemplateData
): string {
  const today = formatDate(new Date().toISOString(), templateData.dateFormat);
  const totalOverdue = overdueItems.leads.length + overdueItems.activities.length;
  const totalPastSessions = pastSessions.length;
  const brandColor = templateData.brandColor || '#1EB29F';
  const lighterBrandColor = adjustBrightness(brandColor, 20);
  
  let content = `
    <!-- Header Section -->
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
        ">🌅</div>
        <h2 style="
          color: #1f2937;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.2;
        ">Fresh Start Today!</h2>
        <p style="
          color: #6b7280;
          font-size: 16px;
          margin: 0;
          line-height: 1.4;
        ">Today's a perfect opportunity to grow your photography business - <strong>${today}</strong></p>
      </div>
      
      <!-- Empty State Stats -->
      <div style="
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      ">
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #6b7280;
            margin-bottom: 4px;
          ">0</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Today's Sessions</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: #6b7280;
            margin-bottom: 4px;
          ">0</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Today's Reminders</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: ${totalOverdue > 0 ? '#ef4444' : '#6b7280'};
            margin-bottom: 4px;
          ">${totalOverdue}</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Overdue Items</div>
        </div>
        
        <div style="
          text-align: center;
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-width: 120px;
        ">
          <div style="
            font-size: 24px;
            font-weight: 700;
            color: ${totalPastSessions > 0 ? '#f59e0b' : '#6b7280'};
            margin-bottom: 4px;
          ">${totalPastSessions}</div>
          <div style="
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Past Sessions</div>
        </div>
      </div>
    </div>
  `;

  // Business Growth Tips Section
  content += `
    <div style="margin: 32px 0;">
      <h3 style="
        color: #1f2937;
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 20px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        text-align: center;
        justify-content: center;
      ">
        💡 Make Today Count - Business Growth Tips
      </h3>
      
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #3b82f6;
        ">
          <h4 style="
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          ">📞 Follow Up with Leads</h4>
          <p style="
            color: #6b7280;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
          ">Review your lead pipeline and reach out to prospects who haven't responded. A friendly follow-up can convert interest into bookings.</p>
        </div>
        
        <div style="
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #10b981;
        ">
          <h4 style="
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          ">📋 Organize Your Projects</h4>
          <p style="
            color: #6b7280;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
          ">Update project statuses, organize upcoming sessions, and ensure all client deliverables are on track.</p>
        </div>
        
        <div style="
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #f59e0b;
        ">
          <h4 style="
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          ">💰 Review Packages & Pricing</h4>
          <p style="
            color: #6b7280;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
          ">Perfect time to evaluate your service packages, adjust pricing for the season, and create new offerings that attract clients.</p>
        </div>
        
        <div style="
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4x 6px -1px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #8b5cf6;
        ">
          <h4 style="
            color: #1f2937;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          ">📸 Plan Your Marketing</h4>
          <p style="
            color: #6b7280;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
          ">Create content for social media, reach out to past clients for referrals, or plan your next promotional campaign.</p>
        </div>
      </div>
    </div>
  `;

  // Overdue Items (Alert Card) - only if there are any
  if (totalOverdue > 0) {
    content += `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin: 24px 0;
        border-left: 4px solid #ef4444;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        ">
          <div style="flex: 1;">
            <p style="
              margin: 0;
              color: #dc2626;
              font-weight: 600;
              font-size: 16px;
            ">
              Don't forget: You have <strong>${totalOverdue}</strong> overdue item${totalOverdue > 1 ? 's' : ''} that need attention.
            </p>
          </div>
        </div>
        ${templateData.baseUrl ? `
          <div style="text-align: left;">
            <a href="${templateData.baseUrl}/reminders" style="
              color: #dc2626;
              text-decoration: underline;
              font-size: 14px;
              font-weight: 500;
            ">View overdue items</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Past Sessions (Alert Card) - only if there are any
  if (totalPastSessions > 0) {
    content += `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin: 24px 0;
        border-left: 4px solid #f59e0b;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        ">
          <div style="flex: 1;">
            <p style="
              margin: 0;
              color: #d97706;
              font-weight: 600;
              font-size: 16px;
            ">
              Follow up needed: You have <strong>${totalPastSessions}</strong> past session${totalPastSessions > 1 ? 's' : ''} that need${totalPastSessions === 1 ? 's' : ''} action.
            </p>
          </div>
        </div>
        ${templateData.baseUrl ? `
          <div style="text-align: left;">
            <a href="${templateData.baseUrl}/sessions" style="
              color: #d97706;
              text-decoration: underline;
              font-size: 14px;
              font-weight: 500;
            ">View past sessions</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Quick Actions
  if (templateData.baseUrl) {
    content += `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        margin: 32px 0;
      ">
        <h3 style="
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 16px 0;
          text-align: center;
        ">Quick Actions</h3>
        
        <div style="
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin: 0 auto;
        ">
          <a href="${templateData.baseUrl}" style="
            display: inline-block;
            background: ${brandColor};
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">Dashboard</a>
          <a href="${templateData.baseUrl}/leads" style="
            display: inline-block;
            background: #6b7280;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">Leads</a>
          <a href="${templateData.baseUrl}/projects" style="
            display: inline-block;
            background: #6b7280;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">Projects</a>
          <a href="${templateData.baseUrl}/sessions" style="
            display: inline-block;
            background: #6b7280;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            flex: 1;
            min-width: 120px;
          ">Sessions</a>
        </div>
      </div>
    `;
  }

  // Motivational message
  const messages = [
    "Every quiet day is a chance to build the future. Use this time wisely! 🌟",
    "No sessions today? Perfect opportunity to nurture your business growth! 💪",
    "Great photographers use downtime to create opportunities. Today's your day! ✨",
    "Success isn't just about busy days - it's about making every day count! 🎯",
    "Today's focus time: grow your business, connect with leads, plan your success! 🚀"
  ];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  content += `
    <div style="
      background: linear-gradient(135deg, #22c55e15, #16a34a10);
      border-radius: 16px;
      padding: 24px;
      margin: 32px 0;
      border-left: 4px solid #22c55e;
      text-align: center;
    ">
      <p style="
        margin: 0;
        font-style: italic;
        color: #059669;
        font-size: 16px;
        line-height: 1.5;
      ">
        ${randomMessage}
      </p>
    </div>
  `;

  return createEmailTemplate(
    `🌅 Fresh Start Today - ${today}`,
    content,
    templateData
  );
}