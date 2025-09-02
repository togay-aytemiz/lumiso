import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserOrganizationId } from '@/lib/organizationUtils';

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
  blocks: any[];
  subject?: string;
  preheader?: string;
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const organizationId = await getUserOrganizationId();
      
      console.log('Organization ID for templates:', organizationId);
      
      if (!organizationId) {
        console.warn('No organization ID found, cannot fetch templates');
        setTemplates([]);
        return;
      }

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      console.log('Template query result:', { data, error });

      if (error) throw error;
      setTemplates((data || []) as Template[]);
      console.log('Templates loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const getSessionTemplates = () => {
    const sessionFiltered = templates.filter(template => 
      template.category === 'session' || 
      template.category === 'sessions' ||
      template.category === 'client-communication' ||
      template.name.toLowerCase().includes('session') ||
      template.name.toLowerCase().includes('appointment') ||
      template.name.toLowerCase().includes('booking') ||
      template.name.toLowerCase().includes('reminder') ||
      template.name.toLowerCase().includes('confirmation')
    );
    
    // If no session-specific templates found, show all general templates as fallback
    const result = sessionFiltered.length > 0 ? sessionFiltered : templates;
    
    // Debug logging to help troubleshoot template loading
    console.log('All templates:', templates);
    console.log('Session-filtered templates:', sessionFiltered);
    console.log('Final result templates:', result);
    
    return result;
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return {
    templates,
    sessionTemplates: getSessionTemplates(),
    loading,
    refetch: fetchTemplates,
  };
}