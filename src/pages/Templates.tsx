import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Edit, Trash2, Copy, MoreHorizontal, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";

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

export default function Templates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();

  useEffect(() => {
    if (activeOrganizationId) {
      fetchTemplates();
    }
  }, [activeOrganizationId]);

  const fetchTemplates = async () => {
    if (!activeOrganizationId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, description, subject, preheader, status, category, updated_at, blocks')
        .eq('organization_id', activeOrganizationId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data as EmailTemplate[] || []);
    } catch (error: any) {
      toast({
        title: "Error loading templates",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast({
        title: "Template deleted",
        description: `"${templateName}" has been deleted successfully.`
      });
    } catch (error: any) {
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDuplicateTemplate = async (template: EmailTemplate) => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          organization_id: activeOrganizationId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          blocks: template.blocks,
          status: 'draft',
          category: template.category
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [data as EmailTemplate, ...prev]);
      toast({
        title: "Template duplicated",
        description: `"${template.name}" has been duplicated successfully.`
      });
    } catch (error: any) {
      toast({
        title: "Error duplicating template",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const filteredTemplates = templates.filter(template => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      template.name.toLowerCase().includes(searchLower) ||
      template.description?.toLowerCase().includes(searchLower) ||
      template.subject?.toLowerCase().includes(searchLower) ||
      extractPreviewText(template).toLowerCase().includes(searchLower);
    return matchesSearch;
  });

  const columns: Column<EmailTemplate>[] = [
    {
      key: 'name',
      header: 'Template Name',
      sortable: true,
      render: (template) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{template.name}</div>
          {template.description && (
            <div className="text-sm text-muted-foreground truncate mt-1">
              {template.description}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'preview',
      header: 'Preview',
      render: (template) => (
        <div className="max-w-xs min-w-0">
          <div className="text-sm text-muted-foreground line-clamp-2">
            {extractPreviewText(template)}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (template) => {
        const isPublished = template.status === 'published';
        return (
          <Badge variant={isPublished ? 'default' : 'secondary'}>
            {isPublished ? 'Published' : 'Draft'}
          </Badge>
        );
      }
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      sortable: true,
      render: (template) => (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (template) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/template-builder?id=${template.id}`);
            }}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteTemplate(template.id, template.name)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

  const emptyState = (
    <div className="text-center py-12">
      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">
        {searchTerm ? 'No templates found' : 'No templates created yet'}
      </h3>
      <p className="text-muted-foreground mb-6">
        {searchTerm 
          ? 'Try adjusting your search terms to find what you\'re looking for.' 
          : 'Create your first email template to get started with automated communications.'
        }
      </p>
      {!searchTerm && (
        <Button onClick={() => navigate('/template-builder')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Template
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Message Templates" 
        subtitle="Design and manage reusable email templates"
      />
      
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => navigate('/template-builder')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Templates Table */}
        <div className="bg-card rounded-lg border">
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex space-x-4">
                      <div className="h-4 bg-muted rounded flex-1"></div>
                      <div className="h-4 bg-muted rounded w-24"></div>
                      <div className="h-4 bg-muted rounded w-20"></div>
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-4 bg-muted rounded w-24"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <DataTable
              data={filteredTemplates}
              columns={columns}
              emptyState={emptyState}
              itemsPerPage={15}
            />
          )}
        </div>
      </div>
    </div>
  );
}