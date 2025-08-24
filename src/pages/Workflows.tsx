import { useState, useEffect } from "react";
import { Plus, Play, Pause, Edit, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger_type: "",
  });
  const { activeOrganization } = useOrganization();
  const { toast } = useToast();

  const triggerTypes = [
    { value: "session_booked", label: "Session Booked" },
    { value: "session_completed", label: "Session Completed" },
    { value: "payment_received", label: "Payment Received" },
    { value: "payment_overdue", label: "Payment Overdue" },
    { value: "lead_status_changed", label: "Lead Status Changed" },
    { value: "project_status_changed", label: "Project Status Changed" },
    { value: "date_based", label: "Date-Based Trigger" },
  ];

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', activeOrganization?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast({
        title: "Error",
        description: "Failed to fetch workflows",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      if (!formData.name || !formData.trigger_type) {
        toast({
          title: "Validation Error",
          description: "Name and trigger type are required",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (editingWorkflow) {
        const { error } = await supabase
          .from('workflows')
          .update({
            name: formData.name,
            description: formData.description,
            trigger_type: formData.trigger_type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingWorkflow.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Workflow updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('workflows')
          .insert({
            user_id: user.id,
            organization_id: activeOrganization?.id,
            name: formData.name,
            description: formData.description,
            trigger_type: formData.trigger_type,
            is_active: true,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Workflow created successfully",
        });
      }

      setIsCreateDialogOpen(false);
      setEditingWorkflow(null);
      setFormData({ name: "", description: "", trigger_type: "" });
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

  const toggleWorkflowStatus = async (workflow: Workflow) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Workflow ${workflow.is_active ? 'paused' : 'activated'} successfully`,
      });

      fetchWorkflows();
    } catch (error) {
      console.error('Error toggling workflow status:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow status",
        variant: "destructive",
      });
    }
  };

  const deleteWorkflow = async (workflow: Workflow) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Workflow deleted successfully",
      });

      fetchWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: "Error",
        description: "Failed to delete workflow",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchWorkflows();
    }
  }, [activeOrganization?.id]);

  if (loading) {
    return <div>Loading workflows...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Automate your business processes with intelligent workflows
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData({ name: "", description: "", trigger_type: "" })}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingWorkflow ? "Edit Workflow" : "Create New Workflow"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter workflow name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this workflow does"
                />
              </div>
              <div>
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select value={formData.trigger_type} onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveWorkflow}>
                  {editingWorkflow ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WorkflowIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first workflow to automate repetitive tasks and improve your efficiency.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{workflow.name}</CardTitle>
                  <Badge variant={workflow.is_active ? "default" : "secondary"}>
                    {workflow.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>
                <CardDescription>
                  {triggerTypes.find(t => t.value === workflow.trigger_type)?.label || workflow.trigger_type}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {workflow.description || "No description provided"}
                </p>
                <div className="flex justify-between">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleWorkflowStatus(workflow)}
                    >
                      {workflow.is_active ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingWorkflow(workflow);
                        setFormData({
                          name: workflow.name,
                          description: workflow.description || "",
                          trigger_type: workflow.trigger_type,
                        });
                        setIsCreateDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteWorkflow(workflow)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}