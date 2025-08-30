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
  to: string;
  subject: string;
  preheader?: string;
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
  isTest?: boolean;
}

function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
}

function generateHTMLContent(
  blocks: TemplateBlock[], 
  mockData: Record<string, string>, 
  subject: string,
  preheader?: string
): string {
  const baseStyles = `
    <style>
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        line-height: 1.6; 
        color: #333; 
        margin: 0; 
        padding: 0; 
        background-color: #f4f4f4;
      }
      .container { 
        max-width: 600px; 
        margin: 0 auto; 
        background: #fff; 
        padding: 20px;
      }
      .header { 
        text-align: center; 
        margin-bottom: 30px; 
        padding-bottom: 20px; 
        border-bottom: 2px solid #eee;
      }
      .text-block { 
        margin-bottom: 20px; 
      }
      .cta-button { 
        display: inline-block; 
        padding: 12px 24px; 
        text-decoration: none; 
        border-radius: 4px; 
        font-weight: bold;
      }
      .cta-primary { 
        background-color: #007bff; 
        color: white; 
      }
      .cta-secondary { 
        background-color: #6c757d; 
        color: white; 
      }
      .image-block { 
        text-align: center; 
        margin: 20px 0; 
      }
      .image-block img { 
        max-width: 100%; 
        height: auto; 
      }
      .footer { 
        margin-top: 40px; 
        padding-top: 20px; 
        border-top: 1px solid #eee; 
        font-size: 14px; 
        color: #666; 
      }
      .divider { 
        margin: 30px 0; 
        border-top: 1px solid #ddd; 
      }
      .social-links { 
        text-align: center; 
        margin: 20px 0; 
      }
      .social-links a { 
        margin: 0 10px; 
        text-decoration: none; 
      }
    </style>
  `;

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${replacePlaceholders(subject, mockData)}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
  `;

  if (preheader) {
    htmlContent += `
      <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${replacePlaceholders(preheader, mockData)}
      </div>
    `;
  }

  blocks
    .sort((a, b) => a.order - b.order)
    .forEach(block => {
      switch (block.type) {
        case 'text':
          const textContent = replacePlaceholders(block.data.content || '', mockData);
          const alignment = block.data.alignment || 'left';
          const fontSize = block.data.fontSize || '16px';
          const fontWeight = block.data.fontWeight || 'normal';
          
          htmlContent += `
            <div class="text-block" style="text-align: ${alignment}; font-size: ${fontSize}; font-weight: ${fontWeight};">
              ${textContent.replace(/\n/g, '<br>')}
            </div>
          `;
          break;

        case 'header':
          const headerText = replacePlaceholders(block.data.title || '', mockData);
          const tagline = block.data.tagline ? replacePlaceholders(block.data.tagline, mockData) : '';
          
          htmlContent += `
            <div class="header">
              ${block.data.showLogo && block.data.logoUrl ? `<img src="${block.data.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
              <h1 style="margin: 0; color: #333;">${headerText}</h1>
              ${tagline ? `<p style="margin: 5px 0 0 0; color: #666;">${tagline}</p>` : ''}
            </div>
          `;
          break;

        case 'cta':
          const buttonText = replacePlaceholders(block.data.text || 'Click Here', mockData);
          const buttonUrl = replacePlaceholders(block.data.url || '#', mockData);
          const variant = block.data.variant || 'primary';
          
          htmlContent += `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${buttonUrl}" class="cta-button cta-${variant}" style="color: white;">${buttonText}</a>
            </div>
          `;
          break;

        case 'image':
          if (block.data.imageUrl || block.data.placeholderUrl) {
            const imageUrl = block.data.imageUrl || block.data.placeholderUrl;
            const caption = block.data.caption ? replacePlaceholders(block.data.caption, mockData) : '';
            
            htmlContent += `
              <div class="image-block">
                <img src="${imageUrl}" alt="${caption || 'Image'}" style="max-width: 100%; height: auto;">
                ${caption ? `<p style="margin-top: 10px; font-size: 14px; color: #666; font-style: italic;">${caption}</p>` : ''}
              </div>
            `;
          }
          break;

        case 'session-details':
          const sessionData = block.data;
          htmlContent += `
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Session Details</h3>
              ${sessionData.showDate ? `<p><strong>Date:</strong> ${mockData.session_date || 'TBD'}</p>` : ''}
              ${sessionData.showTime ? `<p><strong>Time:</strong> ${mockData.session_time || 'TBD'}</p>` : ''}
              ${sessionData.showLocation ? `<p><strong>Location:</strong> ${mockData.session_location || 'TBD'}</p>` : ''}
              ${sessionData.showNotes ? `<p><strong>Notes:</strong> ${mockData.session_notes || 'None'}</p>` : ''}
            </div>
          `;
          break;

        case 'divider':
          if (block.data.type === 'line') {
            htmlContent += `<hr class="divider">`;
          } else {
            htmlContent += `<div style="height: ${block.data.spacing || '20'}px;"></div>`;
          }
          break;

        case 'social-links':
          const socialLinks = block.data.links || [];
          const visibleLinks = socialLinks.filter((link: any) => link.show && link.url);
          
          if (visibleLinks.length > 0) {
            htmlContent += `<div class="social-links">`;
            visibleLinks.forEach((link: any) => {
              htmlContent += `<a href="${link.url}" style="color: #007bff;">${link.platform}</a>`;
            });
            htmlContent += `</div>`;
          }
          break;

        case 'footer':
          const footerData = block.data;
          htmlContent += `
            <div class="footer">
              ${footerData.showLogo && footerData.logoUrl ? `<img src="${footerData.logoUrl}" alt="Logo" style="max-height: 40px; margin-bottom: 10px;">` : ''}
              ${footerData.showStudioName ? `<p><strong>${mockData.business_name || 'Your Business'}</strong></p>` : ''}
              ${footerData.showContact ? `<p>Email: ${mockData.business_email || 'contact@business.com'} | Phone: ${mockData.business_phone || '(555) 123-4567'}</p>` : ''}
              ${footerData.customText ? `<p>${replacePlaceholders(footerData.customText, mockData)}</p>` : ''}
            </div>
          `;
          break;

        case 'raw-html':
          htmlContent += block.data.content || '';
          break;
      }
    });

  htmlContent += `
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
          if (block.data.showNotes) plainText += `Notes: ${mockData.session_notes || 'None'}\n`;
          plainText += '\n';
          break;
        case 'footer':
          plainText += '\n---\n';
          if (block.data.showStudioName) {
            plainText += `${mockData.business_name || 'Your Business'}\n`;
          }
          if (block.data.showContact) {
            plainText += `Email: ${mockData.business_email || 'contact@business.com'}\n`;
            plainText += `Phone: ${mockData.business_phone || '(555) 123-4567'}\n`;
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
    const { to, subject, preheader, blocks, mockData, isTest }: SendEmailRequest = await req.json();

    console.log('Sending email to:', to);
    console.log('Subject:', subject);
    console.log('Blocks count:', blocks?.length || 0);

    if (!to || !blocks) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to or blocks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use default subject if empty
    const finalSubject = subject?.trim() || 'Test Email from Template Builder';

    const htmlContent = generateHTMLContent(blocks, mockData, finalSubject, preheader);
    const textContent = generatePlainText(blocks, mockData);

    const emailData = {
      from: 'Template System <onboarding@resend.dev>',
      to: [to],
      subject: replacePlaceholders(finalSubject, mockData),
      html: htmlContent,
      text: textContent,
    };

    console.log('Sending email with Resend...');
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

serve(handler);