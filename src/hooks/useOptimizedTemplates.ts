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
        .from('email_templates')
        .select('id, name, description, subject, preheader, status, category, updated_at, blocks')
        .eq('organization_id', activeOrganizationId)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setTemplates(data as EmailTemplate[] || []);
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
      const { error: deleteError } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId)
        .eq('organization_id', activeOrganizationId);

      if (deleteError) throw deleteError;

      // Optimistically update local state
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      
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
        .from('email_templates')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          subject: template.subject,
          preheader: template.preheader,
          organization_id: activeOrganizationId,
          user_id: user.user.id,
          blocks: template.blocks,
          status: 'draft',
          category: template.category
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Optimistically update local state
      setTemplates(prev => [data as EmailTemplate, ...prev]);
      
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