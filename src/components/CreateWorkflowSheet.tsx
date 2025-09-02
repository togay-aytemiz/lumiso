import { useState, useEffect } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, Mail, MessageCircle, Phone, Clock } from "lucide-react";
import { WorkflowFormData, TriggerType } from "@/types/workflow";
import { useTemplates } from "@/hooks/useTemplates";

interface CreateWorkflowSheetProps {
  onCreateWorkflow: (data: WorkflowFormData) => Promise<void>;
  editWorkflow?: any;
  onUpdateWorkflow?: (id: string, data: WorkflowFormData) => Promise<void>;
  setEditingWorkflow?: (workflow: any) => void;
  children?: React.ReactNode;
}

const triggerOptions = [
  { value: 'session_scheduled', label: 'Session Scheduled' },
  { value: 'session_completed', label: 'Session Completed' },
  { value: 'session_cancelled', label: 'Session Cancelled' },
  { value: 'session_rescheduled', label: 'Session Rescheduled' },
  { value: 'session_reminder', label: 'Session Reminder' },
];

const reminderDelayOptions = [
  { value: 1440, label: '1 day before' },
  { value: 4320, label: '3 days before' },
  { value: 10080, label: '1 week before' },
  { value: 60, label: '1 hour before' },
  { value: 480, label: 'Same day morning (8 AM)' },
];

type ChannelType = 'email' | 'sms' | 'whatsapp';

interface ChannelConfig {
  enabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

const channelConfigs: Record<ChannelType, ChannelConfig> = {
  email: { enabled: true, icon: Mail, label: 'Email', color: 'bg-blue-500' },
  whatsapp: { enabled: true, icon: MessageCircle, label: 'WhatsApp', color: 'bg-green-600' },
  sms: { enabled: true, icon: Phone, label: 'SMS', color: 'bg-green-500' },
};

export function CreateWorkflowSheet({ onCreateWorkflow, editWorkflow, onUpdateWorkflow, setEditingWorkflow, children }: CreateWorkflowSheetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const { sessionTemplates, loading: templatesLoading } = useTemplates();
  
  const isEditing = !!editWorkflow;
  
  // Initialize form data based on edit workflow
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    trigger_type: 'session_scheduled',
    is_active: true,
    steps: [],
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [reminderDelay, setReminderDelay] = useState<number>(1440);
  const [enabledChannels, setEnabledChannels] = useState<Record<ChannelType, boolean>>({
    email: true,
    whatsapp: true,
    sms: true,
  });

  // Auto-open when editWorkflow is provided and reset form data
  useEffect(() => {
    if (editWorkflow) {
      setFormData({
        name: editWorkflow.name || '',
        description: editWorkflow.description || '',
        trigger_type: editWorkflow.trigger_type || 'session_scheduled',
        is_active: editWorkflow.is_active ?? true,
        steps: [],
      });
      setSelectedTemplate('');
      setTemplateSearch('');
      setReminderDelay(1440);
      setEnabledChannels({ email: true, whatsapp: true, sms: true });
      setOpen(true);
    }
  }, [editWorkflow]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.trigger_type || !selectedTemplate) return;

    const activeChannels = Object.entries(enabledChannels)
      .filter(([_, enabled]) => enabled)
      .map(([channel, _]) => channel) as ('email' | 'sms' | 'whatsapp')[];

    const workflowStep = {
      step_order: 1,
      action_type: 'send_notification' as const,
      action_config: {
        template_id: selectedTemplate,
        channels: activeChannels,
      },
      delay_minutes: formData.trigger_type === 'session_reminder' ? reminderDelay : 0,
      is_active: true,
    };

    const workflowData = {
      ...formData,
      steps: [workflowStep],
    };

    try {
      setLoading(true);
      if (isEditing && onUpdateWorkflow) {
        await onUpdateWorkflow(editWorkflow.id, workflowData);
      } else {
        await onCreateWorkflow(workflowData);
      }
      handleClose();
    } catch (error) {
      console.error('Error saving workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingWorkflow?.(null);
    // Reset form
    setFormData({
      name: '',
      description: '',
      trigger_type: 'session_scheduled',
      is_active: true,
      steps: [],
    });
    setSelectedTemplate('');
    setTemplateSearch('');
    setReminderDelay(1440);
    setEnabledChannels({ email: true, whatsapp: true, sms: true });
  };

  const updateFormData = (field: keyof WorkflowFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleChannel = (channel: ChannelType) => {
    setEnabledChannels(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
  };

  const selectedTemplateData = sessionTemplates.find(t => t.id === selectedTemplate);
  const hasEnabledChannels = Object.values(enabledChannels).some(enabled => enabled);
  const isDirty = formData.name.trim() !== '' || formData.description !== '' || selectedTemplate !== '';

  const filteredTemplates = sessionTemplates.filter(template =>
    template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    template.description?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const footerActions = [
    {
      label: 'Cancel',
      onClick: handleClose,
      variant: 'outline' as const,
    },
    {
      label: isEditing ? 'Update Workflow' : 'Create Workflow',
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim() || !selectedTemplate || !hasEnabledChannels,
      loading,
    },
  ];

  return (
    <>
      {children && (
        <div onClick={() => setOpen(true)}>
          {children}
        </div>
      )}
      
      <AppSheetModal
        title={isEditing ? 'Edit Workflow' : 'Create New Workflow'}
        isOpen={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            handleClose();
          } else {
            setOpen(true);
          }
        }}
        footerActions={footerActions}
        dirty={isDirty}
        onDirtyClose={() => {
          if (confirm('You have unsaved changes. Are you sure you want to close?')) {
            handleClose();
          }
        }}
        size="lg"
      >
        <div className="space-y-6 mt-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Session Confirmation Notifications"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this workflow does..."
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger">Trigger Event *</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value) => updateFormData('trigger_type', value as TriggerType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger event" />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reminder Timing - Only for session_reminder */}
          {formData.trigger_type === 'session_reminder' && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Reminder Timing *</Label>
                  <Select value={reminderDelay.toString()} onValueChange={(value) => setReminderDelay(Number(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reminderDelayOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Template Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message Template *</Label>
              {templatesLoading ? (
                <div className="text-sm text-muted-foreground">Loading templates...</div>
              ) : sessionTemplates.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                  No session templates found. Please create a template first in the Templates section.
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            {template.description && (
                              <div className="text-xs text-muted-foreground">{template.description}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {selectedTemplateData && (
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{selectedTemplateData.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedTemplateData.description && (
                    <p className="text-sm text-muted-foreground">{selectedTemplateData.description}</p>
                  )}
                  {selectedTemplateData.subject && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-muted-foreground">Subject: </span>
                      <span className="text-xs">{selectedTemplateData.subject}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Channel Selection */}
          <div className="space-y-4">
            <div>
              <Label>Notification Channels</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which channels to send notifications through
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {Object.entries(channelConfigs).map(([channel, config]) => {
                const IconComponent = config.icon;
                const isEnabled = enabledChannels[channel as ChannelType];
                
                return (
                  <div
                    key={channel}
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      isEnabled ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${config.color} bg-opacity-20`}>
                        <IconComponent className={`h-4 w-4 text-white`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Send via {config.label.toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleChannel(channel as ChannelType)}
                    />
                  </div>
                );
              })}
            </div>

            {!hasEnabledChannels && (
              <div className="text-sm text-destructive">
                Please enable at least one notification channel
              </div>
            )}
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="active">Start Active</Label>
              <p className="text-sm text-muted-foreground">
                Workflow will start processing triggers immediately
              </p>
            </div>
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateFormData('is_active', checked)}
            />
          </div>

        </div>
      </AppSheetModal>
      
      {!children && (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      )}
    </>
  );
}