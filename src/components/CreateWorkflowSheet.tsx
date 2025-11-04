import { useState, useEffect } from "react";
import type { ComponentType } from "react";
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
import { WorkflowFormData, TriggerType, Workflow } from "@/types/workflow";
import { useTemplates } from "@/hooks/useTemplates";
import { cn } from "@/lib/utils";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { useTranslation } from "react-i18next";
interface EditableWorkflow extends Workflow {
  template_id?: string | null;
  reminder_delay_minutes?: number | null;
  email_enabled?: boolean | null;
  whatsapp_enabled?: boolean | null;
  sms_enabled?: boolean | null;
}

interface CreateWorkflowSheetProps {
  onCreateWorkflow: (data: WorkflowFormData) => Promise<void>;
  editWorkflow?: EditableWorkflow | null;
  onUpdateWorkflow?: (id: string, data: WorkflowFormData) => Promise<void>;
  setEditingWorkflow?: (workflow: EditableWorkflow | null) => void;
  children?: React.ReactNode;
}
type ChannelType = 'email' | 'sms' | 'whatsapp';
export function CreateWorkflowSheet({
  onCreateWorkflow,
  editWorkflow,
  onUpdateWorkflow,
  setEditingWorkflow,
  children
}: CreateWorkflowSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    sessionTemplates,
    loading: templatesLoading
  } = useTemplates();
  const isEditing = !!editWorkflow;

  const triggerOptions = [
    { value: 'session_scheduled', label: t('pages:workflows.createDialog.triggers.session_scheduled') },
    { value: 'session_completed', label: t('pages:workflows.createDialog.triggers.session_completed') },
    { value: 'session_cancelled', label: t('pages:workflows.createDialog.triggers.session_cancelled') },
    { value: 'session_rescheduled', label: t('pages:workflows.createDialog.triggers.session_rescheduled') },
    { value: 'session_reminder', label: t('pages:workflows.createDialog.triggers.session_reminder') }
  ];

  const reminderDelayOptions = [
    { value: 1440, label: t('pages:workflows.createDialog.reminderDelays.1440') },
    { value: 4320, label: t('pages:workflows.createDialog.reminderDelays.4320') },
    { value: 10080, label: t('pages:workflows.createDialog.reminderDelays.10080') },
    { value: 60, label: t('pages:workflows.createDialog.reminderDelays.60') }
  ];

  const channelConfigs: Record<ChannelType, { icon: ComponentType<{ className?: string }>; label: string; color: string }> = {
    email: { icon: Mail, label: t('pages:workflows.createDialog.channels.email'), color: 'bg-blue-500' },
    whatsapp: { icon: MessageCircle, label: t('pages:workflows.createDialog.channels.whatsapp'), color: 'bg-green-600' },
    sms: { icon: Phone, label: t('pages:workflows.createDialog.channels.sms'), color: 'bg-green-500' }
  };

  // Initialize form data based on edit workflow
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    trigger_type: 'session_scheduled',
    is_active: true,
    steps: []
  });
  
  // Track initial state for dirty detection
  const [initialFormData, setInitialFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    trigger_type: 'session_scheduled',
    is_active: true,
    steps: []
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [initialSelectedTemplate, setInitialSelectedTemplate] = useState<string>('');
  const [reminderDelay, setReminderDelay] = useState<number>(1440);
  const [initialReminderDelay, setInitialReminderDelay] = useState<number>(1440);
  const [enabledChannels, setEnabledChannels] = useState<Record<ChannelType, boolean>>({
    email: true,
    whatsapp: true,
    sms: true
  });
  const [initialEnabledChannels, setInitialEnabledChannels] = useState<Record<ChannelType, boolean>>({
    email: true,
    whatsapp: true,
    sms: true
  });

  // Auto-open when editWorkflow is provided and reset form data
  useEffect(() => {
    if (editWorkflow) {
      const newFormData = {
        name: editWorkflow.name || '',
        description: editWorkflow.description || '',
        trigger_type: editWorkflow.trigger_type || 'session_scheduled',
        is_active: editWorkflow.is_active ?? true,
        steps: []
      };
      const newSelectedTemplate = editWorkflow.template_id || '';
      const newReminderDelay = editWorkflow.reminder_delay_minutes || 1440;
      const newEnabledChannels = {
        email: editWorkflow.email_enabled ?? true,
        whatsapp: editWorkflow.whatsapp_enabled ?? true,
        sms: editWorkflow.sms_enabled ?? true
      };
      
      setFormData(newFormData);
      setInitialFormData(newFormData);
      setSelectedTemplate(newSelectedTemplate);
      setInitialSelectedTemplate(newSelectedTemplate);
      setReminderDelay(newReminderDelay);
      setInitialReminderDelay(newReminderDelay);
      setEnabledChannels(newEnabledChannels);
      setInitialEnabledChannels(newEnabledChannels);
      setOpen(true);
    } else {
      // Reset to defaults for new workflow
      const defaultFormData = {
        name: '',
        description: '',
        trigger_type: 'session_scheduled' as TriggerType,
        is_active: true,
        steps: []
      };
      const defaultSelectedTemplate = '';
      const defaultReminderDelay = 1440;
      const defaultEnabledChannels = {
        email: true,
        whatsapp: true,
        sms: true
      };
      
      setInitialFormData(defaultFormData);
      setInitialSelectedTemplate(defaultSelectedTemplate);
      setInitialReminderDelay(defaultReminderDelay);
      setInitialEnabledChannels(defaultEnabledChannels);
    }
  }, [editWorkflow]);
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.trigger_type || !selectedTemplate || !isTemplateValid) return;
    
    const activeChannels = (Object.entries(enabledChannels) as Array<[ChannelType, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([channel]) => channel);
    const workflowStep = {
      step_order: 1,
      action_type: 'send_notification' as const,
      action_config: {
        template_id: selectedTemplate,
        channels: activeChannels
      },
      delay_minutes: formData.trigger_type === 'session_reminder' ? reminderDelay : 0,
      is_active: true
    };
    const workflowData = {
      ...formData,
      steps: [workflowStep]
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
      steps: []
    });
    setSelectedTemplate('');
    setReminderDelay(1440);
    setEnabledChannels({
      email: true,
      whatsapp: true,
      sms: true
    });
  };
  const updateFormData = <Key extends keyof WorkflowFormData>(
    field: Key,
    value: WorkflowFormData[Key]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const toggleChannel = (channel: ChannelType) => {
    setEnabledChannels(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
  };
  const selectedTemplateData = sessionTemplates.find(t => t.id === selectedTemplate);
  const isTemplateValid = selectedTemplate ? !!selectedTemplateData : true;
  const hasEnabledChannels = Object.values(enabledChannels).some(enabled => enabled);
  
  // Auto-clear invalid template selection when templates are loaded
  useEffect(() => {
    if (selectedTemplate && !templatesLoading && sessionTemplates.length > 0 && !selectedTemplateData) {
      console.warn(`Template ${selectedTemplate} not found, clearing selection`);
      setSelectedTemplate('');
    }
  }, [selectedTemplate, templatesLoading, sessionTemplates, selectedTemplateData]);
  // Check if form has actual changes from initial state
  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData) || 
                  selectedTemplate !== initialSelectedTemplate ||
                  reminderDelay !== initialReminderDelay ||
                  JSON.stringify(enabledChannels) !== JSON.stringify(initialEnabledChannels);

  // Modal navigation guard
  const {
    showGuard,
    message: guardMessage,
    handleModalClose,
    handleDiscardChanges,
    handleStayOnModal,
    handleSaveAndExit
  } = useModalNavigation({
    isDirty,
    onDiscard: () => {
      handleClose();
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    },
    message: t('pages:workflows.createDialog.navigationGuard.message')
  });

  const handleDirtyClose = () => {
    const canClose = handleModalClose();
    if (canClose) {
      handleClose();
    }
  };
  const footerActions = [{
    label: t('pages:workflows.createDialog.buttons.cancel'),
    onClick: handleClose,
    variant: 'outline' as const
  }, {
    label: isEditing ? t('pages:workflows.createDialog.buttons.update') : t('pages:workflows.createDialog.buttons.create'),
    onClick: handleSubmit,
    disabled: loading || !formData.name.trim() || !selectedTemplate || !hasEnabledChannels || !isTemplateValid,
    loading
  }];
  return <>
      {children && <div onClick={() => setOpen(true)}>
          {children}
        </div>}
      
      <AppSheetModal title={isEditing ? t('pages:workflows.createDialog.titleEdit') : t('pages:workflows.createDialog.titleCreate')} isOpen={open} onOpenChange={newOpen => {
      if (!newOpen) {
        handleDirtyClose();
      } else {
        setOpen(true);
      }
    }} footerActions={footerActions} dirty={isDirty} onDirtyClose={handleDirtyClose} size="lg">
        <div className="space-y-6 mt-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('pages:workflows.createDialog.fields.name.label')}</Label>
              <Input id="name" placeholder={t('pages:workflows.createDialog.fields.name.placeholder')} value={formData.name} onChange={e => updateFormData('name', e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('pages:workflows.createDialog.fields.description.label')}</Label>
              <Textarea id="description" placeholder={t('pages:workflows.createDialog.fields.description.placeholder')} value={formData.description} onChange={e => updateFormData('description', e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger">{t('pages:workflows.createDialog.fields.trigger.label')}</Label>
              <Select value={formData.trigger_type} onValueChange={value => updateFormData('trigger_type', value as TriggerType)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pages:workflows.createDialog.fields.trigger.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map(option => <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reminder Timing - Only for session_reminder */}
          {formData.trigger_type === 'session_reminder' && <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('pages:workflows.createDialog.fields.reminderTiming.label')}</Label>
                <Select value={reminderDelay.toString()} onValueChange={value => setReminderDelay(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderDelayOptions.map(option => <SelectItem key={option.value} value={option.value.toString()}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>}

          <Separator />

          {/* Template Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('pages:workflows.createDialog.fields.template.label')}</Label>
              
              {templatesLoading ? (
                <div className="text-sm text-muted-foreground">{t('pages:workflows.createDialog.fields.template.loading')}</div>
              ) : sessionTemplates.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                  {t('pages:workflows.createDialog.fields.template.emptyState')}
                </div>
              ) : (
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages:workflows.createDialog.fields.template.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Channel Selection */}
          <div className="space-y-4">
            <div>
              <Label>{t('pages:workflows.createDialog.fields.channels.label')}</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t('pages:workflows.createDialog.fields.channels.description')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {Object.entries(channelConfigs).map(([channel, config]) => {
              const IconComponent = config.icon;
              const isEnabled = enabledChannels[channel as ChannelType];
              return <div key={channel} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isEnabled ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${config.color} bg-opacity-20`}>
                        <IconComponent className={`h-4 w-4 text-white`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('pages:workflows.createDialog.fields.channels.sendVia', { channel: config.label.toLowerCase() })}
                        </p>
                      </div>
                    </div>
                    <Switch checked={isEnabled} onCheckedChange={() => toggleChannel(channel as ChannelType)} />
                  </div>;
            })}
            </div>

            {!hasEnabledChannels && <div className="text-sm text-destructive">
                {t('pages:workflows.createDialog.fields.channels.error')}
              </div>}
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="active">{t('pages:workflows.createDialog.fields.startActive.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('pages:workflows.createDialog.fields.startActive.description')}
              </p>
            </div>
            <Switch id="active" checked={formData.is_active} onCheckedChange={checked => updateFormData('is_active', checked)} />
          </div>

        </div>
      </AppSheetModal>
      
      {/* Navigation Guard Dialog */}
      <NavigationGuardDialog
        open={showGuard}
        onDiscard={handleDiscardChanges}
        onStay={handleStayOnModal}
        onSaveAndExit={handleSaveAndExit}
        message={guardMessage}
      />
      
      {!children && <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('pages:workflows.buttons.createWorkflow')}
        </Button>}
    </>;
}
