import type { ReactNode } from "react";
import { Calendar, FolderOpen, FileText, MapPin } from "lucide-react";
import type { EntitySummaryItem } from "@/components/EntityHeader";
import { formatLongDate, formatTime } from "@/lib/utils";
import { TruncatedTextWithTooltip } from "@/components/TruncatedTextWithTooltip";
import { Button } from "@/components/ui/button";

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
  placeholders: {
    project: ReactNode;
    notes: ReactNode;
    location: ReactNode;
  };
  actions: {
    editSchedule: ReactNode;
    connectProject: ReactNode;
    addNotes: ReactNode;
    addLocation: ReactNode;
  };
  onProjectClick?: () => void;
  onEditSchedule?: () => void;
  onConnectProject?: () => void;
  onAddNotes?: () => void;
  onAddLocation?: () => void;
}

export function buildSessionSummaryItems({
  session,
  labels,
  placeholders,
  actions,
  onProjectClick,
  onEditSchedule,
  onConnectProject,
  onAddNotes,
  onAddLocation,
}: BuildSessionSummaryItemsParams): EntitySummaryItem[] {
  const items: EntitySummaryItem[] = [];

  items.push({
    key: "date-time",
    icon: Calendar,
    label: labels.dateTime,
    primary: formatLongDate(session.session_date),
    secondary: session.session_time ? formatTime(session.session_time) : undefined,
    action:
      onEditSchedule ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-medium text-primary hover:text-primary/80"
          onClick={onEditSchedule}
        >
          {actions.editSchedule}
        </Button>
      ) : undefined,
  });

  const projectName = session.projects?.name;
  const projectTypeName = session.projects?.project_types?.name ?? undefined;

  items.push({
    key: "project",
    icon: FolderOpen,
    label: labels.project,
    primary: projectName ? (
      onProjectClick ? (
        <button
          type="button"
          onClick={onProjectClick}
          className="line-clamp-2 w-full text-left font-semibold text-primary transition hover:underline"
        >
          {projectName}
        </button>
      ) : (
        <span className="line-clamp-2">{projectName}</span>
      )
    ) : (
      <span className="text-sm font-semibold text-muted-foreground">{placeholders.project}</span>
    ),
    secondary: projectName ? projectTypeName : undefined,
    action:
      !projectName && onConnectProject ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-medium text-primary hover:text-primary/80"
          onClick={onConnectProject}
        >
          {actions.connectProject}
        </Button>
      ) : undefined,
  });

  const notesValue = session.notes?.trim();

  items.push({
    key: "notes",
    icon: FileText,
    label: labels.notes,
    primary: notesValue ? (
      <TruncatedTextWithTooltip
        text={notesValue}
        lines={2}
        as="span"
        tooltipSide="bottom"
        tooltipAlign="start"
      />
    ) : (
      <span className="text-sm font-semibold text-muted-foreground">{placeholders.notes}</span>
    ),
    action:
      !notesValue && onAddNotes ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-medium text-primary hover:text-primary/80"
          onClick={onAddNotes}
        >
          {actions.addNotes}
        </Button>
      ) : undefined,
  });

  const locationValue = session.location?.trim();

  items.push({
    key: "location",
    icon: MapPin,
    label: labels.location,
    primary: locationValue ? (
      <TruncatedTextWithTooltip
        text={locationValue}
        lines={2}
        as="span"
        tooltipSide="bottom"
        tooltipAlign="start"
      />
    ) : (
      <span className="text-sm font-semibold text-muted-foreground">{placeholders.location}</span>
    ),
    action:
      !locationValue && onAddLocation ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-medium text-primary hover:text-primary/80"
          onClick={onAddLocation}
        >
          {actions.addLocation}
        </Button>
      ) : undefined,
  });

  return items;
}
