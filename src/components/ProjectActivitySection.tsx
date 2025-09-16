import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActivityForm } from "@/components/shared/ActivityForm";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { toast } from "@/hooks/use-toast";


interface ProjectActivity {
  id: string;
  type: string;
  content: string;
  reminder_date?: string;
  reminder_time?: string;
  created_at: string;
  completed?: boolean;
  lead_id: string;
  user_id: string;
  project_id?: string;
}

interface ProjectActivitySectionProps {
  projectId: string;
  leadId: string;
  leadName: string;
  projectName: string;
  onActivityUpdated?: () => void;
}

export function ProjectActivitySection({
  projectId,
  leadId,
  leadName,
  projectName,
  onActivityUpdated
}: ProjectActivitySectionProps) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  

  useEffect(() => {
    fetchProjectActivities();
  }, [projectId]);

  const fetchProjectActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, project_id, user_id')
        .eq('lead_id', leadId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching project activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveActivity = async (content: string, isReminderMode: boolean, reminderDateTime?: string) => {
    if (!content.trim()) {
      toast({
        title: "Validation error",
        description: "Content is required.",
        variant: "destructive"
      });
      return;
    }
    if (isReminderMode && !reminderDateTime) {
      toast({
        title: "Validation error",
        description: "Date and time are required for reminders.",
        variant: "destructive"
      });
      return;
    }
    
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const activityData = {
        user_id: userData.user.id,
        lead_id: leadId,
        project_id: projectId,
        type: isReminderMode ? 'reminder' : 'note',
        content: content.trim(),
        ...(isReminderMode && reminderDateTime && {
          reminder_date: reminderDateTime.split('T')[0],
          reminder_time: reminderDateTime.split('T')[1]
        })
      };

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const activityDataWithOrg = {
        ...activityData,
        organization_id: organizationId
      };

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert(activityDataWithOrg)
        .select('id')
        .single();
      if (error) throw error;


      toast({
        title: "Success",
        description: `${isReminderMode ? 'Reminder' : 'Note'} added to project successfully.`
      });

      // Refresh data
      await fetchProjectActivities();
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ completed })
        .eq('id', activityId);
      if (error) throw error;
      
      setActivities(prev => prev.map(activity => 
        activity.id === activityId ? { ...activity, completed } : activity
      ));
      
      toast({
        title: completed ? "Task marked as completed" : "Task marked as incomplete",
        description: "Task status updated successfully."
      });

      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-24 w-full bg-muted animate-pulse rounded" />
          <div className="h-12 w-full bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">
          Project Activities
        </h3>
      </CardHeader>
      <CardContent className="space-y-6">
        <ActivityForm 
          onSubmit={handleSaveActivity}
          loading={saving}
          placeholder="Enter your project note..."
        />

        <div>
          <ActivityTimeline 
            activities={activities}
            leadName={leadName}
            onToggleCompletion={toggleCompletion}
          />
        </div>
      </CardContent>
    </Card>
  );
}