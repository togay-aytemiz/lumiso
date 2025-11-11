import { AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime, cn, getUserLocale, formatLongDate } from "@/lib/utils";
import { getRelativeDate, isOverdueSession } from "@/lib/dateUtils";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { getDisplaySessionName } from "@/lib/sessionUtils";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { TruncatedTextWithTooltip } from "@/components/TruncatedTextWithTooltip";
import type { SessionWithStatus } from "@/lib/sessionSorting";

export type DeadSimpleSession = SessionWithStatus & {
  session_name?: string | null;
  notes?: string;
  leads?: {
    name?: string;
  };
};

interface DeadSimpleSessionBannerProps {
  session: DeadSimpleSession;
  onClick: (sessionId: string) => void;
  onConnectProject?: (sessionId: string) => void;
}

const DeadSimpleSessionBanner = ({ session, onClick, onConnectProject }: DeadSimpleSessionBannerProps) => {
  const { settings: orgSettings } = useOrganizationSettings();
  const userLocale = getUserLocale();
  const { t } = useFormsTranslation();

  const formatSessionTime = (timeString: string): string => {
    return formatTime(timeString, userLocale, orgSettings?.time_format || undefined);
  };

  const formatSessionDate = (dateString: string): string => {
    const relativeDate = getRelativeDate(dateString, t);
    const todayText = t('relativeDates.today');
    const tomorrowText = t('relativeDates.tomorrow');
    const yesterdayText = t('relativeDates.yesterday');
    
    if (relativeDate === todayText || relativeDate === tomorrowText || relativeDate === yesterdayText) {
      return relativeDate;
    }
    // Use browser locale for long date format (e.g., "22 Ağu 2025 Cum")
    return formatLongDate(dateString, userLocale);
  };

  const getTimeIndicator = (session: DeadSimpleSession) => {
    const relativeDate = getRelativeDate(session.session_date, t);
    const isOverdue = isOverdueSession(session.session_date, session.status);
    
    if (isOverdue) {
      return {
        label: t('relativeDates.past_due'),
        leftBorder: "border-l-4 border-l-orange-500",
        labelBg: "bg-orange-100 text-orange-800"
      };
    }
    
    if (relativeDate === t('relativeDates.today')) {
      return {
        label: t('relativeDates.today'),
        leftBorder: "border-l-4 border-l-blue-500",
        labelBg: "bg-blue-100 text-blue-800"
      };
    }
    
    if (relativeDate === t('relativeDates.tomorrow')) {
      return {
        label: t('relativeDates.tomorrow'),
        leftBorder: "border-l-4 border-l-green-500",
        labelBg: "bg-green-100 text-green-800"
      };
    }
    
    return {
      label: null,
      leftBorder: "border-l-4 border-l-gray-200",
      labelBg: null
    };
  };

  const timeIndicator = getTimeIndicator(session);
  const isOverdue = isOverdueSession(session.session_date, session.status);
  const showConnectProject =
    !session.project_id && typeof onConnectProject === "function";

  return (
    <div
      className={cn(
        "w-full bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors",
        timeIndicator.leftBorder
      )}
      onClick={() => onClick(session.id)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 sm:gap-4">
        {/* Left: Date and Time (2 lines) */}
        <div className="flex-shrink-0">
          <div className="text-sm font-medium text-gray-900">
            {formatSessionDate(session.session_date)}
          </div>
          {session.session_time && (
            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              {formatSessionTime(session.session_time)}
            </div>
          )}
        </div>

        {/* Divider - only on desktop */}
        <div className="hidden sm:block w-px h-8 bg-gray-200"></div>

        {/* Middle: Session details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {getDisplaySessionName(session)}
            </span>
            {timeIndicator.label && (
              <Badge variant="secondary" className={cn("text-xs px-2 py-1", timeIndicator.labelBg)}>
                {timeIndicator.label}
              </Badge>
            )}
            {isOverdue && (
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            )}
          </div>
          
          {(session.projects?.name || showConnectProject) && (
            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
              <span>{t('sessionLabels.project')}:</span>
              {session.projects?.name ? (
                <span>{session.projects.name}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{t('sessionSheet.placeholders.project')}</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      onConnectProject?.(session.id);
                    }}
                  >
                    {t('sessionSheet.actions.connectProject')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {session.notes && (
            <TruncatedTextWithTooltip
              text={session.notes}
              lines={2}
              className="text-xs text-gray-600"
              as="div"
              tooltipSide="bottom"
              tooltipAlign="start"
            />
          )}
        </div>

        {/* Right: Status and arrow */}
        <div className="flex items-center gap-3 flex-shrink-0 self-start sm:self-center">
          <SessionStatusBadge
            sessionId={session.id}
            currentStatus={session.status}
            editable={false}
            onStatusChange={() => {}}
            size="sm"
          />
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default DeadSimpleSessionBanner;
