import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useProjectStatusController } from "@/hooks/useProjectStatusController";
import type { ProjectStatus } from "@/hooks/useProjectStatusController";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import "./ProjectStagePipeline.css";

interface ProjectStagePipelineProps {
  projectId: string;
  currentStatusId?: string | null;
  onStatusChange?: () => void;
  editable?: boolean;
  className?: string;
  statuses?: ProjectStatus[];
  statusesLoading?: boolean;
}

const ARROW_OVERLAP = 28;
const ONBOARDING_STORAGE_KEY = "lumiso:project-stage-pipeline-onboarding";
const ACCENT_BACKGROUND = "hsl(var(--accent))";
const ACCENT_FOREGROUND = "hsl(var(--accent-foreground))";
const INACTIVE_BACKGROUND = "hsl(var(--muted) / 0.25)";
const INACTIVE_FOREGROUND = "hsl(var(--muted-foreground))";
const BORDER_COLOR = "hsl(var(--border))";
const GAP_COLOR = "hsl(var(--background))";

const formatStageName = (name?: string | null) => {
  if (!name) return "";

  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function ProjectStagePipeline({
  projectId,
  currentStatusId,
  onStatusChange,
  editable = false,
  className,
  statuses: passedStatuses,
  statusesLoading
}: ProjectStagePipelineProps) {
  const { t: tForms } = useFormsTranslation();
  const { statuses, currentStatus, loading, isUpdating, handleStatusChange } = useProjectStatusController({
    projectId,
    currentStatusId,
    onStatusChange,
    statuses: passedStatuses,
    statusesLoading
  });

  const pipelineStatuses = useMemo(
    () => statuses.filter(status => status.name?.toLowerCase?.() !== "archived"),
    [statuses]
  );

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!editable) return;
    if (hasSeenOnboarding) return;
    if (pipelineStatuses.length === 0) return;
    setShowOnboarding(true);
  }, [editable, hasSeenOnboarding, pipelineStatuses.length]);

  const dismissOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    }
    setHasSeenOnboarding(true);
    setShowOnboarding(false);
  };

  const currentIndex = useMemo(() => {
    if (!currentStatus) return -1;
    return pipelineStatuses.findIndex(status => status.id === currentStatus.id);
  }, [currentStatus, pipelineStatuses]);

  const handleStageClick = (statusId: string) => {
    if (!editable || isUpdating) return;
    dismissOnboarding();
    void handleStatusChange(statusId);
  };

  if (loading) {
    return <div className={cn("h-9 w-full animate-pulse rounded-full bg-muted/40", className)} />;
  }

  if (pipelineStatuses.length === 0) {
    return (
      <div
        className={cn(
          "flex h-9 w-full items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/20 text-xs font-medium tracking-wide text-muted-foreground",
          className
        )}
      >
        {tForms("status.noStatusAvailable")}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn("pipeline-wrapper relative flex w-full items-center", className)}
        style={
          {
            "--pipeline-arrow": `${ARROW_OVERLAP}px`,
            "--pipeline-gap-color": GAP_COLOR
          } as React.CSSProperties
        }
      >
        {showOnboarding && (
          <div className="pointer-events-auto absolute -top-20 left-1/2 z-50 w-full max-w-xs -translate-x-1/2">
            <div className="relative rounded-xl border border-primary/30 bg-background/95 px-4 py-3 shadow-lg shadow-primary/10 backdrop-blur-sm">
              <button
                type="button"
                onClick={dismissOnboarding}
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-background text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">{tForms("status.pipelineDismiss")}</span>
              </button>
              <p className="text-sm font-semibold text-primary">{tForms("status.pipelineOnboardingTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {tForms("status.pipelineOnboardingDescription")}
              </p>
              <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-primary/30 bg-background/95" />
            </div>
          </div>
        )}

        <div className="flex w-full items-center">
          {pipelineStatuses.map((status, index) => {
            const isActive = currentIndex === index;
            const isCompleted = currentIndex !== -1 && index < currentIndex;
            const backgroundColor = isCompleted || isActive ? ACCENT_BACKGROUND : INACTIVE_BACKGROUND;
            const textColor = isCompleted || isActive ? ACCENT_FOREGROUND : INACTIVE_FOREGROUND;
            const borderColor = isCompleted || isActive ? ACCENT_BACKGROUND : BORDER_COLOR;
            const prevCompleted = index > 0 && currentIndex !== -1 && index - 1 < currentIndex;
            const prevActive = index > 0 && currentIndex === index - 1;
            const prevBackgroundColor =
              index === 0 ? undefined : prevCompleted || prevActive ? ACCENT_BACKGROUND : INACTIVE_BACKGROUND;
            const prevBorderColor =
              index === 0 ? undefined : prevCompleted || prevActive ? ACCENT_BACKGROUND : BORDER_COLOR;

            const stageStyle = {
              "--stage-bg": backgroundColor,
              "--stage-fg": textColor,
              "--stage-border": borderColor,
              "--stage-weight": isActive ? 600 : 500,
              ...(index > 0
                ? {
                    "--stage-gap-color": prevBackgroundColor,
                    "--stage-gap-border": prevBorderColor
                  }
                : {}),
              zIndex: index + (isActive ? pipelineStatuses.length : 0)
            } as React.CSSProperties;

            const baseButton = (
              <button
                type="button"
                className={cn(
                  "pipeline-stage flex-1 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 focus-visible:ring-offset-background transition-colors",
                  editable && !isUpdating ? "pipeline-stage--clickable" : "",
                  isActive ? "pipeline-stage--active" : "",
                  !editable || isUpdating ? "disabled:cursor-default" : ""
                )}
                style={stageStyle}
                aria-pressed={isActive}
                aria-current={isActive ? "step" : undefined}
                aria-label={tForms("status.pipelineStageLabel", { stage: status.name })}
                disabled={!editable || isUpdating}
                onClick={() => handleStageClick(status.id)}
              >
                <span className="truncate text-[12px] sm:text-sm">{formatStageName(status.name)}</span>
              </button>
            );

            if (editable) {
              return (
                <Tooltip key={status.id} delayDuration={150}>
                  <TooltipTrigger asChild>{baseButton}</TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    <span className="text-xs font-medium text-muted-foreground">
                      {tForms("status.pipelineChangeHint")}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <React.Fragment key={status.id}>{baseButton}</React.Fragment>;
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
