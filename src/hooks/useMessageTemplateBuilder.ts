import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { TemplateBlock } from "@/types/templateBuilder";
import { useToast } from "@/hooks/use-toast";

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject?: string;
  placeholders?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
  channels?: {
    email?: {
      subject?: string;
      content?: string;
      html_content?: string;
    };
    sms?: {
      content?: string;
    };
    whatsapp?: {
      content?: string;
    };
  };
}

interface DatabaseTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject: string | null;
  placeholders: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
  template_channel_views?: any[];
}

export function useMessageTemplateBuilder(templateId?: string) {
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { activeOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  const loadTemplate = useCallback(async () => {
    if (!templateId || !activeOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("message_templates")
        .select(`
          *,
          template_channel_views(
            channel,
            subject,
            content,
            html_content
          )
        `)
        .eq("id", templateId)
        .eq("organization_id", activeOrganization.id)
        .single();

      if (error) throw error;

      // Transform database data to our interface
      const transformedTemplate: MessageTemplate = {
        ...data,
        placeholders: Array.isArray(data.placeholders) ? data.placeholders : [],
        channels: data.template_channel_views?.reduce((acc: any, view: any) => {
          acc[view.channel] = {
            subject: view.subject,
            content: view.content,
            html_content: view.html_content
          };
          return acc;
        }, {}) || {}
      };

      setTemplate(transformedTemplate);
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        title: "Error",
        description: "Failed to load template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [templateId, activeOrganization?.id, toast]);

  const extractPlaceholdersFromContent = (content: string): string[] => {
    const placeholderRegex = /{([^}]+)}/g;
    const placeholders = new Set<string>();
    let match;
    
    while ((match = placeholderRegex.exec(content)) !== null) {
      placeholders.add(match[1]);
    }
    
    return Array.from(placeholders);
  };

  const saveTemplate = useCallback(async (templateData: Partial<MessageTemplate>, showToast = true) => {
    if (!activeOrganization?.id || !user?.id) return null;

    try {
      setSaving(true);

      // Extract placeholders from master content and channel contents
      const allContent = [
        templateData.master_content || '',
        templateData.master_subject || '',
        templateData.channels?.email?.content || '',
        templateData.channels?.email?.html_content || '',
        templateData.channels?.sms?.content || '',
        templateData.channels?.whatsapp?.content || ''
      ].join(' ');
      
      const extractedPlaceholders = extractPlaceholdersFromContent(allContent);

      // Create payload for message_templates
      const basePayload = {
        name: templateData.name || 'Untitled Template',
        category: templateData.category || 'general',
        master_content: templateData.master_content || '',
        master_subject: templateData.master_subject || null,
        placeholders: extractedPlaceholders,
        is_active: templateData.is_active ?? true,
        user_id: user.id,
        organization_id: activeOrganization.id,
      };

      let result;
      if (templateId) {
        // Update existing template
        const { data, error } = await supabase
          .from("message_templates")
          .update(basePayload)
          .eq("id", templateId)
          .eq("organization_id", activeOrganization.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new template
        const { data, error } = await supabase
          .from("message_templates")
          .insert(basePayload)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Save channel views
      if (templateData.channels && result.id) {
        // Delete existing channel views
        await supabase
          .from("template_channel_views")
          .delete()
          .eq("template_id", result.id);

        // Insert new channel views
        const channelViews = [];
        
        if (templateData.channels.email) {
          channelViews.push({
            template_id: result.id,
            channel: 'email',
            subject: templateData.channels.email.subject || templateData.master_subject,
            content: templateData.channels.email.content || templateData.master_content,
            html_content: templateData.channels.email.html_content || null
          });
        }
        
        if (templateData.channels.sms) {
          channelViews.push({
            template_id: result.id,
            channel: 'sms',
            content: templateData.channels.sms.content || templateData.master_content
          });
        }
        
        if (templateData.channels.whatsapp) {
          channelViews.push({
            template_id: result.id,
            channel: 'whatsapp',
            content: templateData.channels.whatsapp.content || templateData.master_content
          });
        }

        if (channelViews.length > 0) {
          const { error: channelError } = await supabase
            .from("template_channel_views")
            .insert(channelViews);

          if (channelError) throw channelError;
        }
      }

      const finalResult: MessageTemplate = {
        ...result,
        placeholders: extractedPlaceholders,
        channels: templateData.channels || {}
      };

      setTemplate(finalResult);
      setLastSaved(new Date());
      setIsDirty(false);

      if (showToast) {
        toast({
          title: "Saved",
          description: "Template saved successfully",
        });
      }

      return finalResult;
    } catch (error) {
      console.error("Error saving template:", error);
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to save template",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [templateId, activeOrganization?.id, user?.id, toast]);

  const deleteTemplate = useCallback(async () => {
    if (!templateId || !activeOrganization?.id) return false;

    try {
      // Delete channel views first (foreign key constraint)
      await supabase
        .from("template_channel_views")
        .delete()
        .eq("template_id", templateId);

      // Delete main template
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", templateId)
        .eq("organization_id", activeOrganization.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Template deleted successfully",
      });

      return true;
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
      return false;
    }
  }, [templateId, activeOrganization?.id, toast]);

  // Reset dirty state when template is loaded
  const resetDirtyState = useCallback(() => {
    setIsDirty(false);
  }, []);

  const updateTemplate = useCallback((updates: Partial<MessageTemplate>) => {
    if (!template) {
      // If no template exists, create a basic one with updates
      const newTemplate: MessageTemplate = {
        id: '', // Will be set after first save
        name: updates.name || 'Untitled Template',
        category: updates.category || 'general',
        master_content: updates.master_content || '',
        master_subject: updates.master_subject || '',
        placeholders: updates.placeholders || [],
        is_active: updates.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: '',
        organization_id: '',
        ...updates,
      };
      setTemplate(newTemplate);
      setIsDirty(true);
      return;
    }

    const updatedTemplate = { ...template, ...updates };
    setTemplate(updatedTemplate);
    setIsDirty(true);
  }, [template]);

  // Load template on mount - only when templateId changes
  useEffect(() => {
    if (templateId) {
      loadTemplate();
    }
  }, [templateId, activeOrganization?.id]);

  return {
    template,
    loading,
    saving,
    lastSaved,
    isDirty,
    saveTemplate,
    deleteTemplate,
    updateTemplate,
    loadTemplate,
    resetDirtyState,
  };
}