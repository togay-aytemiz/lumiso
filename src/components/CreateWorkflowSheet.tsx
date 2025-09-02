import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { WorkflowFormData, TriggerType } from "@/types/workflow";
import { useTemplates } from "@/hooks/useTemplates";

interface CreateWorkflowSheetProps {
  onCreateWorkflow: (data: WorkflowFormData) => Promise<void>;
  children?: React.ReactNode;
}

const triggerOptions = [
  { value: 'session_scheduled', label: 'Session Scheduled' },
  { value: 'session_confirmed', label: 'Session Confirmed' },
  { value: 'session_completed', label: 'Session Completed' },
  { value: 'session_cancelled', label: 'Session Cancelled' },
  { value: 'session_rescheduled', label: 'Session Rescheduled' },
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
  sms: { enabled: true, icon: Phone, label: 'SMS', color: 'bg-green-500' },
  whatsapp: { enabled: true, icon: MessageCircle, label: 'WhatsApp', color: 'bg-green-600' },
};

export function CreateWorkflowSheet({ onCreateWorkflow, children }: CreateWorkflowSheetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { sessionTemplates, loading: templatesLoading } = useTemplates();
  
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    trigger_type: 'session_scheduled',
    is_active: true,
    steps: [],
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [enabledChannels, setEnabledChannels] = useState<Record<ChannelType, boolean>>({
    email: true,
    sms: true,
    whatsapp: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.trigger_type || !selectedTemplate) return;

    const activeChannels = Object.entries(enabledChannels)
      .filter(([_, enabled]) => enabled)
      .map(([channel, _]) => channel) as ('email' | 'sms' | 'whatsapp')[];

    const workflowStep = {
      step_order: 1,
      action_type: 'send_email' as const, // Use existing action type
      action_config: {
        template_id: selectedTemplate,
        channels: activeChannels,
      },
      delay_minutes: 0,
      is_active: true,
    };

    const workflowData = {
      ...formData,
      steps: [workflowStep],
    };

    try {
      setLoading(true);
      await onCreateWorkflow(workflowData);
      setOpen(false);
      // Reset form
      setFormData({
        name: '',
        description: '',
        trigger_type: 'session_scheduled',
        is_active: true,
        steps: [],
      });
      setSelectedTemplate('');
      setEnabledChannels({ email: true, sms: true, whatsapp: true });
    } catch (error) {
      console.error('Error creating workflow:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Workflow</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
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

          <Separator />

          {/* Template Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message Template *</Label>
              {templatesLoading ? (
                <div className="text-sm text-muted-foreground">Loading templates...</div>
              ) : (
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          <Separator />

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

          <Separator />

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

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.name.trim() || !selectedTemplate || !hasEnabledChannels}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}