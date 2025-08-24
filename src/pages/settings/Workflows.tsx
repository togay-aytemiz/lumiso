import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Zap,
  Play,
  Pause,
  Clock,
  Target,
  ArrowRight
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_conditions: any;
  is_active: boolean;
  created_at: string;
}

interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  action_type: string;
  action_config: any;
  delay_minutes: number;
  conditions: any;
  is_active: boolean;
}

const TRIGGER_TYPES = [
  { value: 'session_booked', label: 'Session Booked', description: 'When a new session is scheduled' },
  { value: 'payment_due', label: 'Payment Due', description: 'When payment is due for a project' },
  { value: 'session_completed', label: 'Session Completed', description: 'When a session is marked as completed' },
  { value: 'lead_status_changed', label: 'Lead Status Changed', description: 'When a lead status changes' },
  { value: 'project_status_changed', label: 'Project Status Changed', description: 'When a project status changes' },
  { value: 'before_session', label: 'Before Session', description: 'X hours/days before a session' },
];

const ACTION_TYPES = [
  { value: 'send_template', label: 'Send Template', description: 'Send a message template via email/SMS/WhatsApp' },
  { value: 'create_task', label: 'Create Task', description: 'Create a reminder or task' },
  { value: 'update_status', label: 'Update Status', description: 'Change lead or project status' },
  { value: 'send_notification', label: 'Send Notification', description: 'Send internal notification to team' },
];

export default function Workflows() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);

  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger_type: '',
    trigger_conditions: {},
    steps: [] as any[]
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (workflowsError) throw workflowsError;

      const { data: stepsData, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .order('step_order', { ascending: true });

      if (stepsError) throw stepsError;

      setWorkflows(workflowsData || []);
      setWorkflowSteps(stepsData || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast({
        title: "Error",
        description: "Failed to load workflows",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('No authenticated user');

      const { data: orgData } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!orgData?.active_organization_id) throw new Error('No active organization');

      let workflowData;
      
      if (editingWorkflow) {
        const { data, error } = await supabase
          .from('workflows')
          .update({
            name: newWorkflow.name,
            description: newWorkflow.description,
            trigger_type: newWorkflow.trigger_type,
            trigger_conditions: newWorkflow.trigger_conditions
          })
          .eq('id', editingWorkflow.id)
          .select()
          .single();

        if (error) throw error;
        workflowData = data;
      } else {
        const { data, error } = await supabase
          .from('workflows')
          .insert({
            user_id: userData.user.id,
            organization_id: orgData.active_organization_id,
            name: newWorkflow.name,
            description: newWorkflow.description,
            trigger_type: newWorkflow.trigger_type,
            trigger_conditions: newWorkflow.trigger_conditions
          })
          .select()
          .single();

        if (error) throw error;
        workflowData = data;
      }

      toast({
        title: "Success",
        description: editingWorkflow ? "Workflow updated successfully" : "Workflow created successfully",
      });

      handleCancelWorkflow();
      fetchWorkflows();
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    }
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setNewWorkflow({
      name: workflow.name,
      description: workflow.description || '',
      trigger_type: workflow.trigger_type,
      trigger_conditions: workflow.trigger_conditions,
      steps: []
    });
    setIsSheetOpen(true);
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Workflow deleted successfully",
      });

      fetchWorkflows();
      setDeleteWorkflowId(null);
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: "Error",
        description: "Failed to delete workflow",
        variant: "destructive",
      });
    }
  };

  const handleToggleWorkflow = async (workflow: Workflow) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Workflow ${workflow.is_active ? 'deactivated' : 'activated'} successfully`,
      });

      fetchWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow",
        variant: "destructive",
      });
    }
  };

  const handleCancelWorkflow = () => {
    setIsSheetOpen(false);
    setEditingWorkflow(null);
    setNewWorkflow({
      name: '',
      description: '',
      trigger_type: '',
      trigger_conditions: {},
      steps: []
    });
  };

  const getTriggerLabel = (triggerType: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.value === triggerType);
    return trigger ? trigger.label : triggerType;
  };

  const getWorkflowSteps = (workflowId: string) => {
    return workflowSteps.filter(step => step.workflow_id === workflowId);
  };

  if (loading) {
    return (
      <SettingsPageWrapper>
        <SettingsHeader 
          title="Workflows"
          description="Automate your photography business with smart workflows"
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
        title="Workflows"
        description="Automate repetitive tasks and communications to save time and improve client experience"
      />

      <div className="space-y-6">
        {/* Workflows List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Automated Workflows
                </CardTitle>
                <CardDescription>
                  Set up triggers and actions to automate your business processes
                </CardDescription>
              </div>
              <Button onClick={() => setIsSheetOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Workflow
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {workflows.length > 0 ? (
              <div className="space-y-4">
                {workflows.map((workflow) => {
                  const steps = getWorkflowSteps(workflow.id);
                  return (
                    <div key={workflow.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium">{workflow.name}</h4>
                            <Badge variant={workflow.is_active ? "default" : "secondary"}>
                              {workflow.is_active ? (
                                <>
                                  <Play className="w-3 h-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <Pause className="w-3 h-3 mr-1" />
                                  Inactive
                                </>
                              )}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Target className="w-3 h-3 mr-1" />
                              {getTriggerLabel(workflow.trigger_type)}
                            </Badge>
                          </div>
                          {workflow.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {workflow.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {steps.length} step{steps.length !== 1 ? 's' : ''}
                            {steps.length > 0 && (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                {steps.map((step, index) => (
                                  <span key={step.id}>
                                    {step.action_type.replace('_', ' ')}
                                    {index < steps.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Switch
                            checked={workflow.is_active}
                            onCheckedChange={() => handleToggleWorkflow(workflow)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditWorkflow(workflow)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteWorkflowId(workflow.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No workflows created yet</p>
                <p className="text-sm">Create your first workflow to start automating your business processes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Workflow Sheet */}
      <AppSheetModal
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={editingWorkflow ? "Edit Workflow" : "Create New Workflow"}
        size="lg"
        footerActions={[
          {
            label: "Cancel",
            variant: "outline",
            onClick: handleCancelWorkflow
          },
          {
            label: editingWorkflow ? "Update Workflow" : "Create Workflow",
            onClick: handleSaveWorkflow
          }
        ]}
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name">Workflow Name *</Label>
              <Input
                id="workflow-name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                placeholder="e.g., Welcome New Clients"
              />
            </div>

            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                placeholder="Describe what this workflow does..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="trigger-type">Trigger Event *</Label>
              <Select
                value={newWorkflow.trigger_type}
                onValueChange={(value) => setNewWorkflow({ ...newWorkflow, trigger_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select when this workflow should run" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      <div>
                        <div className="font-medium">{trigger.label}</div>
                        <div className="text-xs text-muted-foreground">{trigger.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Placeholder for workflow steps - will be enhanced in future phases */}
            <div className="mt-6 p-4 border-2 border-dashed border-muted rounded-lg text-center text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Workflow steps builder coming soon</p>
              <p className="text-xs">You'll be able to add actions, delays, and conditions here</p>
            </div>
          </div>
        </div>
      </AppSheetModal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWorkflowId} onOpenChange={() => setDeleteWorkflowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone and will stop all automated processes for this workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorkflowId && handleDeleteWorkflow(deleteWorkflowId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPageWrapper>
  );
}