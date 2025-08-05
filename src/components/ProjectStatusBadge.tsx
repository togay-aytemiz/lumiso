import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    return <Badge variant="secondary" className={className}>Loading...</Badge>;
  }

  if (!currentStatus) {
    return <Badge variant="secondary" className={className}>No status</Badge>;
  }

  if (!editable) {
    return (
      <Badge 
        className={className}
        style={{ 
          backgroundColor: currentStatus.color,
          color: getTextColor(currentStatus.color),
          border: 'none'
        }}
      >
        {currentStatus.name}
      </Badge>
    );
  }

  return (
    <Select 
      value={currentStatus.id} 
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-auto h-auto p-0 border-none bg-transparent hover:bg-muted/50 focus:ring-0">
        <SelectValue asChild>
          <Badge 
            className={`cursor-pointer ${className}`}
            style={{ 
              backgroundColor: currentStatus.color,
              color: getTextColor(currentStatus.color),
              border: 'none'
            }}
          >
            {currentStatus.name}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status.id} value={status.id}>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: status.color }}
              />
              {status.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}