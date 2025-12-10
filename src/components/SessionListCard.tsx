import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { sortSessionsByLifecycle } from "@/lib/sessionSorting";
import DeadSimpleSessionBanner, { type DeadSimpleSession } from "@/components/DeadSimpleSessionBanner";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

interface SessionListCardProps {
  title: string;
  sessions: DeadSimpleSession[];
  loading?: boolean;
  icon?: LucideIcon;
  headerAction?: ReactNode;
  summary?: ReactNode;
  banner?: ReactNode;
  onViewDetails?: (sessionId: string) => void;
  emptyState?: {
    icon?: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    helperAction?: ReactNode;
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
  banner,
  onViewDetails,
  emptyState,
  onSessionClick,
  onConnectProject
}: SessionListCardProps) {
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
      <CardContent className="space-y-4">
        {banner ? <div>{banner}</div> : null}
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
                onViewDetails={onViewDetails ? () => onViewDetails(session.id) : undefined}
                onConnectProject={onConnectProject}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={emptyState?.icon}
            title={emptyState?.title ?? ""}
            description={emptyState?.description}
            action={emptyState?.action}
            helperAction={emptyState?.helperAction}
            className="py-6"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default SessionListCard;
