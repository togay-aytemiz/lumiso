import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { User, Calendar, DollarSign } from 'lucide-react';
import { AssigneeAvatars } from './AssigneeAvatars';

interface Project {
  id: string;
  name: string;
  description?: string;
  lead?: { name: string; email: string };
  project_type?: { id: string; name: string };
  status?: string;
  session_count?: number;
  completed_sessions?: number;
  todo_count?: number;
  completed_todo_count?: number;
  total_revenue?: number;
  assignees?: string[];
  services?: Array<{ id: string; name: string }>;
}

interface KanbanSettings {
  kanban_show_project_type: boolean;
  kanban_show_project_name: boolean;
  kanban_show_client_name: boolean;
  kanban_show_todo_progress: boolean;
  kanban_show_session_count: boolean;
  kanban_show_revenue?: boolean;
  kanban_show_assignees: boolean;
  kanban_show_service_count?: boolean;
}

interface ProfessionalKanbanCardProps {
  project: Project;
  kanbanSettings: KanbanSettings;
  onClick: () => void;
}

export const ProfessionalKanbanCard: React.FC<ProfessionalKanbanCardProps> = ({
  project,
  kanbanSettings,
  onClick
}) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out bg-card border border-border/50 hover:border-border group" 
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Project Type Badge */}
          {kanbanSettings.kanban_show_project_type && project.project_type && (
            <div>
              <Badge variant="secondary" className="text-xs font-medium bg-muted text-muted-foreground border-0 px-2.5 py-1">
                {project.project_type.name}
              </Badge>
            </div>
          )}

          {/* Project Name */}
          {kanbanSettings.kanban_show_project_name && (
            <div>
              <h3 className="font-semibold text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                {project.name}
              </h3>
            </div>
          )}

          {/* Client Information */}
          {kanbanSettings.kanban_show_client_name && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{project.lead?.name || 'No Lead'}</span>
              </div>
            </div>
          )}

          {/* Todo Progress */}
          {kanbanSettings.kanban_show_todo_progress && (project.todo_count || 0) > 0 && (
            <div>
              <ProgressBar 
                value={Math.round((project.completed_todo_count || 0) / (project.todo_count || 0) * 100)} 
                total={project.todo_count || 0} 
                completed={project.completed_todo_count || 0} 
                className="w-full" 
                showLabel={true} 
                size="sm" 
              />
            </div>
          )}

          {/* Bottom Section */}
          <div className="flex items-center justify-between pt-3 border-t border-border/30">
            {/* Left Side - Session Count or Revenue */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {kanbanSettings.kanban_show_session_count && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{project.session_count || 0} sessions</span>
                </div>
              )}
              
              {kanbanSettings.kanban_show_revenue && project.total_revenue && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>${project.total_revenue.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Right Side - Assignees */}
            {kanbanSettings.kanban_show_assignees && project.assignees && project.assignees.length > 0 && (
              <div className="flex -space-x-1">
                <AssigneeAvatars 
                  assigneeIds={project.assignees}
                  maxVisible={3} 
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};