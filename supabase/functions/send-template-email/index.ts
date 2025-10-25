import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TemplateBlock {
  id: string;
  type: string;
  data: any;
  order: number;
}

interface SendEmailRequest {
  // Template builder format
  to?: string;
  subject?: string;
  preheader?: string;
  blocks?: TemplateBlock[];
  mockData?: Record<string, string>;
  isTest?: boolean;
  
  // Workflow format
  template_id?: string;
  recipient_email?: string;
  recipient_name?: string;
  workflow_execution_id?: string;
}

export function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (match, key, fallback) => {
    const value = data[key];
    
    // Special handling for session_location - use dash if empty or default values
    if (key === 'session_location') {
      if (!value || value.trim() === '' || value === 'Studio' || value === 'TBD') {
        return '-';
      }
      return value;
    }
    
    // Special handling for phone fields - use dash if empty
    if (key.includes('phone')) {
      if (!value || value.trim() === '') {
        return '-';
      }
      return value;
    }
    
    // Return value with fallback support
    return value || fallback || match;
  });
}

export function generateHTMLContent(
  blocks: TemplateBlock[],
  mockData: Record<string, string>,
  subject: string,
  preheader?: string,
  organizationSettings?: any,
  isPreview: boolean = false
): string {
  const baseStyles = `
    <style>
      /* Email client reset styles */
      body, table, td, p, a, li, blockquote {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table, td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
      }
      
      /* Base email styles matching EmailPreview.tsx */
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
        line-height: 1.6; 
        color: #333333; 
        margin: 0; 
        padding: 0; 
        background-color: #f8fafc;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .email-container { 
        max-width: 700px; 
        margin: 20px auto; 
        background: #ffffff; 
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        overflow: hidden;
      }
      .email-header { 
        background-color: #475569;
        color: white; 
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .email-header-dots {
        display: flex;
        gap: 4px;
      }
      .email-header-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }
      .dot-red { background-color: #f87171; }
      .dot-yellow { background-color: #fbbf24; }
      .dot-green { background-color: #34d399; }
      .email-body { 
        padding: 24px; 
      }
      
      /* Text formatting styles matching preview */
      .text-block { 
        margin-bottom: 24px; 
      }
      .text-left { text-align: left; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      
      .font-arial { font-family: Arial, sans-serif; }
      .font-helvetica { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      .font-georgia { font-family: Georgia, serif; }
      .font-times { font-family: 'Times New Roman', Times, serif; }
      .font-courier { font-family: 'Courier New', Courier, monospace; }
      
      /* Button styles matching preview exactly */
      .cta-button { 
        display: inline-block; 
        padding: 12px 24px; 
        text-decoration: none; 
        border-radius: 6px; 
        font-weight: 500;
        text-align: center;
        font-size: 16px;
        line-height: 1.5;
        border: 0;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .cta-primary { 
        background-color: #2563eb !important; 
        color: #ffffff !important; 
      }
      .cta-primary:hover { 
        background-color: #1d4ed8 !important; 
        color: #ffffff !important;
      }
      .cta-secondary { 
        background-color: #e5e7eb; 
        color: #374151; 
      }
      .cta-secondary:hover { 
        background-color: #d1d5db; 
        color: #374151;
      }
      .cta-text { 
        background: none;
        color: #2563eb; 
        text-decoration: underline;
        padding: 0;
        font-weight: 500;
      }
      .cta-text:hover { 
        color: #1d4ed8;
      }
      
      /* Session details box matching preview */
      .session-details { 
        background-color: #f1f5f9; 
        padding: 20px; 
        border-radius: 8px; 
        margin: 24px 0;
        border: 1px solid #e2e8f0;
      }
      .session-details h3 { 
        margin: 0 0 12px 0; 
        color: #0f172a;
        font-size: 18px;
        font-weight: 600;
      }
      .session-detail-item { 
        display: flex; 
        margin-bottom: 8px;
        align-items: flex-start;
      }
      .session-detail-label { 
        font-weight: 500; 
        color: #475569; 
        width: 80px;
        flex-shrink: 0;
        font-size: 14px;
      }
      .session-detail-value { 
        color: #334155;
        font-size: 14px;
      }
      
      /* Image styles */
      .image-block { 
        text-align: center; 
        margin: 24px 0; 
      }
      .image-block img { 
        width: 100%; 
        height: auto; 
        display: block;
        margin: 0 auto;
        border-radius: 8px;
      }
      .image-caption {
        margin-top: 8px;
        font-size: 14px;
        color: #6b7280;
        font-style: italic;
      }
      
      /* Header styles */
      .email-header-block { 
        text-align: center; 
        padding: 24px 0 32px 0;
        border-radius: 8px;
      }
      .header-logo {
        margin-bottom: 16px;
        font-size: 32px;
      }
      .header-tagline {
        font-size: 18px;
        font-weight: 500;
        margin: 0;
      }
      
      /* Footer styles matching preview */
      .email-footer { 
        border-top: 1px solid #e5e7eb;
        padding-top: 24px; 
        margin-top: 32px;
        text-align: center;
        font-size: 14px;
        color: #6b7280;
      }
      .footer-logo { 
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        border-radius: 8px;
        margin: 0 auto 12px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 24px;
      }
      .footer-business-name {
        font-weight: 600;
        color: #374151;
        margin-bottom: 8px;
        font-size: 16px;
      }
      .footer-contact {
        margin-bottom: 4px;
      }
      .footer-custom-text {
        margin-top: 12px;
        font-style: italic;
        color: #9ca3af;
      }
      
      /* Divider styles */
      .divider-line { 
        border: none;
        border-top: 1px solid #e5e7eb; 
        margin: 24px 0;
      }
      .divider-space {
        margin: 0;
        padding: 0;
      }
      
      /* Social links */
      .social-links { 
        text-align: center; 
        padding: 16px 0;
      }
      .social-links a { 
        color: #2563eb;
        text-decoration: underline;
        margin: 0 12px;
        text-transform: capitalize;
        font-weight: 500;
      }
      .social-links a:hover {
        color: #1d4ed8;
      }
      
      /* Bullet list styles */
      .bullet-list {
        list-style-type: disc;
        margin-left: 24px;
        padding-left: 0;
      }
      .bullet-list li {
        margin-bottom: 4px;
      }
      
      /* Mobile responsive styles */
      @media only screen and (max-width: 600px) {
        .email-container { 
          margin: 0 !important;
          border-radius: 0 !important;
        }
        .email-body { 
          padding: 16px !important; 
        }
        .cta-button {
          display: block !important;
          width: 100% !important;
          margin: 12px 0 !important;
          box-sizing: border-box;
        }
        .session-detail-item {
          flex-direction: column !important;
        }
        .session-detail-label {
          width: auto !important;
          margin-bottom: 2px;
        }
      }
    </style>
  `;

  let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <meta name="x-apple-disable-message-reformatting" content="">
      <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
      <title>${replacePlaceholders(subject, mockData)}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="email-container">`;

  // Only include email preview header for preview mode
  if (isPreview) {
    htmlContent += `
        <!-- Email Header Bar -->
        <div class="email-header">
          <div class="email-header-dots">
            <div class="email-header-dot dot-red"></div>
            <div class="email-header-dot dot-yellow"></div>
            <div class="email-header-dot dot-green"></div>
          </div>
          <span style="font-size: 14px; font-weight: 500;">Email Preview</span>
        </div>`;
  }
        
  htmlContent += `<div class="email-body">`;

  if (preheader) {
    htmlContent += `
      <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${replacePlaceholders(preheader, mockData)}
      </div>
    `;
  }

  // Sort and render blocks
  blocks
    .sort((a, b) => a.order - b.order)
    .forEach(block => {
      switch (block.type) {
        case 'text':
          const textContent = replacePlaceholders(block.data.content || '', mockData);
          const alignment = block.data.formatting?.alignment || 'left';
          const fontFamily = block.data.formatting?.fontFamily || 'Arial';
          const bold = block.data.formatting?.bold ? 'font-weight: bold;' : '';
          const italic = block.data.formatting?.italic ? 'font-style: italic;' : '';
          const bullets = block.data.formatting?.bullets;
          
          // Get font size based on semantic type
          let fontSize = '16px';
          let fontWeight = 'normal';
          let lineHeight = '1.6';
          let marginBottom = '16px';
          
          switch (block.data.formatting?.fontSize) {
            case 'h1':
              fontSize = '32px';
              fontWeight = 'bold';
              lineHeight = '1.2';
              marginBottom = '20px';
              break;
            case 'h2':
              fontSize = '24px';
              fontWeight = 'bold';
              lineHeight = '1.3';
              marginBottom = '18px';
              break;
            case 'h3':
              fontSize = '20px';
              fontWeight = 'bold';
              lineHeight = '1.4';
              marginBottom = '16px';
              break;
            case 'p':
            default:
              fontSize = '16px';
              lineHeight = '1.6';
              marginBottom = '16px';
              break;
          }
          
          const textStyles = `
            text-align: ${alignment}; 
            font-size: ${fontSize}; 
            font-weight: ${fontWeight};
            line-height: ${lineHeight};
            margin-bottom: ${marginBottom};
            ${bold} 
            ${italic}
          `;
          
          htmlContent += `<div class="text-block font-${fontFamily.toLowerCase()}" style="${textStyles}">`;
          
          if (bullets) {
            htmlContent += `<ul class="bullet-list">`;
            textContent.split('\n').filter(line => line.trim()).forEach(line => {
              htmlContent += `<li>${line.trim()}</li>`;
            });
            htmlContent += `</ul>`;
          } else {
            textContent.split('\n').forEach(line => {
              htmlContent += `<div>${line}</div>`;
            });
          }
          
          htmlContent += `</div>`;
          break;

        case 'header':
          const headerTitle = replacePlaceholders(block.data.title || '', mockData);
          const tagline = block.data.tagline ? replacePlaceholders(block.data.tagline, mockData) : '';
          const bgColor = block.data.backgroundColor || '#ffffff';
          
          htmlContent += `
            <div class="email-header-block" style="background-color: ${bgColor};">
              ${block.data.showLogo ? `<div class="header-logo">🏢</div>` : ''}
              ${tagline ? `<p class="header-tagline">${tagline}</p>` : ''}
            </div>
          `;
          break;

        case 'cta':
          const buttonText = replacePlaceholders(block.data.text || 'Click Here', mockData);
          const buttonUrl = replacePlaceholders(block.data.link || '#', mockData);
          const variant = block.data.variant || 'primary';
          
          htmlContent += `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${buttonUrl}" class="cta-button cta-${variant}">${buttonText}</a>
            </div>
          `;
          break;

        case 'image':
          if (block.data.imageUrl || block.data.placeholderUrl || block.data.src) {
            const imageUrl = block.data.imageUrl || block.data.src || block.data.placeholderUrl;
            const caption = block.data.caption ? replacePlaceholders(block.data.caption, mockData) : '';
            const altText = block.data.alt || caption || 'Image';
            
            if (block.data.placeholder && !block.data.src) {
              htmlContent += `
                <div class="image-block">
                  <div style="width: 100%; height: 192px; background-color: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🖼️</div>
                    <p style="font-size: 14px; color: #6b7280; margin: 0;">Image Placeholder</p>
                  </div>
                  ${caption ? `<div class="image-caption">${caption}</div>` : ''}
                </div>
              `;
            } else {
              htmlContent += `
                <div class="image-block">
                  <img src="${imageUrl}" alt="${altText}" style="width: 100%; height: auto; border-radius: 8px;">
                  ${caption ? `<div class="image-caption">${caption}</div>` : ''}
                </div>
              `;
            }
          }
          break;

        case 'session-details':
          const sessionData = block.data;
          const customLabel = sessionData.customLabel || "Session Details";
          
          htmlContent += `
            <div class="session-details">
              <h3>${customLabel}</h3>
          `;
          
          if (sessionData.showDate) {
            htmlContent += `
              <div class="session-detail-item">
                <span class="session-detail-label">Date:</span>
                <span class="session-detail-value">${mockData.session_date || 'TBD'}</span>
              </div>
            `;
          }
          if (sessionData.showTime) {
            htmlContent += `
              <div class="session-detail-item">
                <span class="session-detail-label">Time:</span>
                <span class="session-detail-value">${mockData.session_time || 'TBD'}</span>
              </div>
            `;
          }
          if (sessionData.showLocation) {
            const locationValue = replacePlaceholders('{session_location}', mockData);
            htmlContent += `
              <div class="session-detail-item">
                <span class="session-detail-label">Location:</span>
                <span class="session-detail-value">${locationValue}</span>
              </div>
            `;
          }
          if (sessionData.showNotes) {
            const customNotes = sessionData.customNotes || "Please arrive 10 minutes early. Bring comfortable outfits!";
            htmlContent += `
              <div class="session-detail-item">
                <span class="session-detail-label">Notes:</span>
                <span class="session-detail-value">${replacePlaceholders(customNotes, mockData)}</span>
              </div>
            `;
          }
          
          htmlContent += `</div>`;
          break;

        case 'divider':
          if (block.data.style === 'line') {
            const color = block.data.color || '#e5e7eb';
            htmlContent += `<hr class="divider-line" style="border-color: ${color};">`;
          } else {
            const height = block.data.height || 20;
            htmlContent += `<div class="divider-space" style="height: ${height}px;"></div>`;
          }
          break;

        case 'social-links':
          // Handle new format: get social channels from organization settings
          if (organizationSettings?.socialChannels) {
            const channelVisibility = block.data.channelVisibility || {};
            const socialChannelsArray = Object.entries(organizationSettings.socialChannels)
              .sort(([, a], [, b]) => ((a as any).order || 0) - ((b as any).order || 0))
              .filter(([key, channel]: [string, any]) => {
                const hasUrl = channel.url?.trim();
                const isVisible = channelVisibility[key] !== false;
                return hasUrl && isVisible;
              });
            
            if (socialChannelsArray.length > 0) {
              htmlContent += `<div class="social-links">`;
              socialChannelsArray.forEach(([key, channel]: [string, any]) => {
                htmlContent += `<a href="${channel.url}">${channel.name}</a>`;
              });
              htmlContent += `</div>`;
            }
          }
          break;

        case 'footer':
          const footerData = block.data;
          
          // Use real organization data if available
          const businessName = organizationSettings?.photography_business_name || mockData.business_name || 'Your Business';
          const businessPhone = organizationSettings?.phone || mockData.business_phone || '+1 (555) 123-4567';
          const businessEmail = organizationSettings?.email || mockData.business_email || `hello@${businessName.toLowerCase().replace(/\s+/g, '')}.com`;
          const logoUrl = organizationSettings?.logo_url;
          
          htmlContent += `<div class="email-footer">`;
          
          if (footerData.showLogo) {
            if (logoUrl) {
              htmlContent += `
                <div style="margin-bottom: 12px;">
                  <img src="${logoUrl}" alt="${businessName} Logo" style="width: 64px; height: auto; max-height: 64px; border-radius: 8px;">
                </div>
              `;
            } else {
              htmlContent += `
                <div class="footer-logo">
                  ${businessName.charAt(0)}
                </div>
              `;
            }
          }
          
          if (footerData.showStudioName && businessName) {
            htmlContent += `
              <div class="footer-business-name">${businessName}</div>
            `;
          }
          
          if (footerData.showContactInfo) {
            if (businessPhone) {
              htmlContent += `<div class="footer-contact">${businessPhone}</div>`;
            }
            if (businessEmail) {
              htmlContent += `<div class="footer-contact">${businessEmail}</div>`;
            }
          }
          
          if (footerData.customText) {
            htmlContent += `<div class="footer-custom-text">${replacePlaceholders(footerData.customText, mockData)}</div>`;
          }
          
          htmlContent += `</div>`;
          break;

        case 'raw-html':
          // Note: In production, this should be sanitized
          htmlContent += block.data.html || '';
          break;
      }
    });

  htmlContent += `
        </div>
      </div>
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">This email was sent by Lumiso. <a href="mailto:hello@updates.lumiso.app?subject=unsubscribe" style="color: #9ca3af;">Unsubscribe</a></p>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

function generatePlainText(blocks: TemplateBlock[], mockData: Record<string, string>): string {
  let plainText = '';

  blocks
    .sort((a, b) => a.order - b.order)
    .forEach(block => {
      switch (block.type) {
        case 'text':
          plainText += replacePlaceholders(block.data.content || '', mockData) + '\n\n';
          break;
        case 'header':
          const headerText = replacePlaceholders(block.data.title || '', mockData);
          plainText += headerText.toUpperCase() + '\n';
          if (block.data.tagline) {
            plainText += replacePlaceholders(block.data.tagline, mockData) + '\n';
          }
          plainText += '='.repeat(headerText.length) + '\n\n';
          break;
        case 'cta':
          const buttonText = replacePlaceholders(block.data.text || 'Click Here', mockData);
          const buttonUrl = replacePlaceholders(block.data.url || '#', mockData);
          plainText += `${buttonText}: ${buttonUrl}\n\n`;
          break;
        case 'session-details':
          plainText += 'SESSION DETAILS\n';
          plainText += '---------------\n';
          if (block.data.showDate) plainText += `Date: ${mockData.session_date || 'TBD'}\n`;
          if (block.data.showTime) plainText += `Time: ${mockData.session_time || 'TBD'}\n`;
          if (block.data.showLocation) plainText += `Location: ${mockData.session_location || 'TBD'}\n`;
          if (block.data.showNotes) plainText += `Notes: Please arrive 10 minutes early. Bring comfortable outfits!\n`;
          plainText += '\n';
          break;
        case 'footer':
          plainText += '\n---\n';
          if (block.data.showStudioName) {
            plainText += `${mockData.business_name || 'Your Business'}\n`;
          }
          if (block.data.showContactInfo) {
            if (mockData.business_phone) plainText += `Phone: ${mockData.business_phone}\n`;
            plainText += `Email: hello@${(mockData.business_name || 'business').toLowerCase().replace(/\s+/g, '')}.com\n`;
          }
          if (block.data.customText) {
            plainText += replacePlaceholders(block.data.customText, mockData) + '\n';
          }
          break;
      }
    });

  return plainText.trim();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: SendEmailRequest = await req.json();
    console.log('Request data:', requestData);
    
    // Handle workflow requests
    if (requestData.template_id && requestData.recipient_email) {
      return await handleWorkflowEmail(requestData);
    }
    
    // Handle template builder requests
    const { to, subject, preheader, blocks, mockData, isTest } = requestData;

    console.log('Template builder - Sending email to:', to);
    console.log('Subject:', subject);
    console.log('Blocks count:', blocks?.length || 0);

    if (!to || !blocks) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to or blocks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization settings for dynamic footer
    let organizationSettings = null;
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Get user from auth header
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          // Get organization settings
          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('active_organization_id')
            .eq('user_id', user.id)
            .single();
          
          if (userSettings?.active_organization_id) {
          const { data: orgSettings } = await supabase
            .from('organization_settings')
            .select('photography_business_name, primary_brand_color, logo_url, phone, email, social_channels')
            .eq('organization_id', userSettings.active_organization_id)
            .single();
            
            organizationSettings = {
              ...orgSettings,
              socialChannels: orgSettings?.social_channels || {}
            };
          }
        }
      }
    } catch (error) {
      console.warn('Could not fetch organization settings:', error);
    }

    // Use default subject if empty
    const finalSubject = subject?.trim() || 'Test Email from Template Builder';

    const htmlContent = generateHTMLContent(blocks, mockData, finalSubject, preheader, organizationSettings, false);
    const textContent = generatePlainText(blocks, mockData);

    // Get business name for sender and use business email as reply-to
    const businessName = organizationSettings?.photography_business_name || 'Lumiso';
    const replyToEmail = organizationSettings?.email || 'hello@updates.lumiso.app';
    
    console.log(`Template builder - Using business name: ${businessName}`);
    console.log(`Template builder - Using reply-to email: ${replyToEmail}`);
    
    const emailData = {
      from: `${businessName} <hello@updates.lumiso.app>`,
      reply_to: replyToEmail,
      to: [to],
      subject: replacePlaceholders(finalSubject, mockData),
      html: htmlContent,
      text: textContent,
      headers: {
        'List-Unsubscribe': '<mailto:hello@updates.lumiso.app?subject=unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'Lumiso Template System',
        'X-Priority': '3',
        'X-Auto-Response-Suppress': 'OOF',
      },
    };

    console.log('Sending email with Resend to:', to);
    const emailResponse = await resend.emails.send(emailData);

    console.log('Email sent successfully:', emailResponse);

    // Log the email send (optional)
    if (!isTest) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('email_logs').insert({
          recipient: to,
          subject: emailData.subject,
          status: 'sent',
          provider: 'resend',
          provider_id: emailResponse.data?.id,
        });
      } catch (logError) {
        console.warn('Failed to log email:', logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        preview: {
          html: htmlContent,
          text: textContent
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-template-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

async function handleWorkflowEmail(requestData: SendEmailRequest): Promise<Response> {
  try {
    const { template_id, recipient_email, recipient_name, mockData, workflow_execution_id } = requestData;
    
    console.log('Workflow email - Template ID:', template_id);
    console.log('Workflow email - Recipient:', recipient_email);
    console.log('Workflow email - Mock data keys:', Object.keys(mockData || {}));
    console.log('Workflow email - Mock data values:', mockData);

    if (!template_id || !recipient_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template_id or recipient_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template data from message_templates
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Fetching template from message_templates table...');
    
    // Get template with blocks for proper rendering
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select(`
        *,
        template_channel_views!inner (
          channel,
          subject,
          content
        )
      `)
      .eq('id', template_id)
      .eq('template_channel_views.channel', 'email')
      .single();

    console.log('Template fetch result:', template ? 'Found' : 'Not found');
    if (templateError) {
      console.log('Template fetch error:', templateError);
    }

    if (templateError || !template) {
      console.error('Template fetch error:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template not found in message_templates' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Template found:', template.name);
    
    // Get organization settings including social channels
    const { data: orgSettings, error: orgError } = await supabase
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, logo_url, phone, email, date_format, time_format, social_channels')
      .eq('organization_id', template.organization_id)
      .single();

    if (orgError) {
      console.warn('Could not fetch organization settings:', orgError);
    } else {
      console.log('Organization settings loaded:', orgSettings?.photography_business_name || 'No business name');
    }

    // Get email channel view data
    const emailChannelView = template.template_channel_views?.[0];
    if (!emailChannelView) {
      console.warn('No email channel view found');
      return new Response(
        JSON.stringify({ error: 'No email template configuration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailSubject = emailChannelView.subject || template.master_subject || template.name || 'Notification';
    console.log('Email subject before replacement:', emailSubject);

    // Use existing template blocks for consistent rendering with template builder tests
    const blocks: TemplateBlock[] = template.blocks && Array.isArray(template.blocks) ? template.blocks : [];
    
    if (blocks.length === 0) {
      console.warn('No template blocks found - template may not be properly configured');
      return new Response(
        JSON.stringify({ error: 'Template blocks not found or invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using template blocks for workflow email:', blocks.length);

    // Format organization settings to match what the social-links block expects
    const organizationSettings = orgSettings ? {
      ...orgSettings,
      socialChannels: orgSettings.social_channels || {}
    } : null;

    // Use the same HTML generation function as template builder tests
    const finalHtmlContent = generateHTMLContent(
      blocks, 
      mockData || {}, 
      emailSubject, 
      undefined, // no preheader
      organizationSettings,
      false // not preview mode
    );
    
    // Create plain text version using the same function
    const plainTextContent = generatePlainText(blocks, mockData || {});
    
    console.log('Final HTML content length:', finalHtmlContent.length);
    console.log('Final plain text length:', plainTextContent.length);

    // Get business name for sender and use business email as reply-to
    const businessName = orgSettings?.photography_business_name || 'Your Business';
    const replyToEmail = orgSettings?.email || 'hello@updates.lumiso.app';
    
    console.log(`Workflow email - Using business name: ${businessName}`);
    console.log(`Workflow email - Using reply-to email: ${replyToEmail}`);
    
    const emailData = {
      from: `${businessName} <hello@updates.lumiso.app>`,
      reply_to: replyToEmail,
      to: [recipient_email],
      subject: replacePlaceholders(emailSubject, mockData || {}),
      html: finalHtmlContent,
      text: plainTextContent,
      headers: {
        'List-Unsubscribe': '<mailto:hello@updates.lumiso.app?subject=unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'Lumiso Template System',
        'X-Priority': '3',
        'X-Auto-Response-Suppress': 'OOF',
        'X-Template-ID': template_id,
        'X-Workflow-Execution': workflow_execution_id || 'none',
      },
    };

    console.log('Sending workflow email with subject:', replacePlaceholders(emailSubject, mockData || {}));
    console.log('HTML content length:', finalHtmlContent.length);
    
    const emailResponse = await resend.emails.send(emailData);
    console.log('Workflow email sent successfully. Email ID:', emailResponse.data?.id);

    // Log the email send
    try {
      await supabase.from('notification_logs').insert({
        organization_id: template.organization_id,
        user_id: template.user_id,
        notification_type: 'workflow-email',
        status: 'sent',
        email_id: emailResponse.data?.id,
        metadata: {
          template_id,
          template_name: template.name,
          recipient_email,
          recipient_name,
          workflow_execution_id,
          subject: emailData.subject,
          business_name: businessName,
          variable_count: Object.keys(mockData || {}).length
        }
      });
    } catch (logError) {
      console.warn('Failed to log workflow email:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        message: 'Workflow email sent successfully',
        template_name: template.name,
        recipient: recipient_email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in handleWorkflowEmail:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack,
        context: 'handleWorkflowEmail'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Fallback function for templates without blocks
async function sendSimpleTextEmail(
  template: any, 
  recipient_email: string, 
  recipient_name: string | undefined, 
  mockData: Record<string, string> | undefined,
  workflow_execution_id: string | undefined,
  supabase: any
): Promise<Response> {
  console.log('Sending simple text email fallback');
  
  // Get organization settings
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('photography_business_name, email')
    .eq('organization_id', template.organization_id)
    .single();

  const businessName = orgSettings?.photography_business_name || 'Your Business';
  const content = replacePlaceholders(template.master_content || 'No content available', mockData || {});
  
  // Create simple HTML structure
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${template.name}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="white-space: pre-wrap;">${content}</div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 14px; color: #666; text-align: center;">
        This email was sent by ${businessName}
      </p>
    </body>
    </html>
  `;

  const emailData = {
    from: `${businessName} <hello@updates.lumiso.app>`,
    reply_to: orgSettings?.email || 'hello@updates.lumiso.app',
    to: [recipient_email],
    subject: template.name || 'Notification',
    html: htmlContent,
    text: content,
  };

  const emailResponse = await resend.emails.send(emailData);
  console.log('Simple text email sent successfully');

  return new Response(
    JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      message: 'Simple text email sent successfully'
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(handler);