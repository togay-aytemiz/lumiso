import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import { WorkflowFormData, TriggerType } from "@/types/workflow";

interface CreateWorkflowDialogProps {
  onCreateWorkflow: (data: WorkflowFormData) => Promise<void>;
  children?: React.ReactNode;
}

const triggerOptions = [
  { value: 'session_scheduled', label: 'Session Scheduled' },
  { value: 'session_confirmed', label: 'Session Confirmed' },
  { value: 'session_completed', label: 'Session Completed' },
  { value: 'session_cancelled', label: 'Session Cancelled' },
  { value: 'session_rescheduled', label: 'Session Rescheduled' },
  { value: 'project_status_change', label: 'Project Status Change' },
  { value: 'lead_status_change', label: 'Lead Status Change' },
];

export function CreateWorkflowDialog({ onCreateWorkflow, children }: CreateWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    trigger_type: 'session_scheduled',
    is_active: true,
    steps: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.trigger_type) return;

    try {
      setLoading(true);
      await onCreateWorkflow(formData);
      setOpen(false);
      setFormData({
        name: '',
        description: '',
        trigger_type: 'session_scheduled',
        is_active: true,
        steps: [],
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof WorkflowFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}