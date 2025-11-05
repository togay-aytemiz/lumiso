import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBadgeStyleProperties } from "@/lib/statusBadgeStyles";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useProjectStatusController } from "@/hooks/useProjectStatusController";
import type { ProjectStatus } from "@/hooks/useProjectStatusController";

interface ProjectStatusBadgeProps {
  projectId: string;
  currentStatusId?: string | null;
  onStatusChange?: () => void;
  editable?: boolean;
  className?: string;
  size?: "sm" | "default";
  statuses?: ProjectStatus[];
  statusesLoading?: boolean;
}

export function ProjectStatusBadge({
  projectId,
  currentStatusId,
  onStatusChange,
  editable = false,
  className,
  size = "default",
  statuses: passedStatuses,
  statusesLoading
}: ProjectStatusBadgeProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t: tForms } = useFormsTranslation();

  const { statuses, currentStatus, loading, isUpdating, handleStatusChange } = useProjectStatusController({
    projectId,
    currentStatusId,
    onStatusChange,
    statuses: passedStatuses,
    statusesLoading
  });

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const selectableStatuses = statuses.filter(status => status.name?.toLowerCase?.() !== "archived");

  const isSmall = size === "sm";
  const dotSize = isSmall ? "w-2 h-2" : "w-2.5 h-2.5";
  const textSize = isSmall ? "text-xs" : "text-sm";
  const padding = isSmall ? "px-2 py-1" : "px-4 py-2";

  const handleSelect = (statusId: string) => {
    setDropdownOpen(false);
    void handleStatusChange(statusId);
  };

  if (loading) {
    return (
      <div className={cn("inline-flex items-center gap-2 bg-muted text-muted-foreground rounded-full", padding, className)}>
        <div className={cn("bg-muted-foreground/30 rounded-full animate-pulse", dotSize)} />
        <span className={textSize}>{tForms("status.loading")}</span>
      </div>
    );
  }

  if (!currentStatus && statuses.length > 0 && editable) {
    const defaultColor = "#A0AEC0";
    const { tokens, style: styleProps } = getBadgeStyleProperties(defaultColor);

    return (
      <div className="relative" ref={dropdownRef}>
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
          style={styleProps}
          disabled={isUpdating}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setDropdownOpen(prev => !prev);
          }}
        >
          <div className={cn("rounded-full border-2", dotSize)} style={{ borderColor: tokens.color }} />
          <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{tForms("status.selectStatus")}</span>
          <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
        </Button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 p-2">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {selectableStatuses.map(status => (
                <Button
                  key={status.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3 font-medium rounded-md transition-colors",
                    "text-foreground hover:bg-muted hover:!text-foreground",
                    "focus-visible:ring-1 focus-visible:ring-muted-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSelect(status.id);
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

  if (!currentStatus) {
    return (
      <div className={cn("inline-flex items-center gap-2 bg-muted text-muted-foreground rounded-full", padding, className)}>
        <div className={cn("bg-muted-foreground/30 rounded-full", dotSize)} />
        <span className={textSize}>{tForms("status.noStatusAvailable")}</span>
      </div>
    );
  }

  const { tokens: activeTokens, style: activeStyle } = getBadgeStyleProperties(currentStatus.color);

  if (!editable) {
    return (
      <div className={cn("inline-flex items-center gap-2 rounded-full font-medium border", padding, className)} style={activeStyle}>
        <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: activeTokens.color }} />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatus.name}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
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
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          setDropdownOpen(prev => !prev);
        }}
      >
        <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: activeTokens.color }} />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatus.name}</span>
        <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
      </Button>

      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {selectableStatuses.map(status => (
              <Button
                key={status.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start h-auto py-2 px-3 font-medium rounded-md transition-colors",
                  "text-foreground hover:bg-muted hover:!text-foreground",
                  "focus-visible:ring-1 focus-visible:ring-muted-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  currentStatus.id === status.id && "bg-muted"
                )}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelect(status.id);
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
