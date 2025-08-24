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
  { value: 'session_confirmation', label: 'Session Confirmation' },
  { value: 'session_reminder', label: 'Session Reminder' },
  { value: 'session_rescheduled', label: 'Session Rescheduled' },
  { value: 'session_cancelled', label: 'Session Cancelled' },
  { value: 'session_completed', label: 'Session Completed' }
];

const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'sms', label: 'SMS', icon: Phone }
];

const PLACEHOLDERS = [
  'customer_name',
  'session_type', 
  'session_date',
  'session_time',
  'session_location',
  'studio_name',
  'studio_phone'
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
    email_content: '',
    email_subject: '',
    email_html: '',
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
            placeholders: PLACEHOLDERS
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
            placeholders: PLACEHOLDERS
          })
          .select()
          .single();

        if (error) throw error;
        templateData = data;
      }

      // Handle channel views
      const channelUpdates = [];

      // Email channel
      if (newTemplate.email_content || newTemplate.email_subject || newTemplate.email_html) {
        channelUpdates.push({
          template_id: templateData.id,
          channel: 'email',
          content: newTemplate.email_content || null,
          subject: newTemplate.email_subject || null,
          html_content: newTemplate.email_html || null
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
      email_content: '',
      email_subject: '',
      email_html: '',
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
          email_subject: cv.subject || '',
          email_html: cv.html_content || ''
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
      email_content: '',
      email_subject: '',
      email_html: '',
      whatsapp_content: '',
      sms_content: ''
    });
  };

  const insertPlaceholder = (placeholder: string, field: keyof typeof newTemplate) => {
    const currentContent = newTemplate[field] || '';
    setNewTemplate({
      ...newTemplate,
      [field]: currentContent + `{${placeholder}}`
    });
  };

  const copyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(`{${placeholder}}`);
    setCopiedPlaceholder(placeholder);
    setTimeout(() => setCopiedPlaceholder(null), 2000);
  };

  const getCategoryLabel = (category: string) => {
    return TEMPLATE_CATEGORIES.find(cat => cat.value === category)?.label || category;
  };

  const getChannelIcon = (channel: string) => {
    const channelData = CHANNELS.find(c => c.value === channel);
    return channelData?.icon || FileText;
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
                  Create and manage templates for different session events
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
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="master_content">Master Message</Label>
              <Textarea
                id="master_content"
                value={newTemplate.master_content}
                onChange={(e) => setNewTemplate({ ...newTemplate, master_content: e.target.value })}
                placeholder="This is the default message that will be used if no channel-specific content is defined"
                rows={3}
              />
            </div>
          </div>

          {/* Placeholders */}
          <div className="space-y-2">
            <Label>Available Placeholders</Label>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map((placeholder) => (
                <Button
                  key={placeholder}
                  variant="outline"
                  size="sm"
                  onClick={() => copyPlaceholder(placeholder)}
                  className="text-xs"
                >
                  {copiedPlaceholder === placeholder ? (
                    <Check className="w-3 h-3 mr-1" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1" />
                  )}
                  {`{${placeholder}}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click to copy placeholders to clipboard, then paste into your message content
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
                <Label htmlFor="email_subject">Email Subject</Label>
                <Input
                  id="email_subject"
                  value={newTemplate.email_subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, email_subject: e.target.value })}
                  placeholder="Subject line for email (leave empty to use master message)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_content">Email Content (Plain Text)</Label>
                <Textarea
                  id="email_content"
                  value={newTemplate.email_content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, email_content: e.target.value })}
                  placeholder="Plain text version (leave empty to use master message)"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_html">Email Content (HTML)</Label>
                <Textarea
                  id="email_html"
                  value={newTemplate.email_html}
                  onChange={(e) => setNewTemplate({ ...newTemplate, email_html: e.target.value })}
                  placeholder="HTML version with rich formatting"
                  rows={6}
                />
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp_content">WhatsApp Message</Label>
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
                <Label htmlFor="sms_content">SMS Message</Label>
                <Textarea
                  id="sms_content"
                  value={newTemplate.sms_content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, sms_content: e.target.value })}
                  placeholder="Condensed message under 160 characters (leave empty to use master message)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  📱 Keep it short - SMS messages are best under 160 characters
                </p>
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </AppSheetModal>

      {/* Preview Dialog */}
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

            <Tabs defaultValue="master" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="master">Master</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
              </TabsList>

              <TabsContent value="master" className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">{previewTemplate.master_content}</p>
                </div>
              </TabsContent>

              {CHANNELS.map(channel => {
                const channelView = channelViews.find(cv => 
                  cv.template_id === previewTemplate.id && cv.channel === channel.value
                );
                
                return (
                  <TabsContent key={channel.value} value={channel.value} className="space-y-4">
                    {channelView ? (
                      <div className="space-y-4">
                        {channelView.subject && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Subject</Label>
                            <div className="p-2 bg-muted rounded text-sm font-medium">
                              {channelView.subject}
                            </div>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground">Content</Label>
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm whitespace-pre-wrap">
                              {channelView.content || previewTemplate.master_content}
                            </p>
                          </div>
                        </div>
                        {channelView.html_content && (
                          <div>
                            <Label className="text-xs text-muted-foreground">HTML Version</Label>
                            <div className="p-4 bg-muted rounded-lg">
                              <div 
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: channelView.html_content }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          No custom content for {channel.label}. Will use master message:
                        </p>
                        <p className="text-sm mt-2">{previewTemplate.master_content}</p>
                      </div>
                    )}
                  </TabsContent>
                );
               })}
            </Tabs>
          </div>
        )}
      </AppSheetModal>
    </SettingsPageWrapper>
  );
}