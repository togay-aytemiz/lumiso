import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
}

export function ProjectStatusBadge({ 
  projectId, 
  currentStatusId, 
  onStatusChange, 
  editable = false,
  className 
}: ProjectStatusBadgeProps) {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProjectStatuses();
  }, []);

  useEffect(() => {
    if (currentStatusId && statuses.length > 0) {
      const status = statuses.find(s => s.id === currentStatusId);
      setCurrentStatus(status || null);
    }
  }, [currentStatusId, statuses]);

  const fetchProjectStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching project statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (!currentStatus || newStatusId === currentStatus.id) return;

    setIsUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const oldStatus = currentStatus;
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

      // Log the status change as an activity
      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          content: `Status changed from "${oldStatus.name}" to "${newStatus.name}"`,
          type: 'status_change',
          project_id: projectId,
          lead_id: projectData.lead_id,
          user_id: userData.user.id
        });

      if (activityError) {
        console.error('Error logging activity:', activityError);
        // Don't fail the whole operation if activity logging fails
      }

      setCurrentStatus(newStatus);
      setDropdownOpen(false);
      onStatusChange?.();

      toast({
        title: "Status Updated",
        description: `Project status changed to "${newStatus.name}"`
      });
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

  const getTextColor = (backgroundColor: string) => {
    // Remove # if present
    const hex = backgroundColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for light backgrounds, white for dark backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  if (loading) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs", className)}>
        <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!currentStatus) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs", className)}>
        <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
        <span>No status</span>
      </div>
    );
  }

  if (!editable) {
    return (
      <div 
        className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium", className)}
        style={{ 
          backgroundColor: currentStatus.color + '20', // 20% opacity background
          color: currentStatus.color,
          border: `1px solid ${currentStatus.color}40` // 40% opacity border
        }}
      >
        <div 
          className="w-2.5 h-2.5 rounded-full" 
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className="uppercase tracking-wide font-semibold">{currentStatus.name}</span>
      </div>
    );
  }

  return (
    <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 h-auto rounded-full font-medium hover:bg-transparent transition-all duration-200",
            isUpdating && "cursor-not-allowed opacity-50",
            className
          )}
          style={{ 
            backgroundColor: currentStatus.color + '20', // 20% opacity background
            color: currentStatus.color,
            border: `1px solid ${currentStatus.color}40` // 40% opacity border
          }}
          disabled={isUpdating}
          onClick={() => {
            console.log('Status badge clicked, opening dropdown');
            setDropdownOpen(true);
          }}
        >
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: currentStatus.color }}
          />
          <span className="uppercase tracking-wide font-semibold">{currentStatus.name}</span>
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="space-y-1">
          {statuses.map((status) => (
            <Button
              key={status.id}
              variant="ghost"
              className={cn(
                "w-full justify-start h-auto py-2 px-3 font-medium hover:bg-muted",
                currentStatus.id === status.id && "bg-muted"
              )}
              onClick={() => {
                console.log('Status option clicked:', status.name);
                handleStatusChange(status.id);
              }}
              disabled={isUpdating}
            >
              <div className="flex items-center gap-3 w-full">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: status.color }}
                />
                <span className="uppercase tracking-wide font-semibold text-sm">{status.name}</span>
              </div>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}