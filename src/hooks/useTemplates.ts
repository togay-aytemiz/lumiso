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
      if (!organizationId) return;

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as Template[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSessionTemplates = () => {
    return templates.filter(template => 
      template.category === 'session' || 
      template.name.toLowerCase().includes('session') ||
      template.name.toLowerCase().includes('appointment') ||
      template.name.toLowerCase().includes('booking')
    );
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