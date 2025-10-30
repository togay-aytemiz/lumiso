import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getBadgeStyleProperties } from "@/lib/statusBadgeStyles";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

interface ProjectStatus {
  id: string;
  name: string;
  color: string;
}

interface ProjectStatusBadgeProps {
  projectId: string;
  currentStatusId?: string | null;
  onStatusChange?: () => void;
  editable?: boolean;
  className?: string;
  size?: 'sm' | 'default';
  statuses?: ProjectStatus[];
  statusesLoading?: boolean;
}

export function ProjectStatusBadge({ 
  projectId, 
  currentStatusId, 
  onStatusChange, 
  editable = false,
  className,
  size = 'default',
  statuses: passedStatuses,
  statusesLoading
}: ProjectStatusBadgeProps) {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { triggerProjectMilestone } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();
  const { triggerProjectStatusChange } = useWorkflowTriggers();
  const { t: tForms } = useFormsTranslation();

  // Status badge rendered for project

  useEffect(() => {
    if (passedStatuses === undefined) {
      fetchProjectStatuses();
      return;
    }

    // Keep full list (including Archived) so we can display current status correctly
    setStatuses(passedStatuses);
    if (typeof statusesLoading === 'boolean') {
      setLoading(statusesLoading);
    } else {
      setLoading(false);
    }
  }, [passedStatuses, statusesLoading]);

  useEffect(() => {
    if (currentStatusId && statuses.length > 0) {
      const status = statuses.find(s => s.id === currentStatusId);
      setCurrentStatus(status || null);
    }
  }, [currentStatusId, statuses]);

  // Close dropdown when clicking outside
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

  const fetchProjectStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching project statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (currentStatus && newStatusId === currentStatus.id) return;

    setIsUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const newStatus = statuses.find(s => s.id === newStatusId);
      if (!newStatus) throw new Error('Status not found');
      const organizationId = activeOrganization?.id ?? null;

      // Get project details to get the lead_id
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('lead_id')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Update project status
      const { error: updateError } = await supabase
        .from('projects')
        .update({ status_id: newStatusId })
        .eq('id', projectId);

      if (updateError) throw updateError;

      // Log the status change as an activity (only if there was a previous status)
      if (organizationId && currentStatus) {
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            content: `Status changed from "${currentStatus.name}" to "${newStatus.name}"`,
            type: 'status_change',
            project_id: projectId,
            lead_id: projectData.lead_id,
            user_id: userData.user.id,
            organization_id: organizationId
          });

        if (activityError) {
          console.error('Error logging activity:', activityError);
        }
      } else if (organizationId) {
        // Log initial status assignment
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            content: `Status set to "${newStatus.name}"`,
            type: 'status_change',
            project_id: projectId,
            lead_id: projectData.lead_id,
            user_id: userData.user.id,
            organization_id: organizationId
          });

        if (activityError) {
          console.error('Error logging activity:', activityError);
        }
      }

      setCurrentStatus(newStatus);
      setDropdownOpen(false);
      onStatusChange?.();

      toast({
        title: tForms('status.statusUpdated'),
        description: `Project status ${currentStatus ? 'changed' : 'set'} to "${newStatus.name}"`
      });

      // Send milestone notifications for status change
      if (organizationId && currentStatus?.id) {
        await triggerProjectMilestone(projectId, currentStatus.id, newStatusId, organizationId, []);
      }

      // Trigger workflow for project status change
      if (organizationId && currentStatus?.id) {
        try {
          await triggerProjectStatusChange(projectId, organizationId, currentStatus.name, newStatus.name, {
            old_status_id: currentStatus.id,
            new_status_id: newStatusId,
            project_id: projectId,
            lead_id: projectData.lead_id
          });
        } catch (workflowError) {
          console.error('Error triggering project status workflow:', workflowError);
          // Don't block status change if workflow fails
        }
      }
    } catch (error: any) {
      toast({
        title: tForms('status.errorUpdatingStatus'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isSmall = size === 'sm';
  const dotSize = isSmall ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = isSmall ? 'text-xs' : 'text-sm';
  const padding = isSmall ? 'px-2 py-1' : 'px-4 py-2';

  if (loading) {
    return (
      <div className={cn("inline-flex items-center gap-2 bg-muted text-muted-foreground rounded-full", padding, className)}>
        <div className={cn("bg-muted-foreground/30 rounded-full animate-pulse", dotSize)} />
        <span className={textSize}>{tForms('status.loading')}</span>
      </div>
    );
  }

  // Handle case where no status is assigned yet
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Opening status dropdown for first-time selection
            setDropdownOpen(!dropdownOpen);
          }}
        >
          <div 
            className={cn("rounded-full border-2", dotSize)}
            style={{ borderColor: tokens.color }}
          />
          <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{tForms('status.selectStatus')}</span>
          <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
        </Button>

        {/* Dropdown for status selection */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 p-2">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {statuses
                .filter((s) => s.name?.toLowerCase?.() !== 'archived')
                .map((status) => (
                  <Button
                    key={status.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-auto py-2 px-3 font-medium rounded-md transition-colors",
                      "text-foreground hover:bg-muted hover:!text-foreground",
                      "focus-visible:ring-1 focus-visible:ring-muted-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Setting initial project status
                      handleStatusChange(status.id);
                    }}
                    disabled={isUpdating}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div 
                        className={cn("rounded-full flex-shrink-0", dotSize)}
                        style={{ backgroundColor: status.color }}
                      />
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
        <span className={textSize}>{tForms('status.noStatusAvailable')}</span>
      </div>
    );
  }

  const { tokens: activeTokens, style: activeStyle } = getBadgeStyleProperties(currentStatus.color);

  if (!editable) {
    return (
      <div 
        className={cn("inline-flex items-center gap-2 rounded-full font-medium border", padding, className)}
        style={activeStyle}
      >
        <div 
          className={cn("rounded-full", dotSize)}
          style={{ backgroundColor: activeTokens.color }}
        />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatus.name}</span>
      </div>
    );
  }

  // Editable status badge with current status
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Status badge clicked with existing status
          setDropdownOpen(!dropdownOpen);
        }}
      >
        <div 
          className={cn("rounded-full", dotSize)}
          style={{ backgroundColor: activeTokens.color }}
        />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatus.name}</span>
        <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
      </Button>

      {/* Dropdown for changing status */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {statuses
              .filter((s) => s.name?.toLowerCase?.() !== 'archived')
              .map((status) => (
                <Button
                  key={status.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3 font-medium rounded-md transition-colors",
                    "text-foreground hover:bg-muted hover:!text-foreground",
                    "focus-visible:ring-1 focus-visible:ring-muted-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    currentStatus.id === status.id && "bg-muted"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Status selection made
                    handleStatusChange(status.id);
                  }}
                  disabled={isUpdating}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div 
                      className={cn("rounded-full flex-shrink-0", dotSize)}
                      style={{ backgroundColor: status.color }}
                    />
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
