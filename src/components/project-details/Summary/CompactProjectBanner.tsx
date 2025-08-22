import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { Progress } from "@/components/ui/progress";
import { Calendar, DollarSign, CheckCircle } from "lucide-react";

interface CompactProjectBannerProps {
  projectId: string;
  name: string;
  projectTypeName?: string | null;
  statusId?: string | null;
  progress?: number;
  totalAmount?: number;
  paidAmount?: number;
  sessionCount?: number;
  completedSessions?: number;
  onStatusChange?: () => void;
}

export default function CompactProjectBanner({ 
  projectId, 
  name, 
  projectTypeName, 
  statusId, 
  progress = 0,
  totalAmount = 0,
  paidAmount = 0,
  sessionCount = 0,
  completedSessions = 0,
  onStatusChange 
}: CompactProjectBannerProps) {
  const progressPercentage = Math.round(progress);
  const paymentPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
  const sessionProgress = sessionCount > 0 ? Math.round((completedSessions / sessionCount) * 100) : 0;

  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <h3 className="text-lg font-semibold leading-tight truncate">{name}</h3>
              <ProjectStatusBadge 
                projectId={projectId} 
                currentStatusId={statusId}
                onStatusChange={onStatusChange}
                editable={true}
                className="text-xs"
              />
              {projectTypeName && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {projectTypeName.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Progress</span>
                </div>
                <span className="text-xs font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-1.5" />
            </div>

            {/* Payment Progress */}
            {totalAmount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Payments</span>
                  </div>
                  <span className="text-xs font-medium">{paymentPercentage}%</span>
                </div>
                <Progress value={paymentPercentage} className="h-1.5" />
              </div>
            )}

            {/* Session Progress */}
            {sessionCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Sessions</span>
                  </div>
                  <span className="text-xs font-medium">
                    {completedSessions}/{sessionCount}
                  </span>
                </div>
                <Progress value={sessionProgress} className="h-1.5" />
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {sessionCount > 0 && (
              <span>{sessionCount} session{sessionCount === 1 ? '' : 's'}</span>
            )}
            {totalAmount > 0 && (
              <span>${paidAmount.toLocaleString()} / ${totalAmount.toLocaleString()}</span>
            )}
            <span>{progressPercentage}% complete</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}