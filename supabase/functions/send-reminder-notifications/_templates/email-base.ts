// Email template utilities and base styles for professional emails

export interface EmailTemplateData {
  userFullName: string;
  businessName?: string;
  logoUrl?: string;
  brandColor?: string;
  baseUrl?: string;
}

export const getEmailBaseStyles = (brandColor = '#1EB29F') => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1F2937;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .email-header {
      background: linear-gradient(135deg, ${brandColor}, ${adjustBrightness(brandColor, -20)});
      padding: 32px 24px;
      text-align: center;
    }
    
    .logo {
      height: 48px;
      margin-bottom: 16px;
    }
    
    .company-name {
      color: #FFFFFF;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }
    
    .email-body {
      padding: 32px 24px;
    }
    
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      margin: 24px 0 16px 0;
      border-bottom: 2px solid #E5E7EB;
      padding-bottom: 8px;
    }
    
    .item-card {
      background-color: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      transition: box-shadow 0.2s ease;
    }
    
    .item-card:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .item-title {
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 8px;
    }
    
    .item-meta {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 8px;
    }
    
    .item-action {
      display: inline-block;
      background-color: ${adjustBrightness(brandColor, 80)};
      color: ${brandColor};
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      border: 1px solid ${adjustBrightness(brandColor, 60)};
    }
    
    .item-action:hover {
      background-color: ${adjustBrightness(brandColor, 70)};
      border-color: ${adjustBrightness(brandColor, 50)};
    }
    
    .summary-stats {
      background-color: #EFF6FF;
      border: 1px solid #DBEAFE;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      text-align: center;
    }
    
    .stat-number {
      font-size: 24px;
      font-weight: 700;
      color: ${brandColor};
    }
    
    .stat-label {
      font-size: 14px;
      color: #6B7280;
      margin-top: 4px;
    }
    
    .cta-button {
      display: inline-block;
      background-color: ${adjustBrightness(brandColor, 80)};
      color: ${brandColor};
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
      text-align: center;
      border: 1px solid ${adjustBrightness(brandColor, 60)};
      transition: all 0.2s ease;
    }
    
    .cta-button:hover {
      background-color: ${adjustBrightness(brandColor, 70)};
      border-color: ${adjustBrightness(brandColor, 50)};
    }
    
    .email-footer {
      background-color: #F3F4F6;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #E5E7EB;
    }
    
    .footer-text {
      font-size: 12px;
      color: #6B7280;
      margin: 0;
    }
    
    .overdue-badge {
      background-color: #FEF2F2;
      color: #B91C1C;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .upcoming-badge {
      background-color: #EFF6FF;
      color: #1D4ED8;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
  </style>
`;

// Helper function to adjust color brightness
function adjustBrightness(color: string, percent: number): string {
  // Simple implementation for HSL color adjustment
  // This is a basic version - in production, you might want a more robust solution
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

export const createEmailTemplate = (
  title: string,
  content: string,
  templateData: EmailTemplateData
) => {
  const { userFullName, businessName = "Photography CRM", logoUrl, brandColor = "#1EB29F", baseUrl = "" } = templateData;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      ${getEmailBaseStyles(brandColor)}
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" class="logo" />` : ''}
          <h1 class="company-name">${businessName}</h1>
        </div>
        
        <div class="email-body">
          <div class="greeting">Hi ${userFullName},</div>
          ${content}
        </div>
        
        <div class="email-footer">
          <p class="footer-text">
            This is an automated notification from ${businessName}.<br>
            ${baseUrl ? `<a href="${baseUrl}" style="color: ${brandColor};">Visit your dashboard</a>` : ''}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};