import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { TemplateBlock } from "@/types/templateBuilder";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  preheader: string | null;
  blocks: TemplateBlock[];
  status: 'draft' | 'published';
  category: string;
  created_at: string;
  updated_at: string;
  last_saved_at: string | null;
  published_at?: string | null;
}

interface UseOptimizedTemplateBuilderReturn {
  template: EmailTemplate | null;
  loading: boolean;
  saving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  saveTemplate: (templateData: Partial<EmailTemplate>, showToast?: boolean) => Promise<EmailTemplate | null>;
  publishTemplate: (templateData?: Partial<EmailTemplate>) => Promise<EmailTemplate | null>;
  deleteTemplate: () => Promise<boolean>;
  updateTemplate: (updates: Partial<EmailTemplate>) => void;
  loadTemplate: () => Promise<void>;
  resetDirtyState: () => void;
}

export function useOptimizedTemplateBuilder(templateId?: string): UseOptimizedTemplateBuilderReturn {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
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
            channel, subject, content, html_content
          )
        `)
        .eq("id", templateId)
        .eq("organization_id", activeOrganization.id)
        .single();

      if (error) throw error;

      // Transform database data to our interface
      const emailChannel = data.template_channel_views?.find((v: any) => v.channel === 'email');
      const transformedTemplate: EmailTemplate = {
        id: data.id,
        name: data.name,
        description: data.master_content?.substring(0, 200) || null,
        subject: emailChannel?.subject || data.master_subject || '',
        preheader: '', // Will be extracted from blocks if needed
        blocks: [], // Will be populated from HTML content if needed
        status: data.is_active ? 'published' : 'draft',
        category: data.category,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_saved_at: data.updated_at,
        published_at: data.is_active ? data.updated_at : null,
      };

      setTemplate(transformedTemplate);
      setIsDirty(false);
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

  const saveTemplate = useCallback(async (templateData: Partial<EmailTemplate>, showToast = true): Promise<EmailTemplate | null> => {
    if (!activeOrganization?.id || !user?.id) return null;

    try {
      setSaving(true);

      // Merge current template data with updates
      const dataToSave = template ? { ...template, ...templateData } : templateData;

      const messageTemplatePayload = {
        name: dataToSave.name || 'Untitled Template',
        category: dataToSave.category || 'general',
        master_content: dataToSave.description || '',
        master_subject: dataToSave.subject || '',
        placeholders: [], // Will be extracted from content
        is_active: dataToSave.status === 'published',
        organization_id: activeOrganization.id,
        user_id: user.id,
      };

      let result;
      if (templateId && template) {
        // Update existing template
        const { data, error } = await supabase
          .from("message_templates")
          .update(messageTemplatePayload)
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
          .insert(messageTemplatePayload)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Create or update email channel view
      const emailChannelData = {
        template_id: result.id,
        channel: 'email',
        subject: dataToSave.subject || '',
        content: dataToSave.description || '',
        html_content: JSON.stringify(dataToSave.blocks || [])
      };

      const { error: channelError } = await supabase
        .from("template_channel_views")
        .upsert(emailChannelData);

      if (channelError) {
        console.warn('Error saving channel view:', channelError);
      }

      // Transform result back to EmailTemplate interface
      const transformedResult: EmailTemplate = {
        id: result.id,
        name: result.name,
        description: result.master_content?.substring(0, 200) || null,
        subject: dataToSave.subject || '',
        preheader: dataToSave.preheader || '',
        blocks: dataToSave.blocks || [],
        status: result.is_active ? 'published' : 'draft',
        category: result.category,
        created_at: result.created_at,
        updated_at: result.updated_at,
        last_saved_at: result.updated_at,
        published_at: result.is_active ? result.updated_at : null,
      };

      result = transformedResult;

      setTemplate(result);
      setLastSaved(new Date());
      setIsDirty(false);

      if (showToast) {
        toast({
          title: "Saved",
          description: "Template saved successfully",
        });
      }

      return result;
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
  }, [templateId, template, activeOrganization?.id, user?.id, toast]);

  const publishTemplate = useCallback(async (templateData?: Partial<EmailTemplate>): Promise<EmailTemplate | null> => {
    if (!activeOrganization?.id || !user?.id) return null;

    try {
      setSaving(true);

      // Merge current template data with updates and set status to published
      const dataToPublish = template 
        ? { ...template, ...templateData } 
        : { name: 'Untitled Template', blocks: [], ...templateData };

      const publishedTemplate = await saveTemplate({
        ...dataToPublish,
        status: 'published',
        published_at: new Date().toISOString(),
      }, false);

      if (publishedTemplate) {
        toast({
          title: "Published",
          description: "Template published successfully",
        });
      }

      return publishedTemplate;
    } catch (error) {
      console.error("Error publishing template:", error);
      toast({
        title: "Error",
        description: "Failed to publish template",
        variant: "destructive",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [template, activeOrganization?.id, user?.id, saveTemplate, toast]);

  const deleteTemplate = useCallback(async (): Promise<boolean> => {
    if (!templateId || !activeOrganization?.id) return false;

    try {
      // First delete template_channel_views (foreign key dependency)
      const { error: channelError } = await supabase
        .from('template_channel_views')
        .delete()
        .eq('template_id', templateId);

      if (channelError) {
        console.warn('Error deleting channel views:', channelError);
        // Continue with template deletion even if channel views fail
      }

      // Then delete the main template
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

  const updateTemplate = useCallback((updates: Partial<EmailTemplate>) => {
    if (!template) {
      // If no template exists, create a basic one with updates
      const newTemplate: EmailTemplate = {
        id: '',
        name: 'Untitled Template',
        description: null,
        subject: '',
        preheader: '',
        blocks: [],
        status: 'draft',
        category: 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_saved_at: null,
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

  const resetDirtyState = useCallback(() => {
    setIsDirty(false);
  }, []);

  // Load template on mount
  useEffect(() => {
    if (templateId && activeOrganization?.id) {
      loadTemplate();
    }
  }, [templateId, activeOrganization?.id, loadTemplate]);

  return {
    template,
    loading,
    saving,
    lastSaved,
    isDirty,
    saveTemplate,
    publishTemplate,
    deleteTemplate,
    updateTemplate,
    loadTemplate,
    resetDirtyState,
  };
}