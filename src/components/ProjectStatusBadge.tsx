import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, getBadgeTextColor } from "@/lib/utils";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";

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
  statuses?: ProjectStatus[]; // Add optional statuses prop
}

export function ProjectStatusBadge({ 
  projectId, 
  currentStatusId, 
  onStatusChange, 
  editable = false,
  className,
  size = 'default',
  statuses: passedStatuses
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

  console.log('ProjectStatusBadge rendered:', { projectId, currentStatusId, editable });

  useEffect(() => {
    if (passedStatuses) {
      // Keep full list (including Archived) so we can display current status correctly
      setStatuses(passedStatuses);
      setLoading(false);
    } else {
      fetchProjectStatuses();
    }
  }, [passedStatuses]);

  useEffect(() => {
    if (currentStatusId && statuses.length > 0) {
      const status = statuses.find(s => s.id === currentStatusId);
      setCurrentStatus(status || null);
      console.log('Current status set:', status);
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
    console.log('Fetching project statuses...');
    try {
      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      console.log('Fetched statuses:', data);
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
      if (currentStatus) {
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            content: `Status changed from "${currentStatus.name}" to "${newStatus.name}"`,
            type: 'status_change',
            project_id: projectId,
            lead_id: projectData.lead_id,
            user_id: userData.user.id
          });

        if (activityError) {
          console.error('Error logging activity:', activityError);
        }
      } else {
        // Log initial status assignment
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            content: `Status set to "${newStatus.name}"`,
            type: 'status_change',
            project_id: projectId,
            lead_id: projectData.lead_id,
            user_id: userData.user.id
          });

        if (activityError) {
          console.error('Error logging activity:', activityError);
        }
      }

      setCurrentStatus(newStatus);
      setDropdownOpen(false);
      onStatusChange?.();

      toast({
        title: "Status Updated",
        description: `Project status ${currentStatus ? 'changed' : 'set'} to "${newStatus.name}"`
      });

      // Send milestone notifications for status change
      if (activeOrganization?.id && currentStatus?.id) {
        await triggerProjectMilestone(projectId, currentStatus.id, newStatusId, activeOrganization.id, []);
      }

      // Trigger workflow for project status change
      if (activeOrganization?.id && currentStatus?.id) {
        try {
          await triggerProjectStatusChange(projectId, activeOrganization.id, currentStatus.name, newStatus.name, {
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
        title: "Error updating status",
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
        <span className={textSize}>Loading...</span>
      </div>
    );
  }

  // Handle case where no status is assigned yet
  if (!currentStatus && statuses.length > 0 && editable) {
    const defaultColor = "#A0AEC0";
    
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          className={cn(
            "inline-flex items-center gap-2 h-auto rounded-full font-medium hover:opacity-80 transition-opacity",
            "border cursor-pointer",
            padding,
            isUpdating && "cursor-not-allowed opacity-50",
            className
          )}
          style={{ 
            backgroundColor: defaultColor + '15',
            color: defaultColor,
            borderColor: defaultColor + '60'
          }}
          disabled={isUpdating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Status badge clicked (no current status), opening dropdown');
            setDropdownOpen(!dropdownOpen);
          }}
        >
          <div 
            className={cn("rounded-full border-2", dotSize)}
            style={{ borderColor: defaultColor }}
          />
          <span className={cn("uppercase tracking-wide font-semibold", textSize)}>SELECT STATUS</span>
          <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
        </Button>

        {/* Dropdown for status selection */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-background border rounded-lg shadow-lg z-50 p-2">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {statuses
                .filter((s) => s.name?.toLowerCase?.() !== 'archived')
                .map((status) => (
                  <Button
                    key={status.id}
                    variant="ghost"
                    className="w-full justify-start h-auto py-2 px-3 font-medium hover:bg-muted rounded-md"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Setting status for first time to:', status.name);
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
        <span className={textSize}>No status available</span>
      </div>
    );
  }

  if (!editable) {
    const textColor = getBadgeTextColor(currentStatus.color, currentStatus.name);
    return (
      <div 
        className={cn("inline-flex items-center gap-2 rounded-full font-medium", padding, className)}
        style={{ 
          backgroundColor: currentStatus.color + '15',
          color: textColor,
          border: `1px solid ${currentStatus.color}60`
        }}
      >
        <div 
          className={cn("rounded-full", dotSize)}
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatus.name}</span>
      </div>
    );
  }

  // Editable status badge with current status
  const textColor = getBadgeTextColor(currentStatus.color, currentStatus.name);
  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className={cn(
          "inline-flex items-center gap-2 h-auto rounded-full font-medium hover:opacity-80 transition-opacity",
          "border cursor-pointer",
          padding,
          isUpdating && "cursor-not-allowed opacity-50",
          className
        )}
        style={{ 
          backgroundColor: currentStatus.color + '15',
          color: textColor,
          borderColor: currentStatus.color + '60'
        }}
        disabled={isUpdating}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Status badge clicked, current status:', currentStatus.name, 'dropdown open:', dropdownOpen);
          setDropdownOpen(!dropdownOpen);
        }}
      >
        <div 
          className={cn("rounded-full", dotSize)}
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatus.name}</span>
        <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
      </Button>

      {/* Dropdown for changing status */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-background border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {statuses
              .filter((s) => s.name?.toLowerCase?.() !== 'archived')
              .map((status) => (
                <Button
                  key={status.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3 font-medium hover:bg-muted rounded-md",
                    currentStatus.id === status.id && "bg-muted"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Status option clicked:', status.name);
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