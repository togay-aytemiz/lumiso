import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import { getUserLocale } from "@/lib/utils";
import { generateSessionName } from "@/lib/sessionUtils";
import { format } from "date-fns";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";


interface NewSessionDialogForProjectProps {
  leadId: string;
  leadName: string;
  projectName: string;
  projectId: string;
  onSessionScheduled?: () => void;
}

export function NewSessionDialogForProject({ 
  leadId, 
  leadName, 
  projectName,
  projectId, 
  onSessionScheduled 
}: NewSessionDialogForProjectProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { createSessionEvent } = useCalendarSync();
  const { triggerSessionScheduled } = useWorkflowTriggers();
  const { scheduleSessionReminders } = useSessionReminderScheduling();
  
  const [sessionData, setSessionData] = useState({
    session_name: "",
    session_date: "",
    session_time: "",
    notes: "",
    location: ""
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [plannedSessions, setPlannedSessions] = useState<any[]>([]);

  // Auto-populate session name when component mounts or project changes
  useEffect(() => {
    if (projectName && !sessionData.session_name.trim()) {
      setSessionData(prev => ({
        ...prev,
        session_name: generateSessionName(projectName)
      }));
    }
  }, [projectName, sessionData.session_name]);

  const fetchPlannedSessions = async (month: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        return;
      }

      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_date,
          session_time,
          lead_id,
          project_id,
          leads:lead_id (name),
          projects:project_id (name),
          status
        `)
        .eq('organization_id', userSettings.active_organization_id)
        .eq('status', 'planned')
        .gte('session_date', format(start, 'yyyy-MM-dd'))
        .lte('session_date', format(end, 'yyyy-MM-dd'));

      if (error) throw error;
      setPlannedSessions(data || []);
    } catch (err) {
      console.error('Failed to fetch planned sessions for calendar:', err);
    }
  };

  // Fetch when dialog opens and when month changes
  useEffect(() => {
    if (open) fetchPlannedSessions(visibleMonth);
  }, [open, visibleMonth]);

  const handleSubmit = async () => {
    
    if (!sessionData.session_name.trim() || !sessionData.session_date || !sessionData.session_time) {
      toast({
        title: "Validation error",
        description: "Session name, date and time are required.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      // Create session with the specific project ID
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          organization_id: userSettings.active_organization_id,
          lead_id: leadId,
          session_name: sessionData.session_name.trim(),
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          notes: sessionData.notes.trim() || null,
          location: sessionData.location.trim() || null,
          project_id: projectId
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // Sync to Google Calendar
      if (newSession) {
        createSessionEvent(
          {
            id: newSession.id,
            lead_id: leadId,
            session_date: sessionData.session_date,
            session_time: sessionData.session_time,
            notes: sessionData.notes.trim() || undefined
          },
          { name: leadName }
        );
      }

      // Trigger workflow for session scheduled
      try {
        console.log(`🚀 Triggering session_scheduled workflow for session: ${newSession.id} (from project)`);
        const workflowResult = await triggerSessionScheduled(newSession.id, userSettings.active_organization_id, {
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          location: sessionData.location,
          client_name: leadName,
          lead_id: leadId,
          project_id: projectId,
          status: 'planned'
        });
        console.log(`✅ Session workflow result:`, workflowResult);
      } catch (workflowError) {
        console.error('❌ Error triggering session_scheduled workflow:', workflowError);
        toast({
          title: "Warning", 
          description: "Session created successfully, but notifications may not be sent.",
          variant: "default"
        });
      }

      // Schedule session reminders
      try {
        console.log(`⏰ Scheduling reminders for session: ${newSession.id}`);
        await scheduleSessionReminders(newSession.id);
      } catch (reminderError) {
        console.error('❌ Error scheduling session reminders:', reminderError);
        // Don't block session creation if reminder scheduling fails
      }

      toast({
        title: "Success",
        description: "Session scheduled successfully."
      });

      // Reset form and close dialog
      setSessionData({
        session_name: "",
        session_date: "",
        session_time: "",
        notes: "",
        location: ""
      });
      setOpen(false);
      
      // Notify parent component
      if (onSessionScheduled) {
        onSessionScheduled();
      }
    } catch (error: any) {
      toast({
        title: "Error scheduling session",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof sessionData, value: string) => {
    setSessionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : "";
  const sessionsForDay = selectedKey ? (plannedSessions || []).filter((s: any) => s.session_date === selectedKey) : [];

  const sortedSessionsForDay = useMemo(() => {
    const toMinutes = (t: string | null | undefined) => {
      if (!t) return Number.POSITIVE_INFINITY;
      const parts = t.split(':');
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      return h * 60 + m;
    };
    return [...sessionsForDay].sort((a: any, b: any) => toMinutes(a.session_time) - toMinutes(b.session_time));
  }, [sessionsForDay]);
  const browserLocale = getUserLocale();

  const sessionCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    (plannedSessions || []).forEach((s: any) => {
      if (!s.session_date) return;
      map[s.session_date] = (map[s.session_date] || 0) + 1;
    });
    return map;
  }, [plannedSessions]);


  const isDirty = Boolean(
    sessionData.session_name.trim() ||
    sessionData.session_date.trim() ||
    sessionData.session_time.trim() ||
    sessionData.notes.trim() ||
    sessionData.location.trim()
  );

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      setSessionData({
        session_name: "",
        session_date: "",
        session_time: "",
        notes: "",
        location: ""
      });
      setSelectedDate(undefined);
      setOpen(false);
    },
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setSessionData({
        session_name: "",
        session_date: "",
        session_time: "",
        notes: "",
        location: ""
      });
      setSelectedDate(undefined);
      setOpen(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => setOpen(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Scheduling..." : "Schedule Session",
      onClick: handleSubmit,
      disabled: loading || !sessionData.session_name.trim() || !sessionData.session_date || !sessionData.session_time,
      loading: loading
    }
  ];

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add
      </Button>

      <AppSheetModal
        title="Schedule Session"
        isOpen={open}
        onOpenChange={setOpen}
        size="default"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              value={leadName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Input
              id="project"
              value={projectName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_name">Session Name *</Label>
            <Input
              id="session_name"
              value={sessionData.session_name}
              onChange={(e) => handleInputChange("session_name", e.target.value)}
              placeholder="Enter session name..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_date">Session Date *</Label>
            <div className="rounded-lg border p-3">
              <ReactCalendar
                className="react-calendar w-full pointer-events-auto"
                locale={browserLocale}
                view="month"
                minDetail="month"
                next2Label={null}
                prev2Label={null}
                onActiveStartDateChange={({ activeStartDate, view }) => {
                  if (view === 'month' && activeStartDate) {
                    setVisibleMonth(activeStartDate);
                  }
                }}
                onChange={(value) => {
                  const d = Array.isArray(value) ? value[0] : value;
                  const date = d instanceof Date ? d : undefined;
                  setSelectedDate(date);
                  if (date) {
                    handleInputChange("session_date", format(date, "yyyy-MM-dd"));
                  }
                }}
                value={selectedDate ?? null}
                formatShortWeekday={(_, date) => new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date)}
                tileContent={({ date, view }) => {
                  if (view !== 'month') return null;
                  const key = format(date, 'yyyy-MM-dd');
                  const count = sessionCountByDate[key] || 0;
                  const dots = Math.min(count, 3);
                  if (!dots) return null;
                  return (
                    <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5">
                      {Array.from({ length: dots }).map((_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                      ))}
                    </div>
                  );
                }}
              />
              <div className="mt-3 flex items-center justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    handleInputChange("session_date", format(today, "yyyy-MM-dd"));
                  }}
                >
                  Today
                </Button>
              </div>
            </div>
            {sessionsForDay.length > 0 && (
              <div className="rounded-md border p-3 animate-fade-in">
                <div className="text-xs text-muted-foreground mb-2">Planned sessions on this day</div>
                <ul className="space-y-2">
                  {sortedSessionsForDay.map((s: any) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="font-medium tabular-nums">{(s.session_time || '').slice(0,5)}</span>
                      <span className="text-muted-foreground truncate">
                        {s.leads?.name || 'Unknown lead'} · {s.projects?.name || 'No project'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_time">Session Time *</Label>
            <Input
              id="session_time"
              type="time"
              value={sessionData.session_time}
              onChange={(e) => handleInputChange("session_time", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location / Address</Label>
            <Textarea
              id="location"
              value={sessionData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              placeholder="Enter session location or address..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Session Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={sessionData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Any special requirements or notes for this session..."
              rows={3}
            />
          </div>
        </div>
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message="You have unsaved session details."
      />
    </>
  );
}