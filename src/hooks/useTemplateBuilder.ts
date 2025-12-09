import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Template, TemplateBuilderData, DatabaseTemplate, TemplateChannelView } from "@/types/template";
import { TemplateBlock } from "@/types/templateBuilder";
import { blocksToHTML, blocksToMasterContent, htmlToBlocks } from "@/lib/templateBlockUtils";
import { useTranslation } from "react-i18next";

interface UseTemplateBuilderReturn {
  template: TemplateBuilderData | null;
  loading: boolean;
  saving: boolean;
  lastSaved: Date | null;
  dirtyVersion: number;
  isDirty: boolean;
  saveTemplate: (templateData: Partial<TemplateBuilderData>, showToast?: boolean) => Promise<TemplateBuilderData | null>;
  publishTemplate: (templateData?: Partial<TemplateBuilderData>) => Promise<TemplateBuilderData | null>;
  deleteTemplate: () => Promise<boolean>;
  updateTemplate: (updates: Partial<TemplateBuilderData>) => void;
  loadTemplate: () => Promise<void>;
  resetDirtyState: () => void;
  clearDraft: () => Promise<void>;
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

const extractPreheaderFromMetadata = (metadata: unknown): string => {
  if (!metadata || typeof metadata !== "object") return "";
  if ("preheader" in metadata) {
    const value = (metadata as { preheader?: unknown }).preheader;
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
};

const extractPreheaderFromHtml = (html?: string | null): string => {
  if (!html) return "";
  const match = html.match(/<em>([^<]{0,200})<\/em>/i);
  return match?.[1]?.trim() ?? "";
};

const getEmailPreheader = (channel?: TemplateChannelView): string => {
  if (!channel) return "";
  const fromMetadata = extractPreheaderFromMetadata(channel.metadata);
  if (fromMetadata) return fromMetadata;
  return extractPreheaderFromHtml(channel.html_content);
};

// Transform database template to builder data
const transformToBuilderData = (
  dbTemplate: DatabaseTemplate & { blocks?: unknown }
): TemplateBuilderData => {
  const emailChannel = dbTemplate.template_channel_views?.find(v => v.channel === 'email');
  const preheader = getEmailPreheader(emailChannel as TemplateChannelView | undefined);
  
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
    preheader,
    placeholders: Array.isArray(dbTemplate.placeholders) ? dbTemplate.placeholders : [],
    is_active: dbTemplate.is_active,
    created_at: dbTemplate.created_at,
    updated_at: dbTemplate.updated_at,
    user_id: dbTemplate.user_id,
    organization_id: dbTemplate.organization_id,
    // UI-specific fields
    description: dbTemplate.master_content?.substring(0, 200) || undefined,
    subject: emailChannel?.subject || dbTemplate.master_subject || '',
    preheader,
    blocks: blocks,
    status: dbTemplate.is_active ? 'published' : 'draft',
    published_at: dbTemplate.is_active ? dbTemplate.updated_at : null,
    last_saved_at: dbTemplate.updated_at,
    channels:
      dbTemplate.template_channel_views?.reduce<TemplateChannels>((acc, view) => {
        const { channel, subject, content, html_content, metadata } = view as TemplateChannelView;
        acc[channel] = {
          subject: subject ?? undefined,
          content: content ?? undefined,
          html_content: html_content ?? undefined,
          metadata: metadata ?? null
        };
        return acc;
      }, {} as TemplateChannels) || {}
  };
};

const DRAFT_STORAGE_PREFIX = "template-builder-draft";

interface DraftPayload {
  template: TemplateBuilderData;
  updatedAt: number;
  isDirty: boolean;
}

const getDraftStorageKey = (templateId?: string) =>
  `${DRAFT_STORAGE_PREFIX}-${templateId || "new"}`;

const loadDraftFromStorage = (templateId?: string): DraftPayload | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getDraftStorageKey(templateId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (parsed?.template) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse template draft from storage", error);
  }
  return null;
};

const persistDraftToStorage = (
  templateId: string | undefined,
  template: TemplateBuilderData,
  isDirty: boolean
) => {
  if (typeof window === "undefined") return;

  const payload: DraftPayload = {
    template,
    updatedAt: Date.now(),
    isDirty
  };

  try {
    localStorage.setItem(getDraftStorageKey(templateId), JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist template draft", error);
  }
};

export const clearTemplateDraftLocalStorage = (templateId?: string) => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(getDraftStorageKey(templateId));
};

export function useTemplateBuilder(templateId?: string): UseTemplateBuilderReturn {
  const [template, setTemplate] = useState<TemplateBuilderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyVersion, setDirtyVersion] = useState(0);
  
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("pages");
  const restoredDraftDirtyRef = useRef(false);
  const restoredCleanDraftRef = useRef(false);
  const templateRef = useRef<TemplateBuilderData | null>(null);
  const dirtyVersionRef = useRef(0);
  const latestSavedVersionRef = useRef(0);
  const persistDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const untitledTemplateLabel = t("templateBuilder.untitledTemplate", {
    defaultValue: "Untitled Template"
  });

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const loadTemplate = useCallback(async () => {
    if (!templateId || !activeOrganizationId || restoredDraftDirtyRef.current) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("message_templates")
        .select(`
          *,
          template_channel_views(
            channel, subject, content, html_content, metadata
          )
        `)
        .eq("id", templateId)
        .eq("organization_id", activeOrganizationId)
        .single();

      if (error) throw error;

      const transformedTemplate = transformToBuilderData(data);
      if (restoredDraftDirtyRef.current) {
        return;
      }

      setTemplate(transformedTemplate);
      setIsDirty(false);
      setLastSaved(new Date(transformedTemplate.updated_at));
      restoredDraftDirtyRef.current = false;
      restoredCleanDraftRef.current = false;
      dirtyVersionRef.current = 0;
      latestSavedVersionRef.current = 0;
      setDirtyVersion(0);
    } catch (error: unknown) {
      console.error("Error loading template:", error);
      toast({
        title: t("templateBuilder.toast.errorTitle", { defaultValue: "Error" }),
        description: t("templateBuilder.toast.loadError", {
          defaultValue: getErrorMessage(error)
        }),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [templateId, activeOrganizationId, toast, t]);

  useEffect(() => {
    const currentTemplate = templateRef.current;
    const draft = loadDraftFromStorage(templateId);
    if (draft) {
      if (restoredDraftDirtyRef.current && draft.isDirty) {
        return;
      }
      if (!currentTemplate || draft.isDirty) {
        setTemplate(draft.template);
        setIsDirty(draft.isDirty);
        restoredDraftDirtyRef.current = draft.isDirty;
        restoredCleanDraftRef.current = !draft.isDirty;
        if (!draft.isDirty && draft.updatedAt) {
          setLastSaved(new Date(draft.updatedAt));
        }
      }
      return;
    }

    restoredDraftDirtyRef.current = false;
    restoredCleanDraftRef.current = false;
    if (!templateId) {
      if (currentTemplate) {
        // Navigated to a new template (no id); clear any previous template state once.
        setTemplate(null);
      }
      setIsDirty(false);
      setLastSaved(null);
      dirtyVersionRef.current = 0;
      latestSavedVersionRef.current = 0;
      setDirtyVersion(0);
      return;
    }

    if (!currentTemplate || currentTemplate.id !== templateId) {
      setTemplate(null);
      setIsDirty(false);
      setLastSaved(null);
      dirtyVersionRef.current = 0;
      latestSavedVersionRef.current = 0;
      setDirtyVersion(0);
    }
  }, [templateId]);

  const saveTemplate = useCallback(async (
    templateData: Partial<TemplateBuilderData>, 
    showToast = true
  ): Promise<TemplateBuilderData | null> => {
    if (!activeOrganizationId || !user?.id) return null;
    const saveVersion = dirtyVersionRef.current;
    const targetTemplateId = templateId || template?.id;

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
        mergedData.preheader || '',
        mergedData.channels?.email?.content || '',
        mergedData.channels?.sms?.content || '',
        mergedData.channels?.whatsapp?.content || ''
      ].join(' ');
      
      const extractedPlaceholders = extractPlaceholders(allContent);

      // Prepare template payload with blocks
      const templatePayload = {
        name: mergedData.name || untitledTemplateLabel,
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
      if (targetTemplateId && template) {
        // Update existing template
        const { data, error } = await supabase
          .from("message_templates")
          .update(templatePayload)
          .eq("id", targetTemplateId)
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

        if (typeof window !== "undefined") {
          localStorage.removeItem(getDraftStorageKey(undefined));
        }
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
        subject: mergedData.subject || mergedData.master_subject || mergedData.name || t("templateBuilder.email.subject", { defaultValue: "Subject" }),
        content: generatedMasterContent || mergedData.master_content || '',
        html_content: generatedHtmlContent || null,
        metadata: mergedData.preheader
          ? { preheader: mergedData.preheader }
          : mergedData.channels?.email?.metadata ?? null
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
              html_content: channelData.html_content || null,
              metadata: channelData.metadata ?? null
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
        channels: (() => {
          const baseChannels = mergedData.channels || {};
          return {
            ...baseChannels,
            email: {
              ...(baseChannels.email || {}),
              metadata: mergedData.preheader
                ? { preheader: mergedData.preheader }
                : baseChannels.email?.metadata ?? null
            }
          };
        })()
      };

      setTemplate((current) => {
        if (!current) {
          return savedTemplate;
        }

        const hasNewerChanges = dirtyVersionRef.current !== saveVersion;
        if (hasNewerChanges) {
          return {
            ...savedTemplate,
            name: current.name ?? savedTemplate.name,
            subject: current.subject ?? savedTemplate.subject,
            preheader: current.preheader ?? savedTemplate.preheader,
            blocks: current.blocks ?? savedTemplate.blocks,
            status: current.status ?? savedTemplate.status,
            category: current.category ?? savedTemplate.category,
            channels: current.channels ?? savedTemplate.channels,
          };
        }

        return savedTemplate;
      });

      setLastSaved(new Date());
      latestSavedVersionRef.current = saveVersion;
      const hasUnsaved = dirtyVersionRef.current > latestSavedVersionRef.current;
      setIsDirty(hasUnsaved);
      if (!hasUnsaved) {
        restoredDraftDirtyRef.current = false;
      }

      if (showToast) {
        toast({
          title: t("templateBuilder.toast.savedTitle", { defaultValue: "Saved" }),
          description: t("templateBuilder.toast.savedDescription", { defaultValue: "Template saved successfully" }),
        });
      }

      return savedTemplate;
    } catch (error: unknown) {
      console.error("Error saving template:", error);
      if (showToast) {
        toast({
          title: t("templateBuilder.toast.errorTitle", { defaultValue: "Error" }),
          description: t("templateBuilder.toast.saveError", {
            defaultValue: getErrorMessage(error)
          }),
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [templateId, template, activeOrganizationId, user?.id, toast, t, untitledTemplateLabel]);

  const publishTemplate = useCallback(async (
    templateData?: Partial<TemplateBuilderData>
  ): Promise<TemplateBuilderData | null> => {
    try {
      setSaving(true);

      const dataToPublish = template 
        ? { ...template, ...templateData } 
        : { name: untitledTemplateLabel, blocks: [], ...templateData };

      const publishedTemplate = await saveTemplate({
        ...dataToPublish,
        status: 'published',
        published_at: new Date().toISOString(),
      }, false);

      if (publishedTemplate) {
        toast({
          title: t("templateBuilder.toast.publishedTitle", { defaultValue: "Published" }),
          description: t("templateBuilder.toast.publishedDescription", { defaultValue: "Template published successfully" }),
        });
      }

      return publishedTemplate;
    } catch (error: unknown) {
      console.error("Error publishing template:", error);
      toast({
        title: t("templateBuilder.toast.errorTitle", { defaultValue: "Error" }),
        description: t("templateBuilder.toast.publishError", {
          defaultValue: getErrorMessage(error)
        }),
        variant: "destructive",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, [template, saveTemplate, toast, t, untitledTemplateLabel]);

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

      if (typeof window !== "undefined") {
        localStorage.removeItem(getDraftStorageKey(templateId));
      }

      toast({
        title: t("templateBuilder.toast.deletedTitle", { defaultValue: "Deleted" }),
        description: t("templateBuilder.toast.deletedDescription", { defaultValue: "Template deleted successfully" }),
      });

      return true;
    } catch (error: unknown) {
      console.error("Error deleting template:", error);
      toast({
        title: t("templateBuilder.toast.errorTitle", { defaultValue: "Error" }),
        description: t("templateBuilder.toast.deleteError", {
          defaultValue: getErrorMessage(error)
        }),
        variant: "destructive",
      });
      return false;
    }
  }, [templateId, activeOrganizationId, toast, t]);

  const updateTemplate = useCallback((updates: Partial<TemplateBuilderData>) => {
    dirtyVersionRef.current += 1;
    setDirtyVersion(dirtyVersionRef.current);

    if (!template) {
      // Create a basic template with updates
      const newTemplate: TemplateBuilderData = {
        id: '',
        name: untitledTemplateLabel,
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
  }, [template, untitledTemplateLabel]);

  const resetDirtyState = useCallback(() => {
    setIsDirty(false);
    restoredDraftDirtyRef.current = false;
  }, []);

  const clearDraft = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(getDraftStorageKey(templateId));
      localStorage.removeItem(getDraftStorageKey(undefined));
    }
    restoredDraftDirtyRef.current = false;
    setIsDirty(false);
    setLastSaved(null);
    dirtyVersionRef.current = 0;
    latestSavedVersionRef.current = 0;
    setDirtyVersion(0);

    if (templateId && activeOrganizationId) {
      await loadTemplate();
    } else {
      setTemplate(null);
    }
  }, [templateId, activeOrganizationId, loadTemplate]);

  useEffect(() => {
    if (!template || typeof window === "undefined") return;

    if (persistDraftTimerRef.current) {
      clearTimeout(persistDraftTimerRef.current);
    }

    // Debounce localStorage writes to avoid blocking keystrokes while typing
    persistDraftTimerRef.current = window.setTimeout(() => {
      persistDraftToStorage(templateId, template, isDirty);
    }, 400);

    return () => {
      if (persistDraftTimerRef.current) {
        clearTimeout(persistDraftTimerRef.current);
        persistDraftTimerRef.current = null;
      }
    };
  }, [template, isDirty, templateId]);

  // Load template on mount
  useEffect(() => {
    const shouldLoad =
      templateId &&
      activeOrganizationId &&
      (!template || template.id !== templateId || restoredCleanDraftRef.current);

    if (shouldLoad && !restoredDraftDirtyRef.current) {
      restoredCleanDraftRef.current = false;
      loadTemplate();
    }
  }, [templateId, activeOrganizationId, template, loadTemplate]);

  return {
    template,
    loading,
    saving,
    lastSaved,
    dirtyVersion,
    isDirty,
    saveTemplate,
    publishTemplate,
    deleteTemplate,
    updateTemplate,
    loadTemplate,
    resetDirtyState,
    clearDraft,
  };
}
