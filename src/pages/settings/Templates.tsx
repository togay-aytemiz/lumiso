import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VariablePicker } from "@/components/templates/VariablePicker";
import { EmailPreview } from "@/components/templates/EmailPreview";
import { SMSPreview } from "@/components/templates/SMSPreview";
import { WhatsAppPreview } from "@/components/templates/WhatsAppPreview";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Eye, MoreHorizontal, Copy } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Data structures and constants
interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
  subject?: string;
  placeholders: string[];
  status: 'active' | 'draft';
  created_at?: string;
}

interface TemplateChannelView {
  id: string;
  template_id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  content: string;
  html_content?: string;
}

// Template categories for reference
const TEMPLATE_CATEGORIES = [
  { id: 'session_confirmation', name: 'Session Confirmation', types: ['session_confirmation'] },
  { id: 'session_reminder', name: 'Session Reminder', types: ['session_reminder'] },
  { id: 'session_rescheduled', name: 'Session Rescheduled', types: ['session_rescheduled'] },
  { id: 'session_cancelled', name: 'Session Cancelled', types: ['session_cancelled'] },
  { id: 'session_completed', name: 'Session Completed', types: ['session_completed'] },
  { id: 'lead_follow_up', name: 'Lead Follow Up', types: ['lead_follow_up'] },
  { id: 'payment_reminder', name: 'Payment Reminder', types: ['payment_reminder'] },
  { id: 'general', name: 'General', types: ['general'] },
];

// Channels configuration
const CHANNELS = [
  { id: 'email', label: 'Email', icon: '📧' },
  { id: 'sms', label: 'SMS', icon: '💬' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
];

// Available placeholders
const PLACEHOLDERS = [
  { key: '{customer_name}', label: 'Customer Name', example: 'John Smith' },
  { key: '{session_type}', label: 'Session Type', example: 'Wedding Photography' },
  { key: '{session_date}', label: 'Session Date', example: 'March 15, 2024' },
  { key: '{session_time}', label: 'Session Time', example: '2:00 PM' },
  { key: '{session_location}', label: 'Session Location', example: 'Central Park' },
  { key: '{studio_name}', label: 'Studio Name', example: 'Your Studio' },
  { key: '{studio_phone}', label: 'Studio Phone', example: '(555) 123-4567' },
];

interface TemplatesSettingsProps {
  onBack?: () => void;
  organizationName?: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  businessName?: string | null;
}

export default function TemplatesSettings({ 
  onBack, 
  organizationName, 
  brandColor, 
  logoUrl, 
  businessName 
}: TemplatesSettingsProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channelViews, setChannelViews] = useState<TemplateChannelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [deleteTemplate, setDeleteTemplate] = useState<MessageTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    master_content: "",
    subject: "",
    category: "general" as string,
  });

  const { activeOrganization } = useOrganization();
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data: templatesData, error: templatesError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('organization_id', activeOrganization?.id)
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      const { data: viewsData, error: viewsError } = await supabase
        .from('template_channel_views')
        .select('*')
        .in('template_id', templatesData?.map(t => t.id) || []);

      if (viewsError) throw viewsError;

      setTemplates(templatesData || []);
      setChannelViews(viewsData || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingTemplate) {
        const { error } = await supabase
          .from('message_templates')
          .update({
            name: formData.name,
            master_content: formData.master_content,
            category: formData.category || 'general',
            placeholders: PLACEHOLDERS.map(p => p.key),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { data: newTemplate, error } = await supabase
          .from('message_templates')
          .insert({
            user_id: user.id,
            organization_id: activeOrganization?.id,
            name: formData.name,
            master_content: formData.master_content,
            category: formData.category || 'general',
            placeholders: PLACEHOLDERS.map(p => p.key),
            status: 'active',
          })
          .select()
          .single();

        if (error) throw error;

        // Create default channel views
        const channelViewsToCreate = CHANNELS.map(channel => ({
          template_id: newTemplate.id,
          channel: channel.id as 'email' | 'sms' | 'whatsapp',
          subject: channel.id === 'email' ? formData.subject || formData.name : undefined,
          content: formData.master_content,
        }));

        const { error: viewsError } = await supabase
          .from('template_channel_views')
          .insert(channelViewsToCreate);

        if (viewsError) throw viewsError;
      }

      toast({
        title: "Success",
        description: editingTemplate ? "Template updated successfully" : "Template created successfully",
      });

      setIsModalOpen(false);
      setEditingTemplate(null);
      setFormData({ name: "", master_content: "", subject: "", category: "general" });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (template: MessageTemplate) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variableKey: string) => {
    setFormData(prev => ({
      ...prev,
      master_content: prev.master_content + variableKey
    }));
  };

  const replacePlaceholders = (content: string, subject?: string) => {
    let replaced = content;
    PLACEHOLDERS.forEach(placeholder => {
      replaced = replaced.replace(new RegExp(placeholder.key, 'g'), placeholder.example);
    });
    return replaced;
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchTemplates();
    }
  }, [activeOrganization?.id]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                ← Back
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-semibold">Message Templates</h1>
              <p className="text-muted-foreground mt-1">
                Create and manage message templates for automated communication
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Back
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-semibold">Message Templates</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage message templates for automated communication
            </p>
          </div>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Create Template
        </Button>
      </div>

      <div className="space-y-6">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first template to start automating your communication.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>
                        {TEMPLATE_CATEGORIES.find(cat => cat.id === template.category)?.name || template.category}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={template.status === 'active' ? 'default' : 'secondary'}>
                        {template.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setPreviewTemplate(template);
                            setIsPreviewOpen(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingTemplate(template);
                            setFormData({
                              name: template.name,
                              master_content: template.master_content,
                              subject: template.subject || "",
                              category: template.category,
                            });
                            setIsModalOpen(true);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteTemplate(template)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.master_content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Preview Modal */}
        {previewTemplate && (
          <AppSheetModal
            title={`Preview: ${previewTemplate.name}`}
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
          >
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="mt-6">
                <EmailPreview
                  subject={replacePlaceholders(previewTemplate.subject || previewTemplate.name)}
                  content={replacePlaceholders(previewTemplate.master_content)}
                  sender={`${businessName || organizationName || 'Your Studio'} <hello@yourstudio.com>`}
                  recipient="Jane Smith <jane.smith@example.com>"
                  studioName={businessName || organizationName || 'Your Studio'}
                  brandColor={brandColor || "#1EB29F"}
                  logoUrl={logoUrl}
                />
              </TabsContent>
              
              <TabsContent value="sms" className="mt-6">
                <SMSPreview 
                  content={replacePlaceholders(previewTemplate.master_content)}
                  senderName={businessName || organizationName || 'Your Studio'}
                />
              </TabsContent>
              
              <TabsContent value="whatsapp" className="mt-6">
                <WhatsAppPreview 
                  content={replacePlaceholders(previewTemplate.master_content)}
                  senderName={businessName || organizationName || 'Your Studio'}
                />
              </TabsContent>
            </Tabs>
          </AppSheetModal>
        )}

        {/* Create/Edit Modal */}
        <AppSheetModal
          title={editingTemplate ? "Edit Template" : "Create Template"}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          footerActions={[
            {
              label: "Cancel",
              onClick: () => setIsModalOpen(false),
              variant: "outline",
            },
            {
              label: editingTemplate ? "Update Template" : "Create Template",
              onClick: handleSaveTemplate,
              variant: "default",
            },
          ]}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
              />
            </div>

            <div>
              <Label htmlFor="subject">Email Subject (Optional)</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Enter email subject line"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="content">Message Content</Label>
                <VariablePicker onVariableSelect={insertVariable} />
              </div>
              <Textarea
                id="content"
                value={formData.master_content}
                onChange={(e) => setFormData({ ...formData, master_content: e.target.value })}
                placeholder="Enter your message content..."
                rows={8}
              />
            </div>
          </div>
        </AppSheetModal>

        {/* Delete Confirmation */}
        {deleteTemplate && (
          <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Template</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{deleteTemplate.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    handleDeleteTemplate(deleteTemplate);
                    setDeleteTemplate(null);
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}