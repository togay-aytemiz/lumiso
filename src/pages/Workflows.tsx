import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoadingSkeleton } from "@/components/ui/loading-presets";
import { useWorkflows } from "@/hooks/useWorkflows";
import { CreateWorkflowSheet } from "@/components/CreateWorkflowSheet";
import { WorkflowDeleteDialog } from "@/components/WorkflowDeleteDialog";
import { Workflow } from "@/types/workflow";
import { Plus, Search, Zap, CheckCircle, Clock, AlertTriangle, Edit, Trash2, Mail, MessageCircle, Phone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Workflows() {
  const { workflows, loading, createWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflowStatus } = useWorkflows();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && workflow.is_active) ||
                         (statusFilter === "paused" && !workflow.is_active);
    return matchesSearch && matchesStatus;
  });

  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
  };

  const handleDeleteWorkflow = (workflow: Workflow) => {
    setDeletingWorkflow(workflow);
  };

  const confirmDeleteWorkflow = async () => {
    if (!deletingWorkflow) return;
    
    setIsDeleting(true);
    try {
      await deleteWorkflow(deletingWorkflow.id);
      setDeletingWorkflow(null);
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteWorkflow = () => {
    if (!isDeleting) {
      setDeletingWorkflow(null);
    }
  };

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.is_active).length,
    paused: workflows.filter(w => !w.is_active).length,
  };

  const getTriggerLabel = (triggerType: string) => {
    const labels = {
      session_scheduled: 'Session Scheduled',
      session_completed: 'Session Completed',
      session_cancelled: 'Session Cancelled',
      session_rescheduled: 'Session Rescheduled',
      session_reminder: 'Session Reminder',
      project_status_change: 'Project Status Change',
      lead_status_change: 'Lead Status Change',
    };
    return labels[triggerType as keyof typeof labels] || triggerType;
  };

  const getChannelIcons = (channels: string[]) => {
    const iconMap = {
      email: Mail,
      sms: Phone,
      whatsapp: MessageCircle,
    };
    
    return channels?.map((channel) => {
      const IconComponent = iconMap[channel as keyof typeof iconMap];
      if (!IconComponent) return null;
      
      return (
        <div key={channel} className="p-1 bg-muted rounded">
          <IconComponent className="h-3 w-3" />
        </div>
      );
    }).filter(Boolean) || [];
  };

  const columns: Column<Workflow>[] = [
    {
      key: 'name',
      header: 'Workflow Name',
      sortable: true,
      render: (workflow) => (
        <div>
          <div className="font-medium">{workflow.name}</div>
          {workflow.description && (
            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
              {workflow.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'trigger_type',
      header: 'Trigger',
      sortable: true,
      render: (workflow) => (
        <div className="text-sm">
          {getTriggerLabel(workflow.trigger_type)}
        </div>
      ),
    },
    {
      key: 'channels',
      header: 'Channels',
      render: (workflow) => {
        // For now, show all channels as we don't have the step data loaded
        // This would need to be updated when we add step data fetching
        const defaultChannels = ['email', 'sms', 'whatsapp'];
        const icons = getChannelIcons(defaultChannels);
        
        return (
          <div className="flex gap-1">
            {icons.length > 0 ? icons : <span className="text-muted-foreground text-xs">No channels</span>}
          </div>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (workflow) => (
        <Badge variant={workflow.is_active ? "default" : "secondary"}>
          {workflow.is_active ? 'Active' : 'Paused'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (workflow) => (
        <div className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (workflow) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={workflow.is_active}
            onCheckedChange={(checked) => toggleWorkflowStatus(workflow.id, checked)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditWorkflow(workflow)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteWorkflow(workflow)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden">
        <PageHeader 
          title="Workflows" 
          subtitle="Automate your client communications with smart workflows"
        />
        <PageLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader 
        title="Workflows" 
        subtitle="Automate your client communications with smart workflows"
      />
      
      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Workflows</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold">{stats.paused}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="paused">Paused</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <CreateWorkflowSheet 
            onCreateWorkflow={createWorkflow}
            editWorkflow={editingWorkflow}
            onUpdateWorkflow={updateWorkflow}
            setEditingWorkflow={setEditingWorkflow}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </CreateWorkflowSheet>
        </div>

        {/* Workflows Table */}
        <div className="space-y-4">
          <DataTable
            data={filteredWorkflows}
            columns={columns}
            itemsPerPage={10}
            emptyState={
              workflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Create your first automated workflow to streamline your client communications.
                  </p>
                  <CreateWorkflowSheet 
                    onCreateWorkflow={createWorkflow} 
                    editWorkflow={editingWorkflow}
                    onUpdateWorkflow={updateWorkflow}
                    setEditingWorkflow={setEditingWorkflow}
                  >
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Workflow
                    </Button>
                  </CreateWorkflowSheet>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No workflows match your filters</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              )
            }
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <WorkflowDeleteDialog
        open={!!deletingWorkflow}
        workflow={deletingWorkflow}
        onConfirm={confirmDeleteWorkflow}
        onCancel={cancelDeleteWorkflow}
        isDeleting={isDeleting}
      />
    </div>
  );
}