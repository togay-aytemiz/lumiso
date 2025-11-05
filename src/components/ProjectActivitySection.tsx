import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityForm } from "@/components/shared/ActivityForm";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { toast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import type { Database } from "@/integrations/supabase/types";
import { MessageSquareText } from "lucide-react";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

type ProjectActivity = {
  id: string;
  type: ActivityRow["type"];
  content: string;
  reminder_date: string | null;
  reminder_time: string | null;
  created_at: string;
  completed: boolean;
  lead_id: string;
  user_id: string;
  project_id?: string;
};

const mapActivityRow = (row: ActivityRow): ProjectActivity => ({
  id: row.id,
  type: row.type,
  content: row.content ?? "",
  reminder_date: row.reminder_date,
  reminder_time: row.reminder_time,
  created_at: row.created_at,
  completed: Boolean(row.completed),
  lead_id: row.lead_id,
  user_id: row.user_id,
  project_id: row.project_id ?? undefined,
});

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

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
  const { t } = useFormsTranslation();
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProjectActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ActivityRow>("activities")
        .select("*")
        .eq("lead_id", leadId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setActivities((data ?? []).map(mapActivityRow));
    } catch (error) {
      console.error("Error fetching project activities:", error);
      setActivities([]);
    }
  }, [leadId, projectId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await fetchProjectActivities();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchProjectActivities]);

  const handleSaveActivity = async (
    content: string,
    isReminderMode: boolean,
    reminderDateTime?: string
  ) => {
    if (!content.trim()) {
      toast({
        title: t("validation.required_field"),
        description: t("validation.content_required"),
        variant: "destructive",
      });
      return;
    }
    if (isReminderMode && !reminderDateTime) {
      toast({
        title: t("validation.required_field"),
        description: t("validation.datetime_required_for_reminders"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error("Organization required");
      }

      const activityData: Partial<ActivityRow> & {
        user_id: string;
        lead_id: string;
        project_id: string;
        type: ActivityRow["type"];
        content: string;
        organization_id: string;
        reminder_date: string | null;
        reminder_time: string | null;
      } = {
        user_id: userData.user.id,
        lead_id,
        project_id: projectId,
        type: isReminderMode ? "reminder" : "note",
        content: content.trim(),
        reminder_date:
          isReminderMode && reminderDateTime ? reminderDateTime.split("T")[0] : null,
        reminder_time:
          isReminderMode && reminderDateTime ? reminderDateTime.split("T")[1] : null,
        organization_id: organizationId,
      };

      const { error } = await supabase
        .from('activities')
        .insert(activityData)
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: t("success.saved"),
        description: `${isReminderMode ? t("activity.reminder") : t("activity.note")} ${t("activity.added_to_project")}.`
      });

      // Refresh data
      await fetchProjectActivities();
      onActivityUpdated?.();
    } catch (error) {
      toast({
        title: t("error.generic"),
        description: getErrorMessage(error),
        variant: "destructive",
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
        title: completed ? t("activity.task_completed") : t("activity.task_incomplete"),
        description: t("activity.task_status_updated")
      });

      onActivityUpdated?.();
    } catch (error) {
      toast({
        title: t("activity.error_updating_task"),
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-medium text-muted-foreground">
            <MessageSquareText className="h-4 w-4 animate-pulse" />
            {t("projectDetails.activities.title")}
          </CardTitle>
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <MessageSquareText className="h-4 w-4" />
          {t("projectDetails.activities.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ActivityForm 
          onSubmit={handleSaveActivity}
          loading={saving}
          placeholder={t("projectDetails.activities.placeholder")}
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
