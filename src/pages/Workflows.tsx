import { useState, useEffect } from "react";
import { Plus, Play, Pause, Edit, Trash2, Workflow as WorkflowIcon, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_conditions?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  master_content: string;
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<Workflow | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger_type: "",
    actions: {
      send_email: false,
      send_sms: false,
      send_whatsapp: false,
    },
    selected_template: "",
  });
  const { activeOrganization } = useOrganization();
  const { toast } = useToast();

  // Enhanced events with more business-specific triggers
  const eventTypes = [
    { value: "session_scheduled", label: "Session Scheduled", description: "When a new session is booked" },
    { value: "session_completed", label: "Session Completed", description: "When a session is marked as complete" },
    { value: "session_rescheduled", label: "Session Rescheduled", description: "When a session date/time changes" },
    { value: "session_cancelled", label: "Session Cancelled", description: "When a session is cancelled" },
    { value: "payment_received", label: "Payment Received", description: "When a payment is processed" },
    { value: "payment_overdue", label: "Payment Overdue", description: "When a payment becomes overdue" },
    { value: "payment_reminder", label: "Payment Reminder", description: "Send payment reminders based on due dates" },
    { value: "lead_status_changed", label: "Lead Status Changed", description: "When a lead status is updated" },
    { value: "project_status_changed", label: "Project Status Changed", description: "When a project status changes" },
    { value: "project_created", label: "Project Created", description: "When a new project is created" },
    { value: "lead_created", label: "New Lead", description: "When a new lead is added" },
    { value: "contract_signed", label: "Contract Signed", description: "When a contract is digitally signed" },
    { value: "gallery_delivered", label: "Gallery Delivered", description: "When photos are delivered to client" },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [workflowsResult, templatesResult] = await Promise.all([
        supabase
          .from('workflows')
          .select('*')
          .eq('organization_id', activeOrganization?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('message_templates')
          .select('id, name, category, master_content')
          .eq('organization_id', activeOrganization?.id)
          .eq('is_active', true)
          .order('name')
      ]);

      if (workflowsResult.error) throw workflowsResult.error;
      if (templatesResult.error) throw templatesResult.error;

      setWorkflows(workflowsResult.data || []);
      setTemplates(templatesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch workflows and templates",
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
          description: "Name and event trigger are required",
          variant: "destructive",
        });
        return;
      }

      // Check if at least one action is selected
      const hasActions = Object.values(formData.actions).some(action => action);
      if (!hasActions) {
        toast({
          title: "Validation Error",
          description: "Please select at least one action",
          variant: "destructive",
        });
        return;
      }

      if (hasActions && !formData.selected_template) {
        toast({
          title: "Validation Error",
          description: "Please select a template for the actions",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const workflowData = {
        name: formData.name,
        description: formData.description,
        trigger_type: formData.trigger_type,
        trigger_conditions: {
          actions: formData.actions,
          template_id: formData.selected_template,
        },
        updated_at: new Date().toISOString(),
      };

      if (editingWorkflow) {
        const { error } = await supabase
          .from('workflows')
          .update(workflowData)
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
            ...workflowData,
            user_id: user.id,
            organization_id: activeOrganization?.id,
            is_active: true,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Workflow created successfully",
        });
      }

      setIsModalOpen(false);
      setEditingWorkflow(null);
      setFormData({
        name: "",
        description: "",
        trigger_type: "",
        actions: { send_email: false, send_sms: false, send_whatsapp: false },
        selected_template: "",
      });
      fetchData();
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

      fetchData();
    } catch (error) {
      console.error('Error toggling workflow status:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!deletingWorkflow) return;

    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', deletingWorkflow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Workflow deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      setDeletingWorkflow(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast({
        title: "Error",
        description: "Failed to delete workflow",
        variant: "destructive",
      });
    }
  };

  const getActionsSummary = (workflow: Workflow) => {
    const conditions = workflow.trigger_conditions as any;
    if (!conditions?.actions) return "No actions configured";
    
    const actions = [];
    if (conditions.actions.send_email) actions.push("Email");
    if (conditions.actions.send_sms) actions.push("SMS");
    if (conditions.actions.send_whatsapp) actions.push("WhatsApp");
    
    return actions.length > 0 ? actions.join(", ") : "No actions configured";
  };

  const getTemplateName = (workflow: Workflow) => {
    const conditions = workflow.trigger_conditions as any;
    if (!conditions?.template_id) return "No template";
    
    const template = templates.find(t => t.id === conditions.template_id);
    return template ? template.name : "Template not found";
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchData();
    }
  }, [activeOrganization?.id]);

  if (loading) {
    return <div className="p-6">Loading workflows...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Automate your business processes with Event → Action → Template workflows
          </p>
        </div>
        <Button onClick={() => {
          setFormData({
            name: "",
            description: "",
            trigger_type: "",
            actions: { send_email: false, send_sms: false, send_whatsapp: false },
            selected_template: "",
          });
          setEditingWorkflow(null);
          setIsModalOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WorkflowIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Create your first workflow to automate client communications and streamline your business processes.
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell className="font-medium">{workflow.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {eventTypes.find(e => e.value === workflow.trigger_type)?.label || workflow.trigger_type}
                      </div>
                      {workflow.description && (
                        <div className="text-xs text-muted-foreground max-w-xs truncate">
                          {workflow.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {getActionsSummary(workflow)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {getTemplateName(workflow)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(workflow.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={workflow.is_active ? "default" : "secondary"}>
                      {workflow.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          •••
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleWorkflowStatus(workflow)}>
                          {workflow.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const conditions = workflow.trigger_conditions as any;
                          setFormData({
                            name: workflow.name,
                            description: workflow.description || "",
                            trigger_type: workflow.trigger_type,
                            actions: conditions?.actions || { send_email: false, send_sms: false, send_whatsapp: false },
                            selected_template: conditions?.template_id || "",
                          });
                          setEditingWorkflow(workflow);
                          setIsModalOpen(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeletingWorkflow(workflow);
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

      {/* Create/Edit Modal */}
      <AppSheetModal
        title={editingWorkflow ? "Edit Workflow" : "Create Workflow"}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        footerActions={[
          {
            label: "Cancel",
            onClick: () => setIsModalOpen(false),
            variant: "outline",
          },
          {
            label: editingWorkflow ? "Update Workflow" : "Create Workflow",
            onClick: handleSaveWorkflow,
            variant: "default",
          },
        ]}
      >
        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Workflow Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter workflow name"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this workflow does..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="trigger">Event (What triggers this workflow?)</Label>
            <Select value={formData.trigger_type} onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event trigger" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((event) => (
                  <SelectItem key={event.value} value={event.value}>
                    <div>
                      <div className="font-medium">{event.label}</div>
                      <div className="text-xs text-muted-foreground">{event.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Actions (What should happen?)</Label>
            <div className="space-y-3 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_email"
                  checked={formData.actions.send_email}
                  onCheckedChange={(checked) => 
                    setFormData({ 
                      ...formData, 
                      actions: { ...formData.actions, send_email: !!checked }
                    })
                  }
                />
                <Label htmlFor="send_email" className="font-normal">Send Email</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_sms"
                  checked={formData.actions.send_sms}
                  onCheckedChange={(checked) => 
                    setFormData({ 
                      ...formData, 
                      actions: { ...formData.actions, send_sms: !!checked }
                    })
                  }
                />
                <Label htmlFor="send_sms" className="font-normal">Send SMS</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_whatsapp"
                  checked={formData.actions.send_whatsapp}
                  onCheckedChange={(checked) => 
                    setFormData({ 
                      ...formData, 
                      actions: { ...formData.actions, send_whatsapp: !!checked }
                    })
                  }
                />
                <Label htmlFor="send_whatsapp" className="font-normal">Send WhatsApp Message</Label>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="template">Template (What content to send?)</Label>
            <Select value={formData.selected_template} onValueChange={(value) => setFormData({ ...formData, selected_template: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="no-templates" disabled>
                    No templates available - create one first
                  </SelectItem>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{template.category}</div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                You need to create templates first in Settings → Templates
              </p>
            )}
          </div>
        </div>
      </AppSheetModal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingWorkflow?.name}"? This action cannot be undone and will stop all automated processes associated with this workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkflow} className="bg-red-600 hover:bg-red-700">
              Delete Workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}