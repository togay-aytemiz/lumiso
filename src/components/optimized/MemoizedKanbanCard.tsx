import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { User, Calendar, DollarSign, Package } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status?: string;
  status_id?: string;
  project_type?: { name: string };
  lead?: { name: string; id: string };
  todo_count?: number;
  completed_todo_count?: number;
  session_count?: number;
  revenue?: number;
  services?: Array<{ id: string; name: string }>;
}

interface KanbanSettings {
  kanban_show_project_type: boolean;
  kanban_show_project_name: boolean;
  kanban_show_client_name: boolean;
  kanban_show_todo_progress: boolean;
  kanban_show_session_count: boolean;
  kanban_show_revenue?: boolean;
  kanban_show_service_count?: boolean;
}

interface MemoizedKanbanCardProps {
  project: Project;
  kanbanSettings: KanbanSettings;
  onClick: () => void;
}

/**
 * Optimized Kanban Card with React.memo for performance
 * Only re-renders when props actually change
 */
export const MemoizedKanbanCard = memo<MemoizedKanbanCardProps>(({
  project,
  kanbanSettings,
  onClick
}) => {
  // Memoize progress calculation
  const progressValue = React.useMemo(() => {
    if (!project.todo_count || project.todo_count === 0) return 0;
    return Math.round((project.completed_todo_count || 0) / project.todo_count * 100);
  }, [project.todo_count, project.completed_todo_count]);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow bg-card border border-border" 
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View project: ${project.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4 md:p-3">
        <div className="space-y-3">
          {/* Project Type Badge */}
          {kanbanSettings.kanban_show_project_type && project.project_type && (
            <Badge variant="secondary" className="text-xs font-medium">
              {project.project_type.name}
            </Badge>
          )}

          {/* Project Name */}
          {kanbanSettings.kanban_show_project_name && (
            <h3 className="font-bold text-base line-clamp-2 leading-tight">
              {project.name}
            </h3>
          )}

          {/* Client Information */}
          {kanbanSettings.kanban_show_client_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{project.lead?.name || 'No Lead'}</span>
            </div>
          )}

          {/* Todo Progress */}
          {kanbanSettings.kanban_show_todo_progress && (project.todo_count || 0) > 0 && (
            <ProgressBar 
              value={progressValue}
              total={project.todo_count || 0} 
              completed={project.completed_todo_count || 0} 
              className="w-full" 
              showLabel={true} 
              size="sm"
              aria-label={`Progress: ${project.completed_todo_count || 0} of ${project.todo_count || 0} tasks completed`}
            />
          )}

          {/* Bottom Section */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
            {/* Left Side - Session Count, Revenue, Service Count */}
            <div className="flex items-center gap-4">
              {kanbanSettings.kanban_show_session_count && (
                <div className="flex items-center gap-1.5" aria-label={`${project.session_count || 0} sessions`}>
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{project.session_count || 0} sessions</span>
                </div>
              )}
              
              {kanbanSettings.kanban_show_revenue && project.revenue && (
                <div className="flex items-center gap-1.5" aria-label={`Revenue: $${project.revenue.toLocaleString()}`}>
                  <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>${project.revenue.toLocaleString()}</span>
                </div>
              )}

              {kanbanSettings.kanban_show_service_count && project.services && project.services.length > 0 && (
                <div className="flex items-center gap-1.5" aria-label={`${project.services.length} services`}>
                  <Package className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{project.services.length} services</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.name === nextProps.project.name &&
    prevProps.project.todo_count === nextProps.project.todo_count &&
    prevProps.project.completed_todo_count === nextProps.project.completed_todo_count &&
    prevProps.project.session_count === nextProps.project.session_count &&
    prevProps.project.revenue === nextProps.project.revenue &&
    JSON.stringify(prevProps.kanbanSettings) === JSON.stringify(nextProps.kanbanSettings)
  );
});

MemoizedKanbanCard.displayName = 'MemoizedKanbanCard';