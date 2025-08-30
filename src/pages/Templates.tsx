import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, FileText, ClipboardList, ScrollText, Plus, Search, Edit, Trash2, Copy, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";

interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  status: string;
  category: string | null;
  updated_at: string;
  blocks: any[];
}

const categories = [
  {
    id: "messages",
    title: "Messages",
    description: "Email, SMS, and WhatsApp templates",
    icon: MessageSquare,
    active: true
  },
  {
    id: "quotes",
    title: "Quotes", 
    description: "Project proposal and quote templates",
    icon: FileText,
    active: false
  },
  {
    id: "questionnaires",
    title: "Questionnaires",
    description: "Client intake and feedback forms",
    icon: ClipboardList,
    active: false
  },
  {
    id: "contracts",
    title: "Contracts",
    description: "Service agreements and terms",
    icon: ScrollText,
    active: false
  }
];

export default function Templates() {
  const [activeCategory, setActiveCategory] = useState("messages");
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
        .select('*')
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
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (template.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const isPublished = status === 'published';
    return (
      <Badge variant={isPublished ? 'default' : 'secondary'}>
        {isPublished ? 'Published' : 'Draft'}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader 
        title="Templates" 
        subtitle="Manage your templates for automated communications and client interactions"
      />
      
      <div className="p-4 sm:p-6">
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger 
                  key={category.id} 
                  value={category.id}
                  disabled={!category.active}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {category.title}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsContent key={category.id} value={category.id} className="space-y-4">
                {category.active ? (
                  <div className="space-y-4">
                    {/* Header with Actions */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Icon className="h-5 w-5" />
                              {category.title} Templates
                            </CardTitle>
                            <CardDescription>
                              Create and manage templates for {category.description.toLowerCase()}
                            </CardDescription>
                          </div>
                          <Button onClick={() => navigate('/template-builder')} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            New Template
                          </Button>
                        </div>
                        
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="Search templates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </CardHeader>
                    </Card>

                    {/* Templates Grid */}
                    {loading ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                          <Card key={i} className="animate-pulse">
                            <CardHeader>
                              <div className="h-4 bg-muted rounded w-3/4"></div>
                              <div className="h-3 bg-muted rounded w-1/2"></div>
                            </CardHeader>
                            <CardContent>
                              <div className="h-3 bg-muted rounded w-full mb-2"></div>
                              <div className="h-3 bg-muted rounded w-2/3"></div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : filteredTemplates.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredTemplates.map((template) => (
                          <Card key={template.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                                  {template.description && (
                                    <CardDescription className="line-clamp-2 mt-1">
                                      {template.description}
                                    </CardDescription>
                                  )}
                                </div>
                                {getStatusBadge(template.status)}
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                                <span>
                                  Updated {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
                                </span>
                                <span>{template.blocks?.length || 0} blocks</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/template-builder?id=${template.id}`)}
                                  className="flex-1"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDuplicateTemplate(template)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTemplate(template.id, template.name)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-12">
                          <div className="text-center">
                            <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">
                              {searchTerm ? 'No templates found' : 'No templates created yet'}
                            </h3>
                            <p className="text-muted-foreground mb-4">
                              {searchTerm 
                                ? 'Try adjusting your search terms' 
                                : 'Get started by creating your first template'
                              }
                            </p>
                            {!searchTerm && (
                              <Button onClick={() => navigate('/template-builder')}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Template
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardHeader className="text-center">
                      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <CardTitle className="text-muted-foreground">Coming Soon</CardTitle>
                      <CardDescription>
                        {category.description} will be available in a future update
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}