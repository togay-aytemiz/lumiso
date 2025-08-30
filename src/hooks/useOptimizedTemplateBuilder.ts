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
  publishTemplate: () => Promise<EmailTemplate | null>;
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
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .eq("organization_id", activeOrganization.id)
        .single();

      if (error) throw error;

      // Transform database data to our interface
      const transformedTemplate: EmailTemplate = {
        ...data,
        blocks: Array.isArray(data.blocks) ? (data.blocks as unknown as TemplateBlock[]) : 
                typeof data.blocks === 'string' ? JSON.parse(data.blocks) : [],
        status: data.status as 'draft' | 'published',
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

      const basePayload = {
        name: dataToSave.name || 'Untitled Template',
        description: dataToSave.description || null,
        subject: dataToSave.subject || null,
        preheader: dataToSave.preheader || null,
        status: dataToSave.status || 'draft',
        category: dataToSave.category || 'general',
        user_id: user.id,
        organization_id: activeOrganization.id,
        last_saved_at: new Date().toISOString(),
        blocks: dataToSave.blocks ? JSON.stringify(dataToSave.blocks) : '[]',
      };

      let result;
      if (templateId && template) {
        // Update existing template
        const { data, error } = await supabase
          .from("email_templates")
          .update(basePayload)
          .eq("id", templateId)
          .eq("organization_id", activeOrganization.id)
          .select()
          .single();

        if (error) throw error;
        result = {
          ...data,
          blocks: Array.isArray(data.blocks) ? (data.blocks as unknown as TemplateBlock[]) : 
                  typeof data.blocks === 'string' ? JSON.parse(data.blocks) : [],
          status: data.status as 'draft' | 'published',
        };
      } else {
        // Create new template
        const { data, error } = await supabase
          .from("email_templates")
          .insert(basePayload)
          .select()
          .single();

        if (error) throw error;
        result = {
          ...data,
          blocks: Array.isArray(data.blocks) ? (data.blocks as unknown as TemplateBlock[]) : 
                  typeof data.blocks === 'string' ? JSON.parse(data.blocks) : [],
          status: data.status as 'draft' | 'published',
        };
      }

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

  const publishTemplate = useCallback(async (): Promise<EmailTemplate | null> => {
    if (!template) return null;

    try {
      const updatedTemplate = await saveTemplate({
        ...template,
        status: 'published',
        published_at: new Date().toISOString(),
      });

      if (updatedTemplate) {
        toast({
          title: "Published",
          description: "Template published successfully",
        });
      }

      return updatedTemplate;
    } catch (error) {
      console.error("Error publishing template:", error);
      toast({
        title: "Error",
        description: "Failed to publish template",
        variant: "destructive",
      });
      return null;
    }
  }, [template, saveTemplate, toast]);

  const deleteTemplate = useCallback(async (): Promise<boolean> => {
    if (!templateId || !activeOrganization?.id) return false;

    try {
      const { error } = await supabase
        .from("email_templates")
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