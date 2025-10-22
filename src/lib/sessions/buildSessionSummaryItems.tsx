import type { ReactNode } from "react";
import { Calendar, FolderOpen, FileText, MapPin } from "lucide-react";
import type { EntitySummaryItem } from "@/components/EntityHeader";
import { formatLongDate, formatTime } from "@/lib/utils";
import { TruncatedTextWithTooltip } from "@/components/TruncatedTextWithTooltip";

interface SessionSummaryProjectInfo {
  id: string;
  name: string;
  project_types?: {
    name?: string | null;
  } | null;
}

interface BuildSessionSummaryItemsParams {
  session: {
    session_date: string;
    session_time?: string | null;
    notes?: string | null;
    location?: string | null;
    projects?: SessionSummaryProjectInfo | null;
  };
  labels: {
    dateTime: ReactNode;
    project: ReactNode;
    notes: ReactNode;
    location: ReactNode;
  };
  onProjectClick?: () => void;
}

export function buildSessionSummaryItems({
  session,
  labels,
  onProjectClick,
}: BuildSessionSummaryItemsParams): EntitySummaryItem[] {
  const items: EntitySummaryItem[] = [];

  items.push({
    key: "date-time",
    icon: Calendar,
    label: labels.dateTime,
    primary: formatLongDate(session.session_date),
    secondary: session.session_time ? formatTime(session.session_time) : undefined,
  });

  if (session.projects?.name) {
    const projectName = session.projects.name;
    const projectTypeName = session.projects.project_types?.name ?? undefined;

    items.push({
      key: "project",
      icon: FolderOpen,
      label: labels.project,
      primary: onProjectClick ? (
        <button
          type="button"
          onClick={onProjectClick}
          className="line-clamp-2 w-full text-left font-semibold text-primary transition hover:underline"
        >
          {projectName}
        </button>
      ) : (
        <span className="line-clamp-2">{projectName}</span>
      ),
      secondary: projectTypeName,
    });
  }

  if (session.notes) {
    items.push({
      key: "notes",
      icon: FileText,
      label: labels.notes,
      primary: (
        <TruncatedTextWithTooltip
          text={session.notes}
          lines={2}
          as="span"
          tooltipSide="bottom"
          tooltipAlign="start"
        />
      ),
      secondary: null,
    });
  }

  if (session.location) {
    items.push({
      key: "location",
      icon: MapPin,
      label: labels.location,
      primary: (
        <TruncatedTextWithTooltip
          text={session.location}
          lines={2}
          as="span"
          tooltipSide="bottom"
          tooltipAlign="start"
        />
      ),
      secondary: null,
    });
  }

  return items;
}
