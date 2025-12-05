import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeLeadInitials } from "@/components/leadInitialsUtils";
import { Calendar, DollarSign, Package } from "lucide-react";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

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

interface ProfessionalKanbanCardProps {
  project: Project;
  kanbanSettings: KanbanSettings;
  onClick: () => void;
}

export const ProfessionalKanbanCard: React.FC<ProfessionalKanbanCardProps> = ({
  project,
  kanbanSettings,
  onClick,
}: ProfessionalKanbanCardProps) => {
  const { t } = useFormsTranslation();
  const leadInitials = useMemo(
    () => computeLeadInitials(project.lead?.name, "??", 2),
    [project.lead?.name]
  );
  const leadName = project.lead?.name || t("projects.no_lead");

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow bg-card border border-border"
      onClick={onClick}
    >
      <CardContent className="p-2">
        <div className="space-y-2.5">
          {/* Project Type Badge */}
          {kanbanSettings.kanban_show_project_type && project.project_type && (
            <Badge
              variant="secondary"
              className="text-xs font-semibold bg-accent/15 text-accent border border-accent/20"
            >
              {project.project_type.name}
            </Badge>
          )}

          {/* Project Name */}
          {kanbanSettings.kanban_show_project_name && (
            <h3 className="text-sm font-medium leading-snug text-slate-900 line-clamp-1 md:line-clamp-2">
              {project.name}
            </h3>
          )}

          {/* Client Information */}
          {kanbanSettings.kanban_show_client_name && (
            <div className="flex items-center gap-1.5 text-xs text-slate-900">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-muted text-slate-700 font-semibold uppercase">
                  {leadInitials}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-muted-foreground">{leadName}</span>
            </div>
          )}

          {/* Todo Progress */}
          {kanbanSettings.kanban_show_todo_progress &&
            (project.todo_count || 0) > 0 && (
              <ProgressBar
                value={Math.round(
                  ((project.completed_todo_count || 0) /
                    (project.todo_count || 0)) *
                    100
                )}
                total={project.todo_count || 0}
                completed={project.completed_todo_count || 0}
                className="w-full"
                showLabel={true}
                size="sm"
              />
            )}

          {/* Bottom Section */}
          {(kanbanSettings.kanban_show_session_count ||
            (kanbanSettings.kanban_show_revenue && project.revenue) ||
            (kanbanSettings.kanban_show_service_count &&
              project.services &&
              project.services.length > 0)) && (
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
              {/* Left Side - Session Count, Revenue, Service Count */}
              <div className="flex items-center gap-2.5">
                {kanbanSettings.kanban_show_session_count && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {project.session_count || 0} {t("projects.sessions")}
                    </span>
                  </div>
                )}

                {kanbanSettings.kanban_show_revenue && project.revenue && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>${project.revenue.toLocaleString()}</span>
                  </div>
                )}

                {kanbanSettings.kanban_show_service_count &&
                  project.services &&
                  project.services.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" />
                      <span>
                        {project.services.length} {t("projects.services")}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
