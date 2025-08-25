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

    // Replace placeholders with sample data - using known org data where possible
    const sampleData = {
      '{{customer_name}}': 'John Smith',
      '{{customer_email}}': 'john.smith@example.com',
      '{{customer_phone}}': '(555) 123-4567',
      '{{session_type}}': 'Wedding Photography',
      '{{session_date}}': 'March 15, 2024',
      '{{session_time}}': '2:00 PM',
      '{{session_location}}': 'Central Park, New York',
      '{{studio_name}}': orgSettings?.photography_business_name || 'Your Photography Studio',
      '{{studio_phone}}': '(555) 987-6543',
      '{{studio_email}}': 'hello@yourstudio.com',
      '{{booking_link}}': 'https://yourstudio.com/book',
      '{{reschedule_link}}': 'https://yourstudio.com/reschedule',
      '{{payment_amount}}': '$1,200',
      '{{payment_due_date}}': 'April 1, 2024',
      '{{project_name}}': 'Sample Wedding Project',
      '{{client_name}}': 'John Smith',
      '{{lead_name}}': 'John Smith',
      '{{reminder_title}}': 'Sample Reminder',
      '{{reminder_date}}': 'March 20, 2024'
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

    // Send test email
    const emailResponse = await resend.emails.send({
      from: `${orgSettings?.photography_business_name || 'Your Studio'} <onboarding@resend.dev>`,
      to: [recipientEmail],
      subject: `[TEST] ${emailSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">📧 Test Email Preview</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">This is a test of your template: "${templateName}"</p>
          </div>
          <div style="padding: 30px; background: white; border-left: 4px solid ${orgSettings?.primary_brand_color || '#1EB29F'};">
            <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">${emailContent}</div>
          </div>
          <div style="padding: 20px; background: #f8f9fa; text-align: center; font-size: 12px; color: #666;">
            <p>This was a test email sent from your template system.</p>
            <p style="margin: 0;">Template: ${templateName} | Organization: ${organizationId}</p>
          </div>
        </div>
      `,
    });

    console.log("Test email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Test email sent successfully",
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
        error: error.message || "Failed to send test email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);