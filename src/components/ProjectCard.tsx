import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, CreditCard } from "lucide-react";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { useProjectPayments } from "@/hooks/useProjectPayments";
import { useProjectSessionsSummary, type ProjectSessionsSummary } from "@/hooks/useProjectSessionsSummary";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { formatDate, formatTime } from "@/lib/utils";



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
  const { summary: sessionsSummary, loading: sessionsLoading } = useProjectSessionsSummary(project.id, refreshTrigger);
  const { t } = useFormsTranslation();

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

  const handleViewDetailsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
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
  const formatSessionDate = (session: ProjectSessionsSummary['overdueNext']) => {
    if (!session?.session_date) return null;
    try {
      return formatDate(session.session_date);
    } catch {
      return null;
    }
  };

  const formatSessionTime = (session: ProjectSessionsSummary['overdueNext']) => {
    if (!session?.session_time) return null;
    try {
      return formatTime(session.session_time);
    } catch {
      return null;
    }
  };
  const getDateKey = (value: string | null) => (value ? value.slice(0, 10) : null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
    tomorrow.getDate()
  ).padStart(2, '0')}`;

  const sessionCountLabel = sessionsSummary.total > 0 ? t('projectCard.sessionsCount', { count: sessionsSummary.total }) : null;
  const rawActiveLabel = sessionsSummary.activeCount > 0 ? t('projectCard.sessionsActive', { count: sessionsSummary.activeCount }) : null;
  const completedLabel = sessionsSummary.completedCount > 0 ? t('projectCard.sessionsCompleted', { count: sessionsSummary.completedCount }) : null;
  const cancelledLabel = sessionsSummary.cancelledCount > 0 ? t('projectCard.sessionsCancelled', { count: sessionsSummary.cancelledCount }) : null;
  const overdueLabel = sessionsSummary.overdueCount > 0 ? t('projectCard.sessionsOverdue', { count: sessionsSummary.overdueCount }) : null;
  const allSessionsActive = sessionsSummary.total > 0 && sessionsSummary.activeCount === sessionsSummary.total;
  const activeDisplayLabel = allSessionsActive ? t('projectCard.sessionsAllActive') : rawActiveLabel;

  const todayTime = formatSessionTime(sessionsSummary.todayNext);
  const todayMessage = sessionsSummary.todayCount > 0
    ? todayTime
      ? sessionsSummary.todayCount > 1
        ? t('projectCard.sessionsTodayWithTime', { count: sessionsSummary.todayCount, time: todayTime })
        : t('projectCard.sessionsTodaySingleWithTime', { time: todayTime })
      : t('projectCard.sessionsToday', { count: sessionsSummary.todayCount })
    : null;

  const upcomingDate = formatSessionDate(sessionsSummary.nextUpcoming);
  const upcomingTime = formatSessionTime(sessionsSummary.nextUpcoming);
  const upcomingDateKey = getDateKey(sessionsSummary.nextUpcoming?.session_date ?? null);
  const upcomingIsTomorrow = upcomingDateKey !== null && upcomingDateKey === tomorrowKey;
  const upcomingMessage = sessionsSummary.nextUpcoming && upcomingDate
    ? upcomingIsTomorrow && upcomingTime
      ? t('projectCard.sessionsUpcomingTomorrowWithTime', { time: upcomingTime })
      : upcomingTime
        ? t('projectCard.sessionsUpcomingWithTime', { date: upcomingDate, time: upcomingTime })
        : t('projectCard.sessionsUpcoming', { date: upcomingDate })
    : null;

  const lastCompletedDate = formatSessionDate(sessionsSummary.latestCompleted);
  const lastCompletedMessage = lastCompletedDate
    ? t('projectCard.sessionsCompletedRecently', { date: lastCompletedDate })
    : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={t("projectCard.openProject", { name: project.name })}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="group relative w-full cursor-pointer overflow-hidden border border-border bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <CardContent className="relative flex flex-col gap-6 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-foreground md:text-xl">{project.name}</h3>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {project.description}
              </p>
            )}
            {/* Mobile-only: status chip with explicit view CTA */}
            <div className="flex items-center justify-between gap-3 md:hidden pt-1">
              <ProjectStatusBadge
                projectId={project.id}
                currentStatusId={project.status_id}
                editable={false}
                size="sm"
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="surface"
                className="px-3.5 shadow-sm"
                onClick={handleViewDetailsClick}
              >
                {t('projectCard.viewDetails')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Desktop: status chip with explicit view CTA */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <ProjectStatusBadge
              projectId={project.id}
              currentStatusId={project.status_id}
              editable={false}
              size="sm"
              className="text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="surface"
              className="px-4 shadow-sm"
              onClick={handleViewDetailsClick}
            >
              {t('projectCard.viewDetails')}
              <ChevronRight className="h-4 w-4" />
            </Button>
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
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('projectCard.budget')}
                </p>
                {hasPayments ? (
                  <div className="space-y-1 text-sm">
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
                  <p className="text-sm text-muted-foreground">{t('projectCard.noBudgetInfo')}</p>
                )}
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('projectCard.sessions')}
                </p>
                {sessionsLoading ? (
                  <p className="text-sm text-muted-foreground animate-pulse">{t('projectCard.sessionsLoading')}</p>
                ) : sessionsSummary.total === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('projectCard.sessionsNone')}</p>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="space-y-1">
                      {sessionCountLabel && <p className="text-base font-semibold text-foreground">{sessionCountLabel}</p>}
                      {(activeDisplayLabel || completedLabel || cancelledLabel) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {activeDisplayLabel && <span>{activeDisplayLabel}</span>}
                          {completedLabel && <span>• {completedLabel}</span>}
                          {cancelledLabel && <span>• {cancelledLabel}</span>}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {overdueLabel && (
                        <div className="flex items-center gap-2 rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{overdueLabel}</span>
                        </div>
                      )}

                      {todayMessage && (
                        <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                          <CalendarClock className="h-4 w-4" />
                          <span>{todayMessage}</span>
                        </div>
                      )}

                      {upcomingMessage && (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                          <CalendarCheck className="h-4 w-4" />
                          <span>{upcomingMessage}</span>
                        </div>
                      )}

                      {lastCompletedMessage && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <span>{lastCompletedMessage}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        
      </CardContent>
    </Card>
  );
}
