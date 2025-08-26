import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Eye, Copy, FileText, MessageSquare, FileTextIcon, HelpCircle, Quote, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { VariablePicker } from "@/components/templates/VariablePicker";
import { EmailPreview } from "@/components/templates/EmailPreview";
import { SMSPreview } from "@/components/templates/SMSPreview";
import { WhatsAppPreview } from "@/components/templates/WhatsAppPreview";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject?: string;
  placeholders: any;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  user_id: string;
  organization_id: string;
}

interface TemplateChannelView {
  id: string;
  template_id: string;
  channel: string;
  subject?: string;
  content: string;
  html_content?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: any;
}

// Template categories for tabs
const TEMPLATE_CATEGORIES = [
  { id: "messages", title: "Messages", icon: MessageSquare },
  { id: "contracts", title: "Contracts", icon: FileText },
  { id: "invoices", title: "Invoices", icon: FileTextIcon },
  { id: "questionnaires", title: "Questionnaires", icon: HelpCircle },
  { id: "quotes", title: "Quotes", icon: Quote },
];

// Available channels for multi-channel support
const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

// Available placeholders - Real variables from database schema
const PLACEHOLDERS = [
  // Client/Lead related (from leads table)
  { key: '{{client_name}}', label: 'Client Name', example: 'Sarah Johnson' },
  { key: '{{customer_name}}', label: 'Customer Name', example: 'Sarah Johnson' },
  { key: '{{lead_name}}', label: 'Lead Name', example: 'Sarah Johnson' },
  { key: '{{customer_email}}', label: 'Customer Email', example: 'sarah.johnson@example.com' },
  { key: '{{client_email}}', label: 'Client Email', example: 'sarah.johnson@example.com' },
  { key: '{{customer_phone}}', label: 'Customer Phone', example: '+1 (555) 123-4567' },
  { key: '{{client_phone}}', label: 'Client Phone', example: '+1 (555) 123-4567' },
  
  // Session related (from sessions table)
  { key: '{{session_type}}', label: 'Session Type', example: 'Newborn Photography Session' },
  { key: '{{session_date}}', label: 'Session Date', example: 'Monday, February 5, 2024' },
  { key: '{{session_time}}', label: 'Session Time', example: '2:00 PM' },
  { key: '{{session_location}}', label: 'Session Location', example: 'Photography Studio' },
  
  // Studio/Organization related (from organization_settings)
  { key: '{{studio_name}}', label: 'Studio Name', example: 'Your Photography Studio' },
  { key: '{{business_name}}', label: 'Business Name', example: 'Your Photography Studio' },
  { key: '{{studio_phone}}', label: 'Studio Phone', example: '+1 (555) 987-6543' },
  { key: '{{studio_email}}', label: 'Studio Email', example: 'hello@yourstudio.com' },
  
  // Project related 
  { key: '{{project_name}}', label: 'Project Name', example: 'Newborn Session - Johnson Family' },
  
  // Booking/Links
  { key: '{{booking_link}}', label: 'Booking Link', example: 'https://yourstudio.com/book' },
  { key: '{{reschedule_link}}', label: 'Reschedule Link', example: 'https://yourstudio.com/reschedule' },
  { key: '{{gallery_link}}', label: 'Gallery Link', example: 'https://yourstudio.com/gallery/johnson-newborn' },
  
  // Payment related (from payments table)
  { key: '{{payment_amount}}', label: 'Payment Amount', example: '$650.00' },
  { key: '{{payment_due_date}}', label: 'Payment Due Date', example: 'February 19, 2024' },
  { key: '{{total_amount}}', label: 'Total Amount', example: '$650.00' },
  { key: '{{remaining_balance}}', label: 'Remaining Balance', example: '$325.00' },
  
  // Reminder related
  { key: '{{reminder_title}}', label: 'Reminder Title', example: 'Session Preparation Reminder' },
  { key: '{{reminder_date}}', label: 'Reminder Date', example: 'February 7, 2024' },
];

export default function Templates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channelViews, setChannelViews] = useState<TemplateChannelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("messages");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    master_content: "",
    subject: "",
    category: "",
    is_active: true,
    // Channel-specific content
    email_content: "",
    email_subject: "",
    sms_content: "",
    whatsapp_content: "",
  });
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Refs for textareas to avoid DOM manipulation
  const masterContentRef = useRef<HTMLTextAreaElement>(null);
  const emailSubjectRef = useRef<HTMLInputElement>(null);
  const emailContentRef = useRef<HTMLTextAreaElement>(null);
  const smsContentRef = useRef<HTMLTextAreaElement>(null);
  const whatsappContentRef = useRef<HTMLTextAreaElement>(null);

  const { activeOrganization } = useOrganization();
  const { settings } = useOrganizationSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const [templatesResult, channelViewsResult] = await Promise.all([
        supabase
          .from('message_templates')
          .select('*')
          .eq('organization_id', activeOrganization?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('template_channel_views')
          .select('*')
      ]);

      if (templatesResult.error) throw templatesResult.error;
      if (channelViewsResult.error) throw channelViewsResult.error;

      setTemplates(templatesResult.data || []);
      setChannelViews(channelViewsResult.data || []);
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
      if (!formData.name || !formData.master_content) {
        toast({
          title: "Validation Error",
          description: "Name and content are required",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingTemplate) {
        const { error } = await supabase
          .from('message_templates')
          .update({
            name: formData.name,
            master_content: formData.master_content,
            master_subject: formData.subject,
            category: activeCategory,
            is_active: formData.is_active,
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
            master_subject: formData.subject,
            category: activeCategory,
            placeholders: PLACEHOLDERS.map(p => p.key),
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (error) throw error;

        // Create channel-specific views if provided
        if (newTemplate && (formData.email_content || formData.sms_content || formData.whatsapp_content)) {
          const channelInserts = [];
          
          if (formData.email_content) {
            channelInserts.push({
              template_id: newTemplate.id,
              channel: 'email',
              subject: formData.email_subject || formData.subject,
              content: formData.email_content,
              html_content: formData.email_content,
            });
          }
          
          if (formData.sms_content) {
            channelInserts.push({
              template_id: newTemplate.id,
              channel: 'sms',
              content: formData.sms_content,
            });
          }
          
          if (formData.whatsapp_content) {
            channelInserts.push({
              template_id: newTemplate.id,
              channel: 'whatsapp',
              content: formData.whatsapp_content,
            });
          }

          if (channelInserts.length > 0) {
            const { error: channelError } = await supabase
              .from('template_channel_views')
              .insert(channelInserts);

            if (channelError) throw channelError;
          }
        }
      }

      toast({
        title: "Success",
        description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`,
      });

      setIsModalOpen(false);
      setEditingTemplate(null);
      setFormData({
        name: "",
        master_content: "",
        subject: "",
        category: "",
        is_active: true,
        email_content: "",
        email_subject: "",
        sms_content: "",
        whatsapp_content: "",
      });
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

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;

    try {
      // Delete channel views first
      await supabase
        .from('template_channel_views')
        .delete()
        .eq('template_id', deletingTemplate.id);

      // Delete template
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', deletingTemplate.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      setDeletingTemplate(null);
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

  const insertVariable = (variable: string, targetField = 'master_content') => {
    let targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement> | null = null;
    
    // Get the appropriate ref based on the target field
    switch (targetField) {
      case 'master_content':
        targetRef = masterContentRef;
        break;
      case 'email_subject':
        targetRef = emailSubjectRef;
        break;
      case 'email_content':
        targetRef = emailContentRef;
        break;
      case 'sms_content':
        targetRef = smsContentRef;
        break;
      case 'whatsapp_content':
        targetRef = whatsappContentRef;
        break;
      default:
        targetRef = masterContentRef;
    }

    if (targetRef?.current) {
      const textarea = targetRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newValue = before + variable + after;
      
      // Update form data using functional update to ensure we have the latest state
      setFormData(prev => ({ ...prev, [targetField]: newValue }));
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 10);
    }
  };

  const replacePlaceholders = (content: string): string => {
    let result = content;
    PLACEHOLDERS.forEach(placeholder => {
      result = result.replace(new RegExp(placeholder.key.replace(/[{}]/g, '\\$&'), 'g'), placeholder.example);
    });
    return result;
  };

  const filteredTemplates = templates.filter(template => template.category === activeCategory);

  const duplicateTemplate = async (template: MessageTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      master_content: template.master_content,
      subject: template.master_subject || "",
      category: template.category,
      is_active: template.is_active,
      email_content: "",
      email_subject: "",
      sms_content: "",
      whatsapp_content: "",
    });
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleSendTestEmail = async () => {
    if (!editingTemplate && !formData.name) {
      toast({
        title: "Error",
        description: "Please save the template first before sending a test email",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTest(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Use current template data for test
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          templateName: formData.name || 'Draft Template',
          subject: formData.subject || formData.name || 'Test Subject',
          content: formData.master_content || 'Test content',
          recipientEmail: user.email,
          organizationId: activeOrganization?.id
        }
      });

      if (error) throw error;

      toast({
        title: "Email Sent Successfully",
        description: `Template preview has been sent to ${user.email}`,
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const toggleTemplateStatus = async (template: MessageTemplate) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Template ${!template.is_active ? 'activated' : 'deactivated'}`,
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template status:', error);
      toast({
        title: "Error",
        description: "Failed to update template status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchTemplates();
    }
  }, [activeOrganization?.id]);

  if (loading) {
    return <div className="p-6">Loading templates...</div>;
  }

  const organizationName = activeOrganization?.name;
  const brandColor = settings?.primary_brand_color;
  const logoUrl = settings?.logo_url;
  const businessName = settings?.photography_business_name;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-muted-foreground mt-1">
          Manage your communication templates across different channels
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-5">
          {TEMPLATE_CATEGORIES.map((category) => {
            const IconComponent = category.icon;
            return (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                <span className="hidden sm:inline">{category.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TEMPLATE_CATEGORIES.map((category) => (
          <TabsContent key={category.id} value={category.id} className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">{category.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {category.id === "messages" ? (
                    `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? 's' : ''}`
                  ) : (
                    "Coming Soon"
                  )}
                </p>
              </div>
              {category.id === "messages" ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/settings/templates/builder/new`)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        name: "",
                        master_content: "",
                        subject: "",
                        category: category.id,
                        is_active: true,
                        email_content: "",
                        email_subject: "",
                        sms_content: "",
                        whatsapp_content: "",
                      });
                      setEditingTemplate(null);
                      setIsModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Legacy Editor
                  </Button>
                </div>
              ) : (
                <Button disabled variant="outline">
                  Coming Soon
                </Button>
              )}
            </div>

            {category.id !== "messages" ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <category.icon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{category.title} - Coming Soon</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {category.title} templates will be available in a future update. 
                    Focus on Messages for now to get started with email communications.
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    Feature in Development
                  </Badge>
                </CardContent>
              </Card>
            ) : filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <category.icon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No {category.title.toLowerCase()} yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first {category.title.toLowerCase().slice(0, -1)} template to get started.
                  </p>
                  <Button onClick={() => {
                    setFormData({
                      name: "",
                      master_content: "",
                      subject: "",
                      category: category.id,
                      is_active: true,
                      email_content: "",
                      email_subject: "",
                      sms_content: "",
                      whatsapp_content: "",
                    });
                    setEditingTemplate(null);
                    setIsModalOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First {category.title.slice(0, -1)}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate text-muted-foreground">
                            {template.master_content.substring(0, 60)}
                            {template.master_content.length > 60 && '...'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {template.created_at ? format(new Date(template.created_at), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.is_active}
                              onCheckedChange={() => toggleTemplateStatus(template)}
                            />
                            <Badge variant={template.is_active ? "default" : "secondary"}>
                              {template.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                •••
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
                                setFormData({
                                  name: template.name,
                                  master_content: template.master_content,
                                  subject: template.master_subject || "",
                                  category: template.category,
                                  is_active: template.is_active,
                                  email_content: "",
                                  email_subject: "",
                                  sms_content: "",
                                  whatsapp_content: "",
                                });
                                setEditingTemplate(template);
                                setIsModalOpen(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setDeletingTemplate(template);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview Modal */}
      {previewTemplate && (
        <AppSheetModal
          title={`Preview: ${previewTemplate.name}`}
          isOpen={isPreviewOpen}
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
                subject={replacePlaceholders(previewTemplate.master_subject || previewTemplate.name)}
                content={replacePlaceholders(previewTemplate.master_content)}
                sender={`${businessName || organizationName || 'Your Studio'} <hello@yourstudio.com>`}
                recipient="Jane Smith <jane.smith@example.com>"
                studioName={businessName || organizationName || 'Your Studio'}
                brandColor={brandColor}
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
        isOpen={isModalOpen}
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
        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter template name"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Active Status</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Active templates can be used in workflows and automation
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div>
            <Label htmlFor="subject">Subject (for emails)</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email subject line"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="master_content">Master Content</Label>
              <div className="flex gap-2">
                <VariablePicker onVariableSelect={insertVariable} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSendingTest ? "Sending..." : "Send Test Email"}
                </Button>
              </div>
            </div>
            <Textarea
              id="master_content"
              name="master_content"
              ref={masterContentRef}
              value={formData.master_content}
              onChange={(e) => setFormData({ ...formData, master_content: e.target.value })}
              placeholder="Enter your template content..."
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This content will be used as the default for all channels unless overridden below.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Channel-Specific Content (Optional)</h3>
            <p className="text-xs text-muted-foreground">
              Customize content for specific channels. If left empty, master content will be used.
            </p>
            
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email_subject">Email Subject</Label>
                    <VariablePicker onVariableSelect={(variable) => insertVariable(variable, 'email_subject')} />
                  </div>
                  <Input
                    id="email_subject"
                    name="email_subject"
                    ref={emailSubjectRef}
                    value={formData.email_subject}
                    onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
                    placeholder="Custom email subject (leave empty to use master subject)"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email_content">Email Content</Label>
                    <VariablePicker onVariableSelect={(variable) => insertVariable(variable, 'email_content')} />
                  </div>
                  <Textarea
                    id="email_content"
                    name="email_content"
                    ref={emailContentRef}
                    value={formData.email_content}
                    onChange={(e) => setFormData({ ...formData, email_content: e.target.value })}
                    placeholder="Custom email content (leave empty to use master content)..."
                    className="min-h-[100px]"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="sms" className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms_content">SMS Content</Label>
                    <VariablePicker onVariableSelect={(variable) => insertVariable(variable, 'sms_content')} />
                  </div>
                  <Textarea
                    id="sms_content"
                    name="sms_content"
                    ref={smsContentRef}
                    value={formData.sms_content}
                    onChange={(e) => setFormData({ ...formData, sms_content: e.target.value })}
                    placeholder="Custom SMS content (leave empty to use master content, keep it short)..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    SMS messages should be concise (160 characters recommended).
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="whatsapp" className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="whatsapp_content">WhatsApp Content</Label>
                    <VariablePicker onVariableSelect={(variable) => insertVariable(variable, 'whatsapp_content')} />
                  </div>
                  <Textarea
                    id="whatsapp_content"
                    name="whatsapp_content"
                    ref={whatsappContentRef}
                    value={formData.whatsapp_content}
                    onChange={(e) => setFormData({ ...formData, whatsapp_content: e.target.value })}
                    placeholder="Custom WhatsApp content (leave empty to use master content)..."
                    className="min-h-[100px]"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </AppSheetModal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}