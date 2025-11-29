import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getBadgeStyleProperties } from "@/lib/statusBadgeStyles";
import { useSessionActions } from "@/hooks/useSessionActions";
import { useFormsTranslation, useMessagesTranslation } from "@/hooks/useTypedTranslation";
import { useSessionStatuses } from "@/hooks/useOrganizationData";

interface SessionStatusRow {
  id: string;
  name: string;
  color: string;
  template_slug?: string | null;
  lifecycle?: string | null;
  is_system_initial?: boolean | null;
}

type SessionEnum = string;

interface SessionStatusBadgeProps {
  sessionId: string;
  currentStatus: SessionEnum;
  onStatusChange?: () => void;
  editable?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

const enumToDisplay: Record<SessionEnum, string> = {
  planned: 'Planned',
  scheduled: 'Scheduled',
  preparing: 'Preparing',
  in_progress: 'In Progress',
  completed: 'Completed',
  in_post_processing: 'Editing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const fallbackColorByEnum: Record<SessionEnum, string> = {
  planned: '#6B7280',
  scheduled: '#0EA5E9',
  preparing: '#FACC15',
  in_progress: '#8B5CF6',
  completed: '#22C55E',
  in_post_processing: '#9F7AEA',
  delivered: '#4299E1',
  cancelled: '#DC2626',
};

const normalizeStatus = (value?: string | null) => (value ?? '').trim().toLowerCase();

export function SessionStatusBadge({
  sessionId,
  currentStatus,
  onStatusChange,
  editable = false,
  className,
  size = 'default',
}: SessionStatusBadgeProps) {
  const [statuses, setStatuses] = useState<SessionStatusRow[]>([]);
  const [current, setCurrent] = useState<SessionStatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { updateSessionStatus } = useSessionActions();
  const { t: tForms } = useFormsTranslation();
  const { t: tMessages } = useMessagesTranslation();
  const { t: tPages } = useTranslation("pages");
  const { data: sessionStatusData = [], isLoading: statusesLoading } = useSessionStatuses();

  const normalizedStatus = normalizeStatus(currentStatus) as SessionEnum;

  const getLocalizedDisplayName = (status: SessionEnum) => {
    const fallback = enumToDisplay[status] || status;
    return tPages(`sessions.statuses.${status}`, { defaultValue: fallback });
  };

  const resolvedStatuses = useMemo(
    () =>
      (sessionStatusData as SessionStatusRow[]).map((status) => ({
        ...status,
        template_slug: status.template_slug ?? null,
      })),
    [sessionStatusData]
  );

  const isSmall = size === 'sm';
  const dotSize = isSmall ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = isSmall ? 'text-xs' : 'text-sm';
  const padding = isSmall ? 'px-2 py-1' : 'px-4 py-2';

  useEffect(() => {
    setStatuses(resolvedStatuses);
  }, [resolvedStatuses]);

  useEffect(() => {
    setLoading(statusesLoading);
  }, [statusesLoading]);

  useEffect(() => {
    const match = statuses.find((status) => {
      const slug = normalizeStatus(status.template_slug);
      const name = normalizeStatus(status.name);
      const statusId = status.id;

      if (slug && slug === normalizedStatus) return true;
      if (name && name === normalizedStatus) return true;
      if (statusId && statusId === currentStatus) return true;
      return false;
    });

    setCurrent(match ?? null);
  }, [currentStatus, normalizedStatus, statuses]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  async function handleChange(newStatusId: string) {
    const newRow = statuses.find(s => s.id === newStatusId);
    if (!newRow) return;

    const targetStatus = normalizeStatus(newRow.template_slug) || normalizeStatus(newRow.name);

    if (!targetStatus) {
      toast({ title: tForms('status.unsupportedStage'), description: tForms('status.unsupportedStageDesc'), variant: 'destructive' });
      return;
    }

    if (targetStatus === normalizedStatus) {
      setDropdownOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const ok = await updateSessionStatus(sessionId, targetStatus);
      if (ok) {
        setCurrent(newRow);
        setDropdownOpen(false);
        onStatusChange?.();
        const localizedStatus = newRow.name || getLocalizedDisplayName(targetStatus as SessionEnum);
        toast({ title: tForms('status.sessionUpdated'), description: tMessages('toast.statusSetTo', { status: localizedStatus }) });
      }
    } finally {
      setIsUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className={cn("inline-flex items-center gap-2 bg-muted text-muted-foreground rounded-full", padding, className)}>
        <div className={cn("bg-muted-foreground/30 rounded-full animate-pulse", dotSize)} />
        <span className={textSize}>{tForms('status.loading')}</span>
      </div>
    );
  }

  const displayName = current?.name || getLocalizedDisplayName(normalizedStatus);
  const color = current?.color || fallbackColorByEnum[normalizedStatus] || '#A0AEC0';
  const { tokens: activeTokens, style: activeStyle } = getBadgeStyleProperties(color);

  if (!editable) {
    return (
      <div
        className={cn("inline-flex items-center gap-2 rounded-full font-medium border", padding, className)}
        style={activeStyle}
      >
        <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: activeTokens.color }} />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{displayName}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef} onClick={(e) => { e.stopPropagation(); }}>
      <Button
        variant="chip"
        className={cn(
          "inline-flex items-center gap-2 h-auto rounded-full font-medium transition-all",
          "border cursor-pointer shadow-sm hover:shadow-md",
          "hover:!bg-[var(--badge-hover-bg)] hover:!text-[var(--badge-color)] active:!bg-[var(--badge-active-bg)]",
          "focus-visible:ring-[var(--badge-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          padding,
          isUpdating && "cursor-not-allowed opacity-60",
          className
        )}
        style={activeStyle}
        disabled={isUpdating}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropdownOpen(!dropdownOpen);
        }}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
      >
        <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: activeTokens.color }} />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{displayName}</span>
        <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
      </Button>

      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-background border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1">
            {statuses.map((status) => (
                <Button
                  key={status.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3 font-medium rounded-md transition-colors",
                    "text-foreground hover:bg-muted hover:!text-foreground",
                    "focus-visible:ring-1 focus-visible:ring-muted-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    current?.id === status.id && "bg-muted"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleChange(status.id);
                  }}
                  disabled={isUpdating}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={cn("rounded-full flex-shrink-0", dotSize)} style={{ backgroundColor: status.color }} />
                    <span className={cn("uppercase tracking-wide font-semibold", textSize)}>
                      {status.name}
                    </span>
                  </div>
                </Button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionStatusBadge;
