import type { TemplateBlock } from "@/types/templateBuilder";
import type { Json } from "@/integrations/supabase/types";

// Unified template interface for the entire application
export interface Template {
  id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject?: string;
  preheader?: string;
  placeholders?: string[];
  is_active: boolean;
  status?: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
  channels?: {
    email?: {
      subject?: string;
      content?: string;
      html_content?: string;
      metadata?: Record<string, unknown> | null;
    };
    sms?: {
      content?: string;
      metadata?: Record<string, unknown> | null;
    };
    whatsapp?: {
      content?: string;
      metadata?: Record<string, unknown> | null;
    };
  };
}

// Template for template builder with additional UI fields
export interface TemplateBuilderData extends Omit<Template, 'channels'> {
  description?: string;
  subject?: string;
  blocks?: TemplateBlock[]; // For UI editing only, not stored in DB
  status: 'draft' | 'published';
  published_at?: string | null;
  last_saved_at?: string | null;
  channels?: Template['channels'];
}

// Database template structure (what comes from Supabase)
export interface DatabaseTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject: string | null;
  preheader?: string | null;
  placeholders: Json | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
  template_channel_views?: Array<{
    channel: string;
    subject?: string;
    content?: string;
    html_content?: string;
    metadata?: Record<string, unknown> | null;
  }>;
}

// Template channel view structure
export interface TemplateChannelView {
  id?: string;
  template_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  content?: string;
  html_content?: string;
  metadata?: Record<string, unknown> | null;
}
