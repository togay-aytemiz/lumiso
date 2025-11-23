import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getBadgeStyleProperties } from "@/lib/statusBadgeStyles";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTranslation } from "react-i18next";

interface LeadStatus {
  id: string;
  name: string;
  color: string;
  is_system_final?: boolean;
}

interface LeadStatusBadgeProps {
  leadId: string;
  currentStatusId?: string;
  currentStatus?: string; // Keep for backward compatibility
  onStatusChange?: () => void;
  editable?: boolean;
  className?: string;
  size?: 'sm' | 'default';
  statuses?: LeadStatus[];
  statusesLoading?: boolean;
}

export function LeadStatusBadge({ 
  leadId, 
  currentStatusId,
  currentStatus, 
  onStatusChange, 
  editable = false,
  className,
  size = 'default',
  statuses: passedStatuses,
  statusesLoading
}: LeadStatusBadgeProps) {
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [currentStatusData, setCurrentStatusData] = useState<LeadStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { settings: userSettings } = useOrganizationQuickSettings();
  const { triggerLeadStatusChange } = useWorkflowTriggers();
  const { activeOrganization } = useOrganization();
  const { t: tForms, i18n } = useTranslation("forms");
  const resolvedLanguage = i18n?.resolvedLanguage || i18n?.language || "en";
  const isTurkish = resolvedLanguage.startsWith("tr");
  const statusTranslations = {
    statusUpdated: isTurkish ? "Durum Güncellendi" : "Status Updated",
    leadStatusChanged: isTurkish ? 'Kişi durumu "{{status}}" olarak değiştirildi' : 'Lead status changed to "{{status}}"',
    leadStatusSet: isTurkish ? 'Kişi durumu "{{status}}" olarak ayarlandı' : 'Lead status set to "{{status}}"',
    errorUpdatingStatus: isTurkish ? "Durum güncellenirken hata" : "Error updating status"
  };
  const tStatus = (
    key: keyof typeof statusTranslations,
    options?: Record<string, string>
  ) =>
    tForms(`status.${key}`, {
      lng: resolvedLanguage,
      fallbackLng: false,
      defaultValue: statusTranslations[key],
      ...options
    });

  useEffect(() => {
    if (passedStatuses === undefined) {
      fetchLeadStatuses();
      return;
    }

    setStatuses(passedStatuses);
    if (typeof statusesLoading === 'boolean') {
      setLoading(statusesLoading);
    } else {
      setLoading(false);
    }
  }, [passedStatuses, statusesLoading]);

  useEffect(() => {
    if (statuses.length > 0) {
      let status: LeadStatus | undefined;
      
      // First try to find by status ID (preferred method)
      if (currentStatusId) {
        status = statuses.find(s => s.id === currentStatusId);
      }
      
      // Fallback to name-based lookup for backward compatibility
      if (!status && currentStatus) {
        status = statuses.find(s => s.name.toLowerCase() === currentStatus.toLowerCase());
      }
      
      // If not found by name, create a temporary status object for legacy statuses
      if (!status && currentStatus) {
        status = {
          id: currentStatus,
          name: currentStatus,
          color: getDefaultStatusColor(currentStatus)
        };
      }
      
      setCurrentStatusData(status || null);
    }
  }, [currentStatusId, currentStatus, statuses]);

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

  const getDefaultStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      'new': '#A0AEC0',
      'contacted': '#4299E1',
      'qualified': '#48BB78',
      'proposal_sent': '#ECC94B',
      'booked': '#9F7AEA',
      'completed': '#9AE6B4',
      'lost': '#F56565'
    };
    return colorMap[status.toLowerCase()] || '#A0AEC0';
  };

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error: unknown) {
      console.error('Error fetching lead statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (currentStatusData && newStatusId === currentStatusData.id) return;

    setIsUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const newStatus = statuses.find(s => s.id === newStatusId);
      if (!newStatus) throw new Error(tForms('status.statusNotFound'));
      const organizationId = activeOrganization?.id ?? null;

      // Update lead status using status_id
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          status_id: newStatusId,
          status: newStatus.name // Keep text field updated for backward compatibility
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Log the status change as an activity
      if (organizationId && currentStatusData) {
        const { error: activityError } = await supabase
          .from('activities')
          .insert({
            content: `Status changed from "${currentStatusData.name}" to "${newStatus.name}"`,
            type: 'status_change',
            lead_id: leadId,
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
            lead_id: leadId,
            user_id: userData.user.id,
            organization_id: organizationId
          });

        if (activityError) {
          console.error('Error logging activity:', activityError);
        }
      }

      setCurrentStatusData(newStatus);
      setDropdownOpen(false);
      onStatusChange?.();

      const toastDescription = currentStatusData
        ? tStatus("leadStatusChanged", { status: newStatus.name })
        : tStatus("leadStatusSet", { status: newStatus.name });

      toast({
        title: tStatus('statusUpdated'),
        description: toastDescription
      });

      // Trigger workflow for lead status change
      if (activeOrganization?.id && currentStatusData) {
        try {
          await triggerLeadStatusChange(leadId, activeOrganization.id, currentStatusData.name, newStatus.name, {
            old_status_id: currentStatusData.id,
            new_status_id: newStatusId,
            lead_id: leadId
          });
        } catch (workflowError) {
          console.error('Error triggering lead status workflow:', workflowError);
          // Don't block status change if workflow fails
        }
      }
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : String(error);

      toast({
        title: tStatus('errorUpdatingStatus'),
        description,
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
  if (!currentStatusData && statuses.length > 0 && editable) {
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
          <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-background bg-opacity-100 border rounded-lg shadow-lg z-50 p-2">
            <div className="space-y-1">
              {statuses
                .filter(status => userSettings.show_quick_status_buttons || !status.is_system_final)
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

  if (!currentStatusData) {
    return (
      <div className={cn("inline-flex items-center gap-2 bg-muted text-muted-foreground rounded-full", padding, className)}>
        <div className={cn("bg-muted-foreground/30 rounded-full", dotSize)} />
        <span className={textSize}>{tForms('status.noStatusAvailable')}</span>
      </div>
    );
  }

  const { tokens: activeTokens, style: activeStyle } = getBadgeStyleProperties(currentStatusData.color);

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
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatusData.name}</span>
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
          setDropdownOpen(!dropdownOpen);
        }}
      >
        <div 
          className={cn("rounded-full", dotSize)}
          style={{ backgroundColor: activeTokens.color }}
        />
        <span className={cn("uppercase tracking-wide font-semibold", textSize)}>{currentStatusData.name}</span>
        <ChevronDown className={cn("ml-1 transition-transform", isSmall ? "w-3 h-3" : "w-4 h-4", dropdownOpen && "rotate-180")} />
      </Button>

      {/* Dropdown for changing status */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-auto min-w-[200px] bg-background bg-opacity-100 border rounded-lg shadow-lg z-50 p-2">
          <div className="space-y-1">
            {statuses
              .filter(status => userSettings.show_quick_status_buttons || !status.is_system_final)
              .map((status) => (
              <Button
                key={status.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start h-auto py-2 px-3 font-medium rounded-md transition-colors",
                  "text-foreground hover:bg-muted hover:!text-foreground",
                  "focus-visible:ring-1 focus-visible:ring-muted-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  currentStatusData.name === status.name && "bg-muted"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
