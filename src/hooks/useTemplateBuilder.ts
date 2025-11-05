import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Template, TemplateBuilderData, DatabaseTemplate, TemplateChannelView } from "@/types/template";
import { TemplateBlock } from "@/types/templateBuilder";
import { blocksToHTML, blocksToPlainText, blocksToMasterContent, htmlToBlocks } from "@/lib/templateBlockUtils";

interface UseTemplateBuilderReturn {
  template: TemplateBuilderData | null;
  loading: boolean;
  saving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  saveTemplate: (templateData: Partial<TemplateBuilderData>, showToast?: boolean) => Promise<TemplateBuilderData | null>;
  publishTemplate: (templateData?: Partial<TemplateBuilderData>) => Promise<TemplateBuilderData | null>;
  deleteTemplate: () => Promise<boolean>;
  updateTemplate: (updates: Partial<TemplateBuilderData>) => void;
  loadTemplate: () => Promise<void>;
  resetDirtyState: () => void;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "An unexpected error occurred";
};

type TemplateChannels = NonNullable<TemplateBuilderData["channels"]>;

// Extract placeholders from text content
const extractPlaceholders = (content: string): string[] => {
  const placeholderRegex = /{([^}]+)}/g;
  const placeholders = new Set<string>();
  let match;
  
  while ((match = placeholderRegex.exec(content)) !== null) {
    placeholders.add(match[1]);
  }
  
  return Array.from(placeholders);
};

// Transform database template to builder data
const transformToBuilderData = (
  dbTemplate: DatabaseTemplate & { blocks?: unknown }
): TemplateBuilderData => {
  const emailChannel = dbTemplate.template_channel_views?.find(v => v.channel === 'email');
  
  // Load blocks from database or try to parse from HTML content
  let blocks: TemplateBlock[] = [];
  
  if (Array.isArray(dbTemplate.blocks)) {
    blocks = dbTemplate.blocks as TemplateBlock[];
  } else if (emailChannel?.html_content) {
    // Try to parse blocks from HTML content (fallback)
    blocks = htmlToBlocks(emailChannel.html_content);
  } else if (dbTemplate.master_content) {
    // Create basic text block from master content
    blocks = [{
      id: `text-${Date.now()}`,
      type: 'text',
      data: {
        content: dbTemplate.master_content,
        formatting: {
          fontSize: 'p' as const,
          alignment: 'left' as const
        }
      },
      visible: true,
      order: 0
    }];
  }
  
  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    category: dbTemplate.category,
    master_content: dbTemplate.master_content,
    master_subject: dbTemplate.master_subject || undefined,
    placeholders: Array.isArray(dbTemplate.placeholders) ? dbTemplate.placeholders : [],
    is_active: dbTemplate.is_active,
    created_at: dbTemplate.created_at,
    updated_at: dbTemplate.updated_at,
    user_id: dbTemplate.user_id,
    organization_id: dbTemplate.organization_id,
    // UI-specific fields
    description: dbTemplate.master_content?.substring(0, 200) || undefined,
    subject: emailChannel?.subject || dbTemplate.master_subject || '',
    preheader: '', // Will be extracted from blocks if needed
    blocks: blocks,
    status: dbTemplate.is_active ? 'published' : 'draft',
    published_at: dbTemplate.is_active ? dbTemplate.updated_at : null,
    last_saved_at: dbTemplate.updated_at,
    channels:
      dbTemplate.template_channel_views?.reduce<TemplateChannels>((acc, view) => {
        const { channel, subject, content, html_content } = view as TemplateChannelView;
        acc[channel] = {
          subject: subject ?? undefined,
          content: content ?? undefined,
          html_content: html_content ?? undefined
        };
        return acc;
      }, {} as TemplateChannels) || {}
  };
};

export function useTemplateBuilder(templateId?: string): UseTemplateBuilderReturn {
  const [template, setTemplate] = useState<TemplateBuilderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  const loadTemplate = useCallback(async () => {
    if (!templateId || !activeOrganizationId) return;

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
        .eq("organization_id", activeOrganizationId)
        .single();

      if (error) throw error;

      const transformedTemplate = transformToBuilderData(data);
      setTemplate(transformedTemplate);
      setIsDirty(false);
    } catch (error: unknown) {
      console.error("Error loading template:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [templateId, activeOrganizationId, toast]);

  const saveTemplate = useCallback(async (
    templateData: Partial<TemplateBuilderData>, 
    showToast = true
  ): Promise<TemplateBuilderData | null> => {
    if (!activeOrganizationId || !user?.id) return null;

    try {
      setSaving(true);

      // Merge current template data with updates
      const mergedData = template ? { ...template, ...templateData } : templateData;

      // Generate content from blocks if blocks exist
      const blocks = mergedData.blocks || [];
      let generatedMasterContent = '';
      let generatedHtmlContent = '';
      
      if (blocks.length > 0) {
        generatedMasterContent = blocksToMasterContent(blocks);
        generatedHtmlContent = blocksToHTML(blocks);
      }

      // Extract placeholders from all content including blocks
      const allContent = [
        generatedMasterContent || mergedData.master_content || '',
        mergedData.subject || '',
        mergedData.channels?.email?.content || '',
        mergedData.channels?.sms?.content || '',
        mergedData.channels?.whatsapp?.content || ''
      ].join(' ');
      
      const extractedPlaceholders = extractPlaceholders(allContent);

      // Prepare template payload with blocks
      const templatePayload = {
        name: mergedData.name || 'Untitled Template',
        category: mergedData.category || 'general',
        master_content: generatedMasterContent || mergedData.master_content || mergedData.description || '',
        master_subject: mergedData.master_subject || mergedData.subject || '',
        placeholders: extractedPlaceholders,
        is_active: mergedData.status === 'published',
        organization_id: activeOrganizationId,
        user_id: user.id,
        blocks: blocks, // Store blocks as JSON
      };

      let result;
      if (templateId && template) {
        // Update existing template
        const { data, error } = await supabase
          .from("message_templates")
          .update(templatePayload)
          .eq("id", templateId)
          .eq("organization_id", activeOrganizationId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new template
        const { data, error } = await supabase
          .from("message_templates")
          .insert(templatePayload)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Save channel views - always update/create email channel with generated HTML
      // Delete existing channel views first
      await supabase
        .from("template_channel_views")
        .delete()
        .eq("template_id", result.id);

      // Prepare channel views with generated content
      const channelViews = [];
      
      // Always create email channel view with generated HTML content
      channelViews.push({
        template_id: result.id,
        channel: 'email',
        subject: mergedData.subject || mergedData.master_subject || mergedData.name || 'Subject',
        content: generatedMasterContent || mergedData.master_content || '',
        html_content: generatedHtmlContent || null
      });
      
      // Add other channels if they exist
      if (mergedData.channels) {
        const channelEntries = Object.entries(mergedData.channels) as Array<
          [keyof TemplateChannels, TemplateChannels[keyof TemplateChannels]]
        >;

        channelEntries.forEach(([channel, channelData]) => {
          if (channel !== 'email' && channelData && (channelData.subject || channelData.content || channelData.html_content)) {
            channelViews.push({
              template_id: result.id,
              channel,
              subject: channelData.subject || null,
              content: channelData.content || null,
              html_content: channelData.html_content || null
            });
          }
        });
      }

      if (channelViews.length > 0) {
        const { error: channelError } = await supabase
          .from("template_channel_views")
          .insert(channelViews);

        if (channelError) {
          console.warn('Error saving channel views:', channelError);
        }
      }

      // Transform result back to TemplateBuilderData
      const savedTemplate: TemplateBuilderData = {
        ...result,
        placeholders: extractedPlaceholders,
        description: result.master_content?.substring(0, 200) || undefined,
        subject: mergedData.subject || result.master_subject || '',
        preheader: mergedData.preheader || '',
        blocks: mergedData.blocks || [],
        status: result.is_active ? 'published' : 'draft',
        published_at: result.is_active ? result.updated_at : null,
        last_saved_at: result.updated_at,
        channels: mergedData.channels || {}
      };

      setTemplate(savedTemplate);
      setLastSaved(new Date());
      setIsDirty(false);

      if (showToast) {
        toast({
          title: "Saved",
          description: "Template saved successfully",
        });
      }

      return savedTemplate;
    } catch (error: unknown) {
      console.error("Error saving template:", error);
      if (showToast) {
        toast({
          title: "Error",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [templateId, template, activeOrganizationId, user?.id, toast]);

  const publishTemplate = useCallback(async (
    templateData?: Partial<TemplateBuilderData>
  ): Promise<TemplateBuilderData | null> => {
    try {
      setSaving(true);

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
    } catch (error: unknown) {
      console.error("Error publishing template:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [template, saveTemplate, toast]);

  const deleteTemplate = useCallback(async (): Promise<boolean> => {
    if (!templateId || !activeOrganizationId) return false;

    try {
      // Delete channel views first (foreign key dependency)
      const { error: channelError } = await supabase
        .from('template_channel_views')
        .delete()
        .eq('template_id', templateId);

      if (channelError) {
        console.warn('Error deleting channel views:', channelError);
      }

      // Then delete the main template
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", templateId)
        .eq("organization_id", activeOrganizationId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Template deleted successfully",
      });

      return true;
    } catch (error: unknown) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      return false;
    }
  }, [templateId, activeOrganizationId, toast]);

  const updateTemplate = useCallback((updates: Partial<TemplateBuilderData>) => {
    if (!template) {
      // Create a basic template with updates
      const newTemplate: TemplateBuilderData = {
        id: '',
        name: 'Untitled Template',
        category: 'general',
        master_content: '',
        placeholders: [],
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: '',
        organization_id: '',
        subject: '',
        preheader: '',
        blocks: [],
        status: 'draft',
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
    if (templateId && activeOrganizationId) {
      loadTemplate();
    }
  }, [templateId, activeOrganizationId, loadTemplate]);

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
