import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { WorkflowFormData, TriggerType, Workflow } from "@/types/workflow";
import { WorkflowBuilder } from "./workflow-builder/WorkflowBuilder";
import { Node, Edge } from '@xyflow/react';

interface EditWorkflowDialogProps {
  workflow?: Workflow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateWorkflow: (id: string, data: Partial<WorkflowFormData>) => Promise<void>;
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

export function EditWorkflowDialog({ 
  workflow, 
  open, 
  onOpenChange, 
  onUpdateWorkflow 
}: EditWorkflowDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<WorkflowFormData>>({
    name: '',
    description: '',
    trigger_type: 'session_scheduled',
    is_active: true,
    steps: [],
  });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    if (workflow) {
      setFormData({
        name: workflow.name,
        description: workflow.description || '',
        trigger_type: workflow.trigger_type as TriggerType,
        is_active: workflow.is_active,
        steps: [],
      });

      // Initialize with default trigger node for now
      const triggerNode: Node = {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 100, y: 50 },
        data: {
          label: 'Trigger',
          triggerType: workflow.trigger_type,
          conditions: workflow.trigger_conditions || {}
        }
      };
      
      setNodes([triggerNode]);
      setEdges([]);
    }
  }, [workflow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflow || !formData.name?.trim() || !formData.trigger_type) return;

    try {
      setLoading(true);
      await onUpdateWorkflow(workflow.id, formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof WorkflowFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Workflow: {workflow.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="settings" className="h-full">
          <TabsList className="mb-4">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="builder">Visual Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 max-h-[60vh] overflow-y-auto">
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
                  <Label htmlFor="active">Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Workflow will process triggers when active
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => updateFormData('is_active', checked)}
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !formData.name?.trim()}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="builder" className="h-[60vh]">
            <div className="h-full border border-border rounded-lg overflow-hidden">
              <WorkflowBuilder
                initialNodes={nodes}
                initialEdges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
              />
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Coming Soon:</strong> Full visual workflow builder with drag-and-drop actions, 
                conditions, and template integration.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}