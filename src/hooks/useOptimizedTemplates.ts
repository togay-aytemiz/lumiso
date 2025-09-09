import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  preheader: string | null;
  status: string;
  category: string | null;
  updated_at: string;
  blocks: any[];
  master_content: string;
  master_subject?: string;
  placeholders?: string[];
  is_active: boolean;
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

interface UseOptimizedTemplatesReturn {
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredTemplates: EmailTemplate[];
  refreshTemplates: () => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<boolean>;
  duplicateTemplate: (template: EmailTemplate) => Promise<boolean>;
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

// Helper function to extract preview text from template
const extractPreviewText = (template: EmailTemplate): string => {
  // First priority: subject line
  if (template.subject?.trim()) {
    return template.subject.trim();
  }
  
  // Second priority: preheader
  if (template.preheader?.trim()) {
    return template.preheader.trim();
  }
  
  // Third priority: first text block content
  if (template.blocks && Array.isArray(template.blocks)) {
    for (const block of template.blocks) {
      if (block.type === 'text' && block.content?.trim()) {
        // Remove HTML tags and get first 60 characters
        const plainText = block.content.replace(/<[^>]*>/g, '').trim();
        if (plainText) {
          return plainText.length > 60 ? `${plainText.substring(0, 60)}...` : plainText;
        }
      }
    }
  }
  
  // Fallback: description
  if (template.description?.trim()) {
    return template.description.length > 60 ? `${template.description.substring(0, 60)}...` : template.description;
  }
  
  return 'No preview available';
};

export function useOptimizedTemplates(): UseOptimizedTemplatesReturn {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { activeOrganizationId } = useOrganization();
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
          id, name, category, master_content, master_subject, placeholders, is_active, updated_at,
          template_channel_views(
            channel, subject, content, html_content
          )
        `)
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Transform data to match EmailTemplate interface
      const transformedTemplates = (data || []).map((template: any) => ({
        id: template.id,
        name: template.name,
        description: template.master_content?.substring(0, 200) || null,
        subject: template.template_channel_views?.find((v: any) => v.channel === 'email')?.subject || template.master_subject || null,
        preheader: template.template_channel_views?.find((v: any) => v.channel === 'email')?.html_content?.match(/preheader[^>]*>([^<]*)/)?.[1] || null,
        status: template.is_active ? 'published' : 'draft',
        category: template.category,
        updated_at: template.updated_at,
        blocks: [], // Will be populated from channel views if needed
        master_content: template.master_content,
        master_subject: template.master_subject,
        placeholders: Array.isArray(template.placeholders) ? template.placeholders : [],
        is_active: template.is_active,
        channels: template.template_channel_views?.reduce((acc: any, view: any) => {
          acc[view.channel] = {
            subject: view.subject,
            content: view.content,
            html_content: view.html_content
          };
          return acc;
        }, {}) || {}
      }));
      
      setTemplates(transformedTemplates as EmailTemplate[]);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message || 'Failed to fetch templates');
      toast({
        title: "Error loading templates",
        description: err.message || 'Failed to fetch templates',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, toast]);

  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    if (!activeOrganizationId) return false;

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
    } catch (err: any) {
      console.error('Error deleting template:', err);
      toast({
        title: "Error deleting template",
        description: err.message || 'Failed to delete template',
        variant: "destructive"
      });
      return false;
    }
  }, [activeOrganizationId, toast]);

  const duplicateTemplate = useCallback(async (template: EmailTemplate): Promise<boolean> => {
    if (!activeOrganizationId) return false;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error: insertError } = await supabase
        .from('message_templates')
        .insert({
          name: `${template.name} (Copy)`,
          category: template.category || 'general',
          master_content: template.master_content || template.description || '',
          master_subject: template.master_subject || template.subject,
          placeholders: template.placeholders || [],
          is_active: false, // Duplicated templates start as drafts
          organization_id: activeOrganizationId,
          user_id: user.user.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create channel views if the original template has them
      if (template.channels) {
        const channelInserts = Object.entries(template.channels).map(([channel, channelData]: [string, any]) => ({
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

      // Transform the new template to match our interface
      const transformedTemplate = {
        id: data.id,
        name: data.name,
        description: data.master_content?.substring(0, 200) || null,
        subject: data.master_subject || null,
        preheader: null,
        status: 'draft',
        category: data.category,
        updated_at: data.updated_at,
        blocks: [],
        master_content: data.master_content,
        master_subject: data.master_subject,
        placeholders: data.placeholders || [],
        is_active: data.is_active,
        channels: template.channels || {}
      };

      // Optimistically update local state
      setTemplates(prev => [transformedTemplate as EmailTemplate, ...prev]);
      
      toast({
        title: "Template duplicated",
        description: `"${template.name}" has been duplicated successfully.`
      });
      
      return true;
    } catch (err: any) {
      console.error('Error duplicating template:', err);
      toast({
        title: "Error duplicating template",
        description: err.message || 'Failed to duplicate template',
        variant: "destructive"
      });
      return false;
    }
  }, [activeOrganizationId, toast]);

  // Memoized filtered templates to prevent unnecessary recalculations
  const filteredTemplates = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return templates;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return templates.filter(template => {
      const matchesSearch = 
        template.name.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower) ||
        template.subject?.toLowerCase().includes(searchLower) ||
        extractPreviewText(template).toLowerCase().includes(searchLower);
      return matchesSearch;
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