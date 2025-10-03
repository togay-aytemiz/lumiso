import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSessionActions } from "@/hooks/useSessionActions";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

interface SessionStatusRow {
  id: string;
  name: string;
  color: string;
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
  completed: 'Completed',
  in_post_processing: 'Editing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const fallbackColorByEnum: Record<SessionEnum, string> = {
  planned: '#A0AEC0',
  completed: '#48BB78',
  in_post_processing: '#9F7AEA',
  delivered: '#4299E1',
  cancelled: '#F56565',
};

function nameToEnum(name: string): SessionEnum | null {
  const n = name.trim().toLowerCase();
  if (n === 'planned') return 'planned';
  if (n === 'completed') return 'completed';
  if (n === 'delivered') return 'delivered';
  if (n.startsWith('cancel')) return 'cancelled';
  if (n.includes('edit') || n.includes('post')) return 'in_post_processing';
  return null;
}

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

  const isSmall = size === 'sm';
  const dotSize = isSmall ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = isSmall ? 'text-xs' : 'text-sm';
  const padding = isSmall ? 'px-2 py-1' : 'px-4 py-2';

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    // Compute current status row from fetched list using enum display name
    const display = enumToDisplay[currentStatus];
    const match = statuses.find(s => s.name.trim().toLowerCase() === display.toLowerCase()) || null;
    setCurrent(match);
  }, [currentStatus, statuses]);

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

  async function fetchStatuses() {
    try {
      const { data, error } = await supabase
        .from('session_statuses')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setStatuses((data || []) as SessionStatusRow[]);
    } catch (e) {
      console.error('Error fetching session statuses:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleChange(newStatusId: string) {
    const newRow = statuses.find(s => s.id === newStatusId);
    if (!newRow) return;
    const mapped = nameToEnum(newRow.name);
    if (!mapped) {
      toast({ title: tForms('status.unsupportedStage'), description: tForms('status.unsupportedStageDesc'), variant: 'destructive' });
      return;
    }
    if (enumToDisplay[currentStatus].toLowerCase() === newRow.name.toLowerCase()) {
      setDropdownOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      const ok = await updateSessionStatus(sessionId, mapped);
      if (ok) {
        setCurrent(newRow);
        setDropdownOpen(false);
        onStatusChange?.();
        toast({ title: tForms('status.sessionUpdated'), description: tMessages('toast.statusSetTo', { status: newRow.name }) });
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

  const displayName = enumToDisplay[currentStatus];
  const color = current?.color || fallbackColorByEnum[currentStatus];

  if (!editable) {
    return (
      <div
        className={cn("inline-flex items-center gap-2 rounded-full font-medium border", padding, className)}
        style={{ backgroundColor: color + '15', color, borderColor: color + '60' }}
      >
        <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: color }} />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{displayName}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef} onClick={(e) => { e.stopPropagation(); }}>
      <Button
        variant="ghost"
        className={cn(
          "inline-flex items-center gap-2 h-auto rounded-full font-medium hover:opacity-80 transition-opacity",
          "border cursor-pointer",
          padding,
          isUpdating && "cursor-not-allowed opacity-50",
          className
        )}
        style={{ backgroundColor: color + '15', color, borderColor: color + '60' }}
        disabled={isUpdating}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropdownOpen(!dropdownOpen);
        }}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
      >
        <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: color }} />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{displayName}</span>
        <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
      </Button>

      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-background border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1">
            {statuses
              .filter(s => nameToEnum(s.name) !== null)
              .map((status) => (
                <Button
                  key={status.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3 font-medium hover:bg-muted rounded-md",
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
                    <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{status.name}</span>
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
