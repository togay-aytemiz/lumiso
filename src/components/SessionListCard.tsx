import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { sortSessionsByLifecycle } from "@/lib/sessionSorting";
import DeadSimpleSessionBanner, { type DeadSimpleSession } from "@/components/DeadSimpleSessionBanner";
import type { LucideIcon } from "lucide-react";

interface SessionListCardProps {
  title: string;
  sessions: DeadSimpleSession[];
  loading?: boolean;
  icon?: LucideIcon;
  headerAction?: ReactNode;
  summary?: ReactNode;
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
  };
  onSessionClick: (sessionId: string) => void;
  onConnectProject?: (sessionId: string) => void;
}

export function SessionListCard({
  title,
  sessions,
  loading,
  icon: TitleIcon,
  headerAction,
  summary,
  emptyState,
  onSessionClick,
  onConnectProject
}: SessionListCardProps) {
  const EmptyIcon = emptyState?.icon;
  const sortedSessions = loading ? [] : sortSessionsByLifecycle(sessions);
  const shouldShowSummary = !loading && summary != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl font-semibold">
          <div className="flex items-center gap-2">
            {TitleIcon ? <TitleIcon className="h-4 w-4" /> : null}
            {title}
          </div>
          {headerAction}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="w-full h-4 bg-muted animate-pulse rounded" />
            <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
            <div className="h-16 bg-muted animate-pulse rounded" />
            <div className="h-16 bg-muted animate-pulse rounded" />
          </div>
        ) : sortedSessions.length > 0 ? (
          <div className="space-y-3">
            {shouldShowSummary ? (
              <p className="text-sm text-muted-foreground mb-3">{summary}</p>
            ) : null}
            {sortedSessions.map((session) => (
              <DeadSimpleSessionBanner
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                onConnectProject={onConnectProject}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            {EmptyIcon ? <EmptyIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" /> : null}
            {emptyState?.title ? (
              <p className="text-muted-foreground text-sm">{emptyState.title}</p>
            ) : null}
            {emptyState?.description ? (
              <p className="text-xs text-muted-foreground mt-1">{emptyState.description}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SessionListCard;
