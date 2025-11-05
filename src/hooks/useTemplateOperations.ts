import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Template, DatabaseTemplate, TemplateBuilderData } from "@/types/template";

interface UseTemplateOperationsReturn {
  templates: Template[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredTemplates: Template[];
  refreshTemplates: () => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<boolean>;
  duplicateTemplate: (template: Template) => Promise<boolean>;
}

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Transform database template to our unified interface
const transformDatabaseTemplate = (dbTemplate: DatabaseTemplate): Template => {
  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    category: dbTemplate.category,
    master_content: dbTemplate.master_content,
    master_subject: dbTemplate.master_subject || undefined,
    placeholders: Array.isArray(dbTemplate.placeholders) ? dbTemplate.placeholders as string[] : [],
    is_active: dbTemplate.is_active,
    created_at: dbTemplate.created_at,
    updated_at: dbTemplate.updated_at,
    user_id: dbTemplate.user_id,
    organization_id: dbTemplate.organization_id,
    channels: dbTemplate.template_channel_views?.reduce<Record<string, { subject: string | null; content: string | null; html_content: string | null }>>((acc, view) => {
      acc[view.channel] = {
        subject: view.subject,
        content: view.content,
        html_content: view.html_content
      };
      return acc;
    }, {} as Record<string, { subject: string | null; content: string | null; html_content: string | null }>) || {}
  };
};

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

export function useTemplateOperations(): UseTemplateOperationsReturn {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  // Debounce search term to avoid excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchTemplates = useCallback(async () => {
    if (!activeOrganizationId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('message_templates')
        .select(`
          *,
          template_channel_views(
            channel, subject, content, html_content
          )
        `)
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      const transformedTemplates = (data || []).map(transformDatabaseTemplate);
      setTemplates(transformedTemplates);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
      toast({
        title: "Error loading templates",
        description: err instanceof Error ? err.message : 'Failed to fetch templates',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, toast]);

  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    if (!activeOrganizationId) return false;

    try {
      // Use a transaction-like approach by deleting channel views first
      const { error: channelError } = await supabase
        .from('template_channel_views')
        .delete()
        .eq('template_id', templateId);

      if (channelError) {
        console.warn('Error deleting channel views:', channelError);
        // Continue with template deletion even if channel views fail
      }

      // Then delete the main template
      const { error: deleteError } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId)
        .eq('organization_id', activeOrganizationId);

      if (deleteError) throw deleteError;

      // Optimistically update local state
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      
      toast({
        title: "Template deleted",
        description: "Template has been successfully deleted."
      });
      
      return true;
    } catch (err) {
      console.error('Error deleting template:', err);
      toast({
        title: "Error deleting template",
        description: err.message || 'Failed to delete template',
        variant: "destructive"
      });
      return false;
    }
  }, [activeOrganizationId, toast]);

  const duplicateTemplate = useCallback(async (template: Template): Promise<boolean> => {
    if (!activeOrganizationId || !user?.id) return false;

    try {
      // First fetch the original template to get the blocks field
      const { data: originalTemplate, error: fetchError } = await supabase
        .from('message_templates')
        .select('blocks')
        .eq('id', template.id)
        .single();

      if (fetchError) {
        console.warn('Could not fetch original template blocks:', fetchError);
      }

      // Create the duplicate template including blocks
      const { data, error: insertError } = await supabase
        .from('message_templates')
        .insert({
          name: `${template.name} (Copy)`,
          category: template.category,
          master_content: template.master_content,
          master_subject: template.master_subject,
          placeholders: template.placeholders || [],
          blocks: originalTemplate?.blocks || null,
          is_active: false, // Duplicated templates start as drafts
          organization_id: activeOrganizationId,
          user_id: user.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create channel views if the original template has them
      if (template.channels && Object.keys(template.channels).length > 0) {
        const channelInserts = Object.entries(template.channels).map(([channel, channelData]: [string, { subject?: string | null; content?: string | null; html_content?: string | null }]) => ({
          template_id: data.id,
          channel,
          subject: channelData?.subject || null,
          content: channelData?.content || null,
          html_content: channelData?.html_content || null
        }));

        if (channelInserts.length > 0) {
          const { error: channelError } = await supabase
            .from('template_channel_views')
            .insert(channelInserts);

          if (channelError) {
            console.warn('Error creating channel views for duplicate:', channelError);
          }
        }
      }

      // Transform the new template and add to state
      const newTemplate: Template = {
        ...data,
        placeholders: Array.isArray(data.placeholders) ? data.placeholders as string[] : [],
        channels: template.channels || {}
      };

      setTemplates(prev => [newTemplate, ...prev]);
      
      toast({
        title: "Template duplicated",
        description: `"${template.name}" has been duplicated successfully.`
      });
      
      return true;
    } catch (err) {
      console.error('Error duplicating template:', err);
      toast({
        title: "Error duplicating template",
        description: err.message || 'Failed to duplicate template',
        variant: "destructive"
      });
      return false;
    }
  }, [activeOrganizationId, user?.id, toast]);

  // Memoized filtered templates
  const filteredTemplates = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return templates;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return templates.filter(template => {
      return (
        template.name.toLowerCase().includes(searchLower) ||
        template.master_content.toLowerCase().includes(searchLower) ||
        template.master_subject?.toLowerCase().includes(searchLower) ||
        template.category.toLowerCase().includes(searchLower)
      );
    });
  }, [templates, debouncedSearchTerm]);

  // Fetch templates on mount and when organization changes
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    filteredTemplates,
    refreshTemplates: fetchTemplates,
    deleteTemplate,
    duplicateTemplate,
  };
}