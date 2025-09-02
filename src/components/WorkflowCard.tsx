import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Workflow } from "@/types/workflow";
import { MoreHorizontal, Edit, Trash2, Copy, Play, Pause, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkflowCardProps {
  workflow: Workflow;
  onEdit: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, isActive: boolean) => void;
  onDuplicate?: (workflow: Workflow) => void;
}

const getTriggerLabel = (triggerType: string) => {
  const labels = {
    session_scheduled: 'Session Scheduled',
    session_confirmed: 'Session Confirmed', 
    session_completed: 'Session Completed',
    session_cancelled: 'Session Cancelled',
    session_rescheduled: 'Session Rescheduled',
    project_status_change: 'Project Status Change',
    lead_status_change: 'Lead Status Change',
  };
  return labels[triggerType as keyof typeof labels] || triggerType;
};

const getTriggerIcon = (triggerType: string) => {
  return <Zap className="h-4 w-4" />;
};

export function WorkflowCard({ workflow, onEdit, onDelete, onToggleStatus, onDuplicate }: WorkflowCardProps) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {workflow.name}
            </CardTitle>
            {workflow.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {workflow.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(workflow)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => onDelete(workflow.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="py-4">
        <div className="space-y-3">
          {/* Trigger Info */}
          <div className="flex items-center gap-2">
            {getTriggerIcon(workflow.trigger_type)}
            <span className="text-sm font-medium text-foreground">
              {getTriggerLabel(workflow.trigger_type)}
            </span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={workflow.is_active ? "default" : "secondary"}
              className="capitalize"
            >
              {workflow.is_active ? (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Paused
                </>
              )}
            </Badge>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={workflow.is_active}
              onCheckedChange={(checked) => onToggleStatus(workflow.id, checked)}
            />
            <span>{workflow.is_active ? 'Active' : 'Paused'}</span>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit(workflow)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}