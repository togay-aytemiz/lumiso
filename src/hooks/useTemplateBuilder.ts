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

interface DatabaseTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  preheader: string | null;
  blocks: any; // JSON from database
  status: string;
  category: string;
  created_at: string;
  updated_at: string;
  last_saved_at: string | null;
  published_at: string | null;
  user_id: string;
  organization_id: string;
}

export function useTemplateBuilder(templateId?: string) {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { activeOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  // Auto-save functionality
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

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

  const saveTemplate = useCallback(async (templateData: Partial<EmailTemplate>, showToast = true) => {
    if (!activeOrganization?.id || !user?.id) return null;

    try {
      setSaving(true);

      const payload: any = {
        ...templateData,
        user_id: user.id,
        organization_id: activeOrganization.id,
        last_saved_at: new Date().toISOString(),
        blocks: templateData.blocks ? JSON.stringify(templateData.blocks) : undefined,
      };

      let result;
      if (templateId) {
        // Update existing template
        const { data, error } = await supabase
          .from("email_templates")
          .update(payload)
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
          .insert(payload)
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
  }, [templateId, activeOrganization?.id, user?.id, toast]);

  const publishTemplate = useCallback(async () => {
    if (!template) return;

    try {
      const updatedTemplate = await saveTemplate({
        ...template,
        status: 'published',
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

  const deleteTemplate = useCallback(async () => {
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

  // Auto-save with debouncing
  const scheduleAutoSave = useCallback((templateData: Partial<EmailTemplate>) => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      // Save to localStorage only for auto-save, not to database
      const draftData = {
        ...templateData,
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem('template-builder-draft', JSON.stringify(draftData));
      setLastSaved(new Date());
    }, 3000); // Auto-save to localStorage after 3 seconds of inactivity

    setAutoSaveTimeout(timeout);
  }, [autoSaveTimeout]);

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
      scheduleAutoSave(newTemplate);
      return;
    }

    const updatedTemplate = { ...template, ...updates };
    setTemplate(updatedTemplate);
    scheduleAutoSave(updatedTemplate);
  }, [template, scheduleAutoSave]);

  // Load template on mount
  useEffect(() => {
    if (templateId) {
      loadTemplate();
      // Clear localStorage draft when loading existing template
      localStorage.removeItem('template-builder-draft');
    } else {
      // For new templates, start with empty state (don't load from localStorage for now)
      // Clear any existing draft to start fresh
      localStorage.removeItem('template-builder-draft');
    }
  }, [loadTemplate, templateId]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  return {
    template,
    loading,
    saving,
    lastSaved,
    saveTemplate,
    publishTemplate,
    deleteTemplate,
    updateTemplate,
    loadTemplate,
  };
}