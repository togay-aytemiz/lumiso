import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserOrganizationId } from '@/lib/organizationUtils';

import { Template, TemplateChannelView } from "@/types/template";

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
  return "Failed to load templates";
};

type TemplateChannels = NonNullable<Template["channels"]>;

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
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
        .from('message_templates')
        .select(`
          *,
          template_channel_views(
            channel,
            subject,
            content,
            html_content
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('Template query result:', { data, error });

      if (error) throw error;

      const transformedTemplates: Template[] = (data ?? []).map(template => {
        const { template_channel_views, placeholders, ...rest } = template as typeof template & {
          template_channel_views?: TemplateChannelView[];
        };

        const channels =
          template_channel_views?.reduce<TemplateChannels>((acc, view) => {
            acc[view.channel] = {
              subject: view.subject ?? undefined,
              content: view.content ?? undefined,
              html_content: view.html_content ?? undefined,
            };
            return acc;
          }, {} as TemplateChannels) ?? undefined;

        return {
          ...rest,
          placeholders: Array.isArray(placeholders) ? placeholders : [],
          channels,
        };
      });

      setTemplates(transformedTemplates);
      console.log('Templates loaded:', transformedTemplates.length);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getSessionTemplates = () => {
    const sessionKeywords = ['session', 'appointment', 'booking', 'reminder', 'confirmation'];
    const sessionFiltered = templates.filter(template => {
      const category = template.category?.toLowerCase() ?? '';
      const name = template.name?.toLowerCase() ?? '';
      const matchesSessionCategory = category.startsWith('session');
      const matchesAllowedCategory = category === 'client-communication';
      const matchesName = sessionKeywords.some(keyword => name.includes(keyword));

      return matchesSessionCategory || matchesAllowedCategory || matchesName;
    });
    
    // Always include all templates: session-relevant ones first, then everything else
    const nonSessionTemplates = templates.filter(template => !sessionFiltered.includes(template));
    const result = [...sessionFiltered, ...nonSessionTemplates];
    
    // Debug logging to help troubleshoot template loading
    console.log('All templates:', templates);
    console.log('Session-filtered templates:', sessionFiltered);
    console.log('Non-session templates:', nonSessionTemplates);
    console.log('Final result templates:', result);
    
    return result;
  };

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    sessionTemplates: getSessionTemplates(),
    loading,
    refetch: fetchTemplates,
  };
}
