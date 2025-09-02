import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserOrganizationId } from '@/lib/organizationUtils';

export interface Template {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject?: string;
  placeholders?: string[] | Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

      // Fetch both email templates and message templates
      const [emailTemplatesResult, messageTemplatesResult] = await Promise.all([
        supabase
          .from('email_templates')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'published'),
        supabase
          .from('message_templates')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
      ]);

      const emailTemplates = (emailTemplatesResult.data || []).map(template => ({
        ...template,
        category: 'email',
        master_content: template.subject || '',
        master_subject: template.subject || '',
        is_active: template.status === 'published'
      }));

      const messageTemplates = (messageTemplatesResult.data || []).map(template => ({
        ...template,
        is_active: true
      }));

      const allTemplates = [...emailTemplates, ...messageTemplates] as Template[];
      setTemplates(allTemplates);
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

  const getTemplatesByCategory = (category?: string) => {
    if (!category) return templates;
    return templates.filter(template => template.category === category);
  };

  const getTemplatesByChannel = (channel: 'email' | 'sms' | 'whatsapp') => {
    switch (channel) {
      case 'email':
        return templates.filter(t => t.category === 'email' || t.category === 'session_confirmation');
      case 'sms':
      case 'whatsapp':
        return templates.filter(t => t.category === 'messages' || t.category.includes('session'));
      default:
        return templates;
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return {
    templates,
    loading,
    getTemplatesByCategory,
    getTemplatesByChannel,
    refetch: fetchTemplates,
  };
}