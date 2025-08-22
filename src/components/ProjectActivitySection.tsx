import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, MessageSquare, Bell, CheckCircle, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReminderCard from "@/components/ReminderCard";
import { formatTime } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import DateTimePicker from "@/components/ui/date-time-picker";
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
  const [userProfiles, setUserProfiles] = useState<Record<string, { full_name: string; profile_photo_url?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [content, setContent] = useState('');
  const [isReminderMode, setIsReminderMode] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  const {
    createReminderEvent
  } = useCalendarSync();
  useEffect(() => {
    fetchProjectActivities();
  }, [projectId]);

  const fetchUserProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', userIds);
      
      if (error) throw error;
      
      const profilesMap = (data || []).reduce((acc, profile) => {
        acc[profile.user_id] = {
          full_name: profile.full_name || 'Unknown User',
          profile_photo_url: profile.profile_photo_url
        };
        return acc;
      }, {} as Record<string, { full_name: string; profile_photo_url?: string }>);
      
      setUserProfiles(profilesMap);
    } catch (error: any) {
      console.error('Error fetching user profiles:', error);
    }
  };
  const fetchProjectActivities = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('activities').select('id, type, content, reminder_date, reminder_time, created_at, completed, lead_id, project_id, user_id').eq('lead_id', leadId).eq('project_id', projectId).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      const activities = data || [];
      setActivities(activities);
      
      // Fetch user profiles for the activities
      const userIds = [...new Set(activities.map(a => a.user_id).filter(Boolean))];
      await fetchUserProfiles(userIds);
    } catch (error: any) {
      console.error('Error fetching project activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };
  const handleSaveActivity = async () => {
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
      const {
        data: userData
      } = await supabase.auth.getUser();
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
      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      const activityDataWithOrg = {
        ...activityData,
        organization_id: userSettings.active_organization_id
      };

      const {
        data: newActivity,
        error
      } = await supabase.from('activities').insert(activityDataWithOrg).select('id').single();
      if (error) throw error;

      // Sync reminder to Google Calendar with project context
      if (isReminderMode && newActivity) {
        createReminderEvent({
          id: newActivity.id,
          lead_id: leadId,
          content: `${projectName}: ${content.trim()}`,
          reminder_date: reminderDateTime.split('T')[0],
          reminder_time: reminderDateTime.split('T')[1]
        }, {
          name: leadName
        });
      }
      toast({
        title: "Success",
        description: `${isReminderMode ? 'Reminder' : 'Note'} added to project successfully.`
      });

      // Reset form
      setContent('');
      setReminderDateTime('');
      setIsReminderMode(false);

      // Refresh data
      await fetchProjectActivities();

      // Notify parent about activity change
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

  // Helper component for user avatar
  const UserAvatar = ({ userId, className = "" }: { userId?: string; className?: string }) => {
    if (!userId || !userProfiles[userId]) {
      return null;
    }

    const profile = userProfiles[userId];
    const initials = profile.full_name
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Avatar className="h-6 w-6">
          <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground font-medium">
          Added by: {profile.full_name}
        </span>
      </div>
    );
  };
  const handleReminderToggle = (checked: boolean) => {
    setIsReminderMode(checked);
    if (!checked) {
      setReminderDateTime('');
    }
  };
  const toggleCompletion = async (activityId: string, completed: boolean) => {
    try {
      const {
        error
      } = await supabase.from('activities').update({
        completed
      }).eq('id', activityId);
      if (error) throw error;
      setActivities(prev => prev.map(activity => activity.id === activityId ? {
        ...activity,
        completed
      } : activity));
      toast({
        title: completed ? "Task marked as completed" : "Task marked as incomplete",
        description: "Task status updated successfully."
      });

      // Notify parent about activity change
      onActivityUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <FileText className="h-4 w-4" />
          Project specific activities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Activity Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Note</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="project-reminder-toggle" className="text-sm font-medium">
                  Set Reminder?
                </Label>
                <Switch id="project-reminder-toggle" checked={isReminderMode} onCheckedChange={handleReminderToggle} />
              </div>
            </div>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Enter your project note..." rows={1} className="resize-none min-h-[40px] max-h-[40px]" />
          </div>

          {isReminderMode && <div className="space-y-2">
              <Label>Date & Time</Label>
              <DateTimePicker value={reminderDateTime} onChange={setReminderDateTime} />
            </div>}

          <div className="flex justify-end">
            <Button onClick={handleSaveActivity} disabled={saving || !content.trim() || isReminderMode && !reminderDateTime} size="sm">
              {saving ? "Saving..." : `Add ${isReminderMode ? 'Reminder' : 'Note'}`}
            </Button>
          </div>
        </div>

        {/* Project Activities List */}
        {!loading && activities.length > 0 && <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Recent activities</Label>
            <div className="space-y-2">
              {activities.map(activity => <Card key={activity.id}>
                  <CardContent className="py-6 px-4 flex items-center">
                    <div className="space-y-4 w-full">
                      {/* Row 1: Icon + Type chip + User attribution */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {activity.type === 'note' ? <MessageSquare className="h-4 w-4 text-blue-500" /> : <Bell className="h-4 w-4 text-orange-500" />}
                          <Badge variant="outline" className="text-xs">
                            {activity.type}
                          </Badge>
                        </div>
                        <div className="flex-1" />
                        <UserAvatar userId={activity.user_id} />
                      </div>
                      
                      {/* Row 2: Main content */}
                      <div className="pl-1">
                        {activity.type === 'reminder' && activity.reminder_date ? (
                          <ReminderCard 
                            activity={activity} 
                            leadName={leadName} 
                            onToggleCompletion={toggleCompletion} 
                            showCompletedBadge={false} 
                            hideStatusBadge={activity.completed} 
                          />
                        ) : activity.type === 'reminder' ? (
                          // Reminder without date - show with completion button
                          <div className="flex items-start gap-3">
                            <button 
                              onClick={e => {
                                e.stopPropagation();
                                toggleCompletion(activity.id, !activity.completed);
                              }} 
                              className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors mt-0.5 flex-shrink-0"
                            >
                              {activity.completed ? 
                                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" /> : 
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                              }
                            </button>
                            <div className="flex-1">
                              <p className={`text-sm break-words ${activity.completed ? 'line-through opacity-60' : ''}`}>
                                {activity.content}
                              </p>
                            </div>
                          </div>
                        ) : (
                          // Regular note - no completion button
                          <div>
                            <p className="text-sm break-words">
                              {activity.content}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Row 3: Lead information */}
                      <div className="pl-1">
                        <div className="text-xs text-muted-foreground">
                          Lead: {leadName}
                        </div>
                      </div>
                      
                      {/* Row 4: Date and time */}
                      <div className="pl-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(activity.created_at).toLocaleDateString()} at {formatTime(new Date(activity.created_at).toTimeString().slice(0, 5))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
            </div>
          </div>}
      </CardContent>
    </Card>;
}