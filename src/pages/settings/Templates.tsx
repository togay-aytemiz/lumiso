import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmailPreview } from "@/components/templates/EmailPreview";
import { WhatsAppPreview } from "@/components/templates/WhatsAppPreview";
import { SMSPreview } from "@/components/templates/SMSPreview";
import { VariablePicker } from "@/components/templates/VariablePicker";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  MessageCircle, 
  Phone, 
  FileText,
  Eye,
  Copy,
  Check
} from "lucide-react";

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
  master_subject?: string;
  placeholders: any; // Json type from Supabase
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateChannelView {
  id: string;
  template_id: string;
  channel: string;
  content: string | null;
  html_content: string | null;  
  subject: string | null;
  metadata: any; // Json type from Supabase
}

const TEMPLATE_CATEGORIES = [
  { 
    group: 'Communication', 
    items: [
      { value: 'session_confirmation', label: 'Session Confirmation' },
      { value: 'session_reminder', label: 'Session Reminder' },
      { value: 'session_rescheduled', label: 'Session Rescheduled' },
      { value: 'session_cancelled', label: 'Session Cancelled' },
      { value: 'session_completed', label: 'Session Completed' },
      { value: 'payment_reminder', label: 'Payment Reminder' },
      { value: 'welcome_message', label: 'Welcome Message' }
    ]
  }
];

const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'sms', label: 'SMS', icon: Phone }
];

const PLACEHOLDERS = [
  { key: 'customer_name', label: 'Customer Name', example: 'Jane Smith' },
  { key: 'session_type', label: 'Session Type', example: 'Wedding Photography' },
  { key: 'session_date', label: 'Session Date', example: 'Saturday, March 15, 2024' },
  { key: 'session_time', label: 'Session Time', example: '2:00 PM' },
  { key: 'session_location', label: 'Session Location', example: 'Central Park' },
  { key: 'studio_name', label: 'Studio Name', example: 'Sunset Photography Studio' },
  { key: 'studio_phone', label: 'Studio Phone', example: '+1 (555) 123-4567' },
  { key: 'studio_email', label: 'Studio Email', example: 'hello@sunsetphoto.com' },
  { key: 'booking_link', label: 'Booking Link', example: 'https://studio.com/book' },
  { key: 'reschedule_link', label: 'Reschedule Link', example: 'https://studio.com/reschedule' },
  { key: 'payment_amount', label: 'Payment Amount', example: '$500' },
  { key: 'payment_due_date', label: 'Payment Due Date', example: 'March 10, 2024' }
];

export default function Templates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channelViews, setChannelViews] = useState<TemplateChannelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState<string | null>(null);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: '',
    master_content: '',
    master_subject: '',
    email_content: '',
    email_subject: '',
    whatsapp_content: '',
    sms_content: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('message_templates')
        .select('*')
        .order('category', { ascending: true });

      if (templatesError) throw templatesError;

      const { data: channelViewsData, error: channelViewsError } = await supabase
        .from('template_channel_views')
        .select('*');

      if (channelViewsError) throw channelViewsError;

      setTemplates(templatesData || []);
      setChannelViews(channelViewsData || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('No authenticated user');

      // Get active organization
      const { data: orgData } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!orgData?.active_organization_id) throw new Error('No active organization');

      let templateData;
      
      if (editingTemplate) {
        // Update existing template
        const { data, error } = await supabase
          .from('message_templates')
          .update({
            name: newTemplate.name,
            category: newTemplate.category,
            master_content: newTemplate.master_content,
            master_subject: newTemplate.master_subject || null,
            placeholders: PLACEHOLDERS.map(p => p.key)
          })
          .eq('id', editingTemplate.id)
          .select()
          .single();

        if (error) throw error;
        templateData = data;
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('message_templates')
          .insert({
            user_id: userData.user.id,
            organization_id: orgData.active_organization_id,
            name: newTemplate.name,
            category: newTemplate.category,
            master_content: newTemplate.master_content,
            master_subject: newTemplate.master_subject || null,
            placeholders: PLACEHOLDERS.map(p => p.key)
          })
          .select()
          .single();

        if (error) throw error;
        templateData = data;
      }

      // Handle channel views
      const channelUpdates = [];

      // Email channel
      if (newTemplate.email_content || newTemplate.email_subject) {
        channelUpdates.push({
          template_id: templateData.id,
          channel: 'email',
          content: newTemplate.email_content || null,
          subject: newTemplate.email_subject || null,
          html_content: null
        });
      }

      // WhatsApp channel
      if (newTemplate.whatsapp_content) {
        channelUpdates.push({
          template_id: templateData.id,
          channel: 'whatsapp',
          content: newTemplate.whatsapp_content
        });
      }

      // SMS channel
      if (newTemplate.sms_content) {
        channelUpdates.push({
          template_id: templateData.id,
          channel: 'sms',
          content: newTemplate.sms_content
        });
      }

      if (channelUpdates.length > 0) {
        // Delete existing channel views for this template
        await supabase
          .from('template_channel_views')
          .delete()
          .eq('template_id', templateData.id);

        // Insert new channel views
        const { error: channelError } = await supabase
          .from('template_channel_views')
          .insert(channelUpdates);

        if (channelError) throw channelError;
      }

      toast({
        title: "Success",
        description: editingTemplate ? "Template updated successfully" : "Template created successfully",
      });

      handleCancelTemplate();
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

  const handleEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      category: template.category,
      master_content: template.master_content,
      master_subject: template.master_subject || '',
      email_content: '',
      email_subject: '',
      whatsapp_content: '',
      sms_content: ''
    });

    // Load existing channel views
    const templateChannelViews = channelViews.filter(cv => cv.template_id === template.id);
    templateChannelViews.forEach(cv => {
      if (cv.channel === 'email') {
        setNewTemplate(prev => ({
          ...prev,
          email_content: cv.content || '',
          email_subject: cv.subject || ''
        }));
      } else if (cv.channel === 'whatsapp') {
        setNewTemplate(prev => ({ ...prev, whatsapp_content: cv.content || '' }));
      } else if (cv.channel === 'sms') {
        setNewTemplate(prev => ({ ...prev, sms_content: cv.content || '' }));
      }
    });

    setIsSheetOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });

      fetchTemplates();
      setDeleteTemplateId(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const handleCancelTemplate = () => {
    setIsSheetOpen(false);
    setEditingTemplate(null);
    setNewTemplate({
      name: '',
      category: '',
      master_content: '',
      master_subject: '',
      email_content: '',
      email_subject: '',
      whatsapp_content: '',
      sms_content: ''
    });
  };

  const insertVariable = (variableKey: string, field: keyof typeof newTemplate) => {
    const currentContent = newTemplate[field] || '';
    setNewTemplate({
      ...newTemplate,
      [field]: currentContent + `{${variableKey}}`
    });
  };

  const copyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(`{${placeholder}}`);
    setCopiedPlaceholder(placeholder);
    setTimeout(() => setCopiedPlaceholder(null), 2000);
  };

  const getCategoryLabel = (category: string) => {
    // Find the category in the grouped structure
    for (const group of TEMPLATE_CATEGORIES) {
      const item = group.items.find(item => item.value === category);
      if (item) return item.label;
    }
    return category;
  };

  const getChannelIcon = (channel: string) => {
    const channelData = CHANNELS.find(c => c.value === channel);
    return channelData?.icon || FileText;
  };

  // Replace placeholders with sample data for preview
  const replacePlaceholders = (content: string) => {
    let result = content;
    PLACEHOLDERS.forEach(placeholder => {
      result = result.replace(
        new RegExp(`\\{${placeholder.key}\\}`, 'g'), 
        placeholder.example
      );
    });
    return result;
  };

  if (loading) {
    return (
      <SettingsPageWrapper>
        <SettingsHeader 
          title="Templates"
          description="Manage message templates for automated communications"
        />
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <SettingsHeader 
        title="Templates"
        description="Manage message templates for automated communications"
      />

      <div className="space-y-6">
        {/* Templates List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Message Templates
                </CardTitle>
                <CardDescription>
                  Create and manage templates for different communication channels
                </CardDescription>
              </div>
              <Button onClick={() => setIsSheetOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templates.length > 0 ? (
              <div className="space-y-4">
                {templates.map((template) => {
                  const templateChannelViews = channelViews.filter(cv => cv.template_id === template.id);
                  return (
                    <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant="outline">{getCategoryLabel(template.category)}</Badge>
                          <div className="flex gap-1">
                            {templateChannelViews.map((cv) => {
                              const Icon = getChannelIcon(cv.channel);
                              return (
                                <Badge key={cv.channel} variant="secondary" className="text-xs">
                                  <Icon className="w-3 h-3 mr-1" />
                                  {cv.channel}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.master_content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPreviewTemplate(template);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTemplateId(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No templates created yet</p>
                <p className="text-sm">Create your first template to get started with automated messaging</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone and will affect any workflows using this template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && handleDeleteTemplate(deleteTemplateId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Template Sheet */}
      <AppSheetModal
        title={editingTemplate ? "Edit Template" : "Create Template"}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        size="lg"
        footerActions={[
          { label: "Cancel", onClick: handleCancelTemplate, variant: "outline" },
          { 
            label: editingTemplate ? "Update Template" : "Create Template", 
            onClick: handleSaveTemplate,
            disabled: !newTemplate.name || !newTemplate.category || !newTemplate.master_content
          }
        ]}
      >
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="e.g. Session Confirmation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={newTemplate.category}
                onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template category" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((group) => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {group.group}
                      </div>
                      {group.items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="master_subject">Master Subject Line</Label>
              <Input
                id="master_subject"
                value={newTemplate.master_subject}
                onChange={(e) => setNewTemplate({ ...newTemplate, master_subject: e.target.value })}
                placeholder="Default subject line that channels can inherit"
              />
              <p className="text-xs text-muted-foreground">
                This will be used as the default subject for emails if no channel-specific subject is defined
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="master_content">Master Message</Label>
                <VariablePicker onVariableSelect={(key) => insertVariable(key, 'master_content')} />
              </div>
              <Textarea
                id="master_content"
                value={newTemplate.master_content}
                onChange={(e) => setNewTemplate({ ...newTemplate, master_content: e.target.value })}
                placeholder="This is the default message that will be used if no channel-specific content is defined"
                rows={3}
              />
            </div>
          </div>

          {/* Enhanced Placeholders */}
          <div className="space-y-2">
            <Label>Available Placeholders</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PLACEHOLDERS.map((placeholder) => (
                <Button
                  key={placeholder.key}
                  variant="outline"
                  size="sm"
                  onClick={() => copyPlaceholder(placeholder.key)}
                  className="text-xs flex-col h-auto py-2 justify-start"
                  title={`Example: ${placeholder.example}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {copiedPlaceholder === placeholder.key ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span className="font-mono text-xs">{`{${placeholder.key}}`}</span>
                  </div>
                  <span className="font-normal text-muted-foreground text-xs">
                    {placeholder.label}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Click to copy placeholders, then paste into your message content. Hover to see examples.
            </p>
          </div>

          {/* Channel-Specific Content */}
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                SMS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email_subject">Email Subject</Label>
                  <VariablePicker onVariableSelect={(key) => insertVariable(key, 'email_subject')} />
                </div>
                <Input
                  id="email_subject"
                  value={newTemplate.email_subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, email_subject: e.target.value })}
                  placeholder="Subject line for email (leave empty to inherit from master subject)"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use master subject line
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email_content">Email Content</Label>
                  <VariablePicker onVariableSelect={(key) => insertVariable(key, 'email_content')} />
                </div>
                <Textarea
                  id="email_content"
                  value={newTemplate.email_content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, email_content: e.target.value })}
                  placeholder="Email message (leave empty to use master message)"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use master message
                </p>
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="whatsapp_content">WhatsApp Message</Label>
                  <VariablePicker onVariableSelect={(key) => insertVariable(key, 'whatsapp_content')} />
                </div>
                <Textarea
                  id="whatsapp_content"
                  value={newTemplate.whatsapp_content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, whatsapp_content: e.target.value })}
                  placeholder="Short, emoji-friendly message (leave empty to use master message)"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Keep it concise and add emojis for better engagement
                </p>
              </div>
            </TabsContent>

            <TabsContent value="sms" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sms_content">SMS Message</Label>
                  <VariablePicker onVariableSelect={(key) => insertVariable(key, 'sms_content')} />
                </div>
                <Textarea
                  id="sms_content"
                  value={newTemplate.sms_content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, sms_content: e.target.value })}
                  placeholder="Condensed message under 160 characters (leave empty to use master message)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  📱 Keep it short - SMS messages are best under 160 characters ({newTemplate.sms_content.length}/160)
                </p>
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </AppSheetModal>

      {/* Enhanced Preview Dialog */}
      <AppSheetModal
        title="Template Preview"
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        size="lg"
      >
        {previewTemplate && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-medium">{previewTemplate.name}</h4>
              <Badge variant="outline">{getCategoryLabel(previewTemplate.category)}</Badge>
            </div>

            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="master">Master</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-4">
                {(() => {
                  const channelView = channelViews.find(cv => 
                    cv.template_id === previewTemplate.id && cv.channel === 'email'
                  );
                  const subject = channelView?.subject || previewTemplate.master_subject || 'No Subject';
                  const content = channelView?.content || previewTemplate.master_content;
                  const htmlContent = channelView?.html_content;
                  
                  return (
                    <EmailPreview
                      subject={replacePlaceholders(subject)}
                      content={replacePlaceholders(content)}
                      htmlContent={htmlContent ? replacePlaceholders(htmlContent) : undefined}
                    />
                  );
                })()}
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-4">
                {(() => {
                  const channelView = channelViews.find(cv => 
                    cv.template_id === previewTemplate.id && cv.channel === 'whatsapp'
                  );
                  const content = channelView?.content || previewTemplate.master_content;
                  
                  return (
                    <WhatsAppPreview
                      content={replacePlaceholders(content)}
                    />
                  );
                })()}
              </TabsContent>

              <TabsContent value="sms" className="space-y-4">
                {(() => {
                  const channelView = channelViews.find(cv => 
                    cv.template_id === previewTemplate.id && cv.channel === 'sms'
                  );
                  const content = channelView?.content || previewTemplate.master_content;
                  
                  return (
                    <SMSPreview
                      content={replacePlaceholders(content)}
                    />
                  );
                })()}
              </TabsContent>

              <TabsContent value="master" className="space-y-4">
                <div className="space-y-4">
                  {previewTemplate.master_subject && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Master Subject</Label>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">
                          {replacePlaceholders(previewTemplate.master_subject)}
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Master Content</Label>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">
                        {replacePlaceholders(previewTemplate.master_content)}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </AppSheetModal>
    </SettingsPageWrapper>
  );
}