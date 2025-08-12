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
}

export function ProjectCard({ project, onView, refreshTrigger }: ProjectCardProps) {
  const { progress, loading } = useProjectProgress(project.id, refreshTrigger);
  const { paymentSummary, loading: paymentsLoading } = useProjectPayments(project.id, refreshTrigger);

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
      <CardContent className="p-4">
        <div 
          className="flex items-start justify-between"
          onClick={() => onView(project)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg">{project.name}</h3>
              {isArchived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
            </div>
            {project.description && (
              <p className="text-muted-foreground mb-2">{project.description}</p>
            )}
            
            {/* Progress Bar and Todo Status */}
            {!loading && progress.total > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{progress.completed}/{progress.total} todos completed</span>
                  </div>
                </div>
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
                        {progress.completed} done, {progress.total - progress.completed} remaining
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              {/* Status badge and creation/update dates */}
              <div className="flex items-center gap-3">
                {!isArchived && (
                  <ProjectStatusBadge 
                    projectId={project.id}
                    currentStatusId={project.status_id}
                    editable={false}
                    size="sm"
                    className="text-xs"
                  />
                )}
                <span>Created {format(new Date(project.created_at), "M/d/yy")}</span>
                {project.updated_at !== project.created_at && (
                  <span>Updated {format(new Date(project.updated_at), "M/d/yy")}</span>
                )}
              </div>
              
              {/* Payment Status */}
              {!paymentsLoading && paymentSummary.totalProject > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-600 font-medium">
                    {formatCurrency(paymentSummary.totalPaid)}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(paymentSummary.totalProject)}
                  </span>
                  {paymentSummary.remaining > 0 && (
                    <span className="text-orange-600 ml-1">
                      ({formatCurrency(paymentSummary.remaining)} remaining)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center ml-4">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}