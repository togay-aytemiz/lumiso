import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkflows } from "@/hooks/useWorkflows";
import { CreateWorkflowDialog } from "@/components/CreateWorkflowDialog";
import { WorkflowCard } from "@/components/WorkflowCard";
import { Workflow } from "@/types/workflow";
import { Plus, Search, Zap, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

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

  const handleEditWorkflow = (workflow: Workflow) => {
    // TODO: Implement edit dialog in Phase 2
    console.log("Edit workflow:", workflow);
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (confirm("Are you sure you want to delete this workflow?")) {
      await deleteWorkflow(id);
    }
  };

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.is_active).length,
    paused: workflows.filter(w => !w.is_active).length,
  };

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
            <CardContent className="p-4 flex items-center gap-3">
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
            <CardContent className="p-4 flex items-center gap-3">
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
            <CardContent className="p-4 flex items-center gap-3">
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
          
          <CreateWorkflowDialog onCreateWorkflow={createWorkflow}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </CreateWorkflowDialog>
        </div>

        {/* Workflows List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-6 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredWorkflows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onEdit={handleEditWorkflow}
                onDelete={handleDeleteWorkflow}
                onToggleStatus={toggleWorkflowStatus}
              />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Create your first automated workflow to streamline your client communications.
              </p>
              <CreateWorkflowDialog onCreateWorkflow={createWorkflow}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Workflow
                </Button>
              </CreateWorkflowDialog>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workflows match your filters</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}