import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { useProjectPayments } from "@/hooks/useProjectPayments";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";



interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
}

interface ProjectCardProps {
  project: Project;
  onView: (project: Project) => void;
  refreshTrigger?: number;
  onQuickView?: (project: Project) => void;
}

export function ProjectCard({ project, onView, refreshTrigger, onQuickView }: ProjectCardProps) {
  const { progress, loading } = useProjectProgress(project.id, refreshTrigger);
  const { paymentSummary, loading: paymentsLoading } = useProjectPayments(project.id, refreshTrigger);
  const { t } = useFormsTranslation();

  const [isArchived, setIsArchived] = useState(false);
  useEffect(() => {
    let active = true;
    const checkArchived = async () => {
      if (!project.status_id) { if (active) setIsArchived(false); return; }
      try {
        const { data } = await supabase
          .from('project_statuses')
          .select('name')
          .eq('id', project.status_id)
          .maybeSingle();
        if (active) setIsArchived((data?.name || '').toLowerCase() === 'archived');
      } catch {
        if (active) setIsArchived(false);
      }
    };
    checkArchived();
    return () => { active = false; };
  }, [project.status_id, refreshTrigger]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="w-full hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4 md:p-6">
        <div 
          className="flex flex-col md:flex-row md:items-center md:justify-between md:gap-6 gap-4"
          onClick={() => onQuickView ? onQuickView(project) : onView(project)}
        >
          <div className="flex-1 min-w-0 space-y-3">
            {/* Title and Archived Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h3 className="font-bold text-lg truncate">{project.name}</h3>
                {isArchived && <Badge variant="secondary" className="text-[10px] flex-shrink-0">{t('project.archived')}</Badge>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="md:hidden">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Description */}
            {project.description && (
              <p className="text-muted-foreground text-sm break-words">{project.description}</p>
            )}
            
            {/* Progress Summary Text */}
            {!loading && progress.total > 0 && (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
      <span>
        {progress.completed}/{progress.total} {t("projectCard.todosCompleted")}
      </span>
    </div>
  )}

            {/* Progress Bar */}
            {!loading && progress.total > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ProgressBar
                        value={progress.percentage}
                        total={progress.total}
                        completed={progress.completed}
                        className="w-full"
                        showLabel={false}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t('project.progressTooltip', { completed: progress.completed, remaining: progress.total - progress.completed })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Status and Dates */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-3 flex-wrap">
                {!isArchived && (
                  <ProjectStatusBadge 
                    projectId={project.id}
                    currentStatusId={project.status_id}
                    editable={false}
                    size="sm"
                    className="text-xs"
                  />
                )}
                <span className="whitespace-nowrap">{t('projectCard.created')} {format(new Date(project.created_at), "M/d/yy")}</span>
                {project.updated_at !== project.created_at && (
                  <span className="whitespace-nowrap">{t('projectCard.updated')} {format(new Date(project.updated_at), "M/d/yy")}</span>
                )}
              </div>
            </div>

            {/* Budget/Payment Information */}
            {!paymentsLoading && paymentSummary.totalProject > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-medium">
                    {formatCurrency(paymentSummary.totalPaid)}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(paymentSummary.totalProject)}
                  </span>
                </div>
                {paymentSummary.remaining > 0 && (
                  <span className="text-orange-600">
                    ({formatCurrency(paymentSummary.remaining)} {t('projectCard.remaining')})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Desktop Chevron */}
          <div className="hidden md:flex items-center flex-shrink-0">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}