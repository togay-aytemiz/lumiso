import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  templateName: string;
  subject: string;
  content: string;
  recipientEmail: string;
  organizationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { templateName, subject, content, recipientEmail, organizationId }: TestEmailRequest = await req.json();

    // Fetch organization settings for branding
    const { data: orgSettings } = await supabaseClient
      .from('organization_settings')
      .select('photography_business_name, primary_brand_color, logo_url')
      .eq('organization_id', organizationId)
      .single();

    // Replace placeholders with real data from organization and sample client data
    const sampleData = {
      // Client/Lead related (from leads table)
      '{{client_name}}': 'Sarah Johnson',
      '{{customer_name}}': 'Sarah Johnson', 
      '{{lead_name}}': 'Sarah Johnson',
      '{{customer_email}}': 'sarah.johnson@example.com',
      '{{client_email}}': 'sarah.johnson@example.com',
      '{{customer_phone}}': '+1 (555) 123-4567',
      '{{client_phone}}': '+1 (555) 123-4567',
      
      // Session related (from sessions table)
      '{{session_type}}': 'Newborn Photography Session',
      '{{session_date}}': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      '{{session_time}}': '2:00 PM',
      '{{session_location}}': orgSettings?.photography_business_name ? `${orgSettings.photography_business_name} Studio` : 'Photography Studio',
      
      // Studio/Organization related (from organization_settings)
      '{{studio_name}}': orgSettings?.photography_business_name || 'Your Photography Studio',
      '{{business_name}}': orgSettings?.photography_business_name || 'Your Photography Studio',
      '{{studio_phone}}': '+1 (555) 987-6543',
      '{{studio_email}}': 'hello@yourstudio.com',
      
      // Project related 
      '{{project_name}}': 'Newborn Session - Johnson Family',
      
      // Booking/Links
      '{{booking_link}}': 'https://yourstudio.com/book',
      '{{reschedule_link}}': 'https://yourstudio.com/reschedule',
      '{{gallery_link}}': 'https://yourstudio.com/gallery/johnson-newborn',
      
      // Payment related (from payments table)
      '{{payment_amount}}': '$650.00',
      '{{payment_due_date}}': new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      }),
      '{{total_amount}}': '$650.00',
      '{{remaining_balance}}': '$325.00',
      
      // Reminder related
      '{{reminder_title}}': 'Session Preparation Reminder',
      '{{reminder_date}}': new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };

    let emailContent = content;
    let emailSubject = subject;

    // Replace all placeholders
    Object.entries(sampleData).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      emailContent = emailContent.replace(regex, value);
      emailSubject = emailSubject.replace(regex, value);
    });

    // Initialize Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Send email with identical format to EmailPreview
    const emailResponse = await resend.emails.send({
      from: `${orgSettings?.photography_business_name || 'Your Photography Studio'} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject: emailSubject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header Banner -->
          <div style="position: relative; height: 128px; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div style="position: absolute; bottom: 16px; left: 24px; color: white;">
              <h2 style="font-size: 18px; font-weight: bold; margin: 0;">${orgSettings?.photography_business_name || 'Your Photography Studio'}</h2>
              <p style="font-size: 12px; opacity: 0.9; margin: 4px 0 0 0;">Professional Photography</p>
            </div>
          </div>
          
          <!-- Email Content -->
          <div style="padding: 24px;">
            <div style="color: #334155; line-height: 1.6; font-size: 15px; white-space: pre-wrap;">${emailContent}</div>
          </div>
          
          <!-- Professional Footer -->
          <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
              <div>
                <strong>${orgSettings?.photography_business_name || 'Your Photography Studio'}</strong>
                <div style="margin-top: 4px;">Professional Photography Services</div>
              </div>
              <div style="text-align: right;">
                <div>${new Date().toLocaleDateString()}</div>
                <div style="margin-top: 4px; color: #94a3b8;">Powered by Photography CRM</div>
              </div>
            </div>
          </div>
          
          <!-- Brand Color Accent -->
          <div style="height: 4px; background-color: ${orgSettings?.primary_brand_color || '#1EB29F'};"></div>
        </div>
      `,
    });

    console.log("Test email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email sent successfully",
      emailId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error sending test email:", error);
    return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message || "Failed to send email" 
        }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);