import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

  const handleCardClick = () => {
    if (onQuickView) {
      onQuickView(project);
      return;
    }
    onView(project);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  const hasProgress = !loading && progress.total > 0;
  const hasPayments = !paymentsLoading && paymentSummary.totalProject > 0;

  const formatProjectDate = (value?: string | null) => {
    if (!value) return "-";
    try {
      return format(new Date(value), "dd MMM yyyy");
    } catch {
      return "-";
    }
  };

  const createdDate = formatProjectDate(project.created_at);
  const updatedDate = formatProjectDate(project.updated_at);
  const isUpdated = project.updated_at && project.updated_at !== project.created_at;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={t("projectCard.openProject", { name: project.name })}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="group relative w-full cursor-pointer overflow-hidden border border-border/60 bg-card/95 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardContent className="relative flex flex-col gap-6 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-foreground md:text-xl">{project.name}</h3>
              {isArchived && (
                <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
                  {t('project.archived')}
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-3 text-sm">
            <div className="hidden md:flex items-center gap-2 text-muted-foreground">
              <span>{t('projectCard.created')} {createdDate}</span>
              {isUpdated && <span className="text-muted-foreground/70">•</span>}
              {isUpdated && <span>{t('projectCard.updated')} {updatedDate}</span>}
            </div>
            <ProjectStatusBadge
              projectId={project.id}
              currentStatusId={project.status_id}
              editable={false}
              size="sm"
              className="text-xs"
            />
            <ChevronRight className="hidden text-muted-foreground transition-transform duration-300 md:block md:h-5 md:w-5 md:group-hover:translate-x-1" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('projectCard.progress')}
                </p>
                {hasProgress ? (
                  <p className="text-sm font-medium text-foreground">
                    {progress.completed}/{progress.total} {t('projectCard.todosCompleted')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('projectCard.noTasksYet')}</p>
                )}
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            {hasProgress && (
              <div className="mt-4">
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
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('projectCard.budget')}
            </p>
            {hasPayments ? (
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(paymentSummary.totalPaid)}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium text-muted-foreground">
                    {formatCurrency(paymentSummary.totalProject)}
                  </span>
                </div>
                {paymentSummary.remaining > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(paymentSummary.remaining)} {t('projectCard.remaining')}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600">{t('projectCard.paidInFull')}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t('projectCard.noBudgetInfo')}</p>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('projectCard.timeline')}
            </p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{t('projectCard.created')}</span> {createdDate}
              </p>
              {isUpdated ? (
                <p>
                  <span className="font-medium text-foreground">{t('projectCard.updated')}</span> {updatedDate}
                </p>
              ) : (
                <p className="italic text-muted-foreground/80">{t('projectCard.notUpdatedYet')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground md:hidden">
          <span>{t('projectCard.created')} {createdDate}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </CardContent>
    </Card>
  );
}