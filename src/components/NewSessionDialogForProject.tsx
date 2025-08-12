import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, getUserLocale } from "@/lib/utils";
import { format } from "date-fns";

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
  
  const [sessionData, setSessionData] = useState({
    session_date: "",
    session_time: "",
    notes: ""
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [plannedSessions, setPlannedSessions] = useState<any[]>([]);

  const fetchPlannedSessions = async (month: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        .eq('user_id', user.id)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionData.session_date || !sessionData.session_time) {
      toast({
        title: "Validation error",
        description: "Session date and time are required.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create session with the specific project ID
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          notes: sessionData.notes.trim() || null,
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

      toast({
        title: "Success",
        description: "Session scheduled successfully."
      });

      // Reset form and close dialog
      setSessionData({
        session_date: "",
        session_time: "",
        notes: ""
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

  // Locale-aware formatting and layout
  const browserLocale = getUserLocale();
  const weekStartsOn = useMemo(() => {
    const l = browserLocale.toLowerCase();
    return l.includes('us') || l.includes('ph') || l.includes('ca') ? 0 : 1;
  }, [browserLocale]);

  // Create modifiers for sessions with different counts
  const sessionModifiers = useMemo(() => {
    const sessionCountByDate: Record<string, number> = {};
    (plannedSessions || []).forEach((s: any) => {
      if (!s.session_date) return;
      sessionCountByDate[s.session_date] = (sessionCountByDate[s.session_date] || 0) + 1;
    });

    const oneDot: Date[] = [];
    const twoDots: Date[] = [];
    const threeDots: Date[] = [];
    
    Object.entries(sessionCountByDate).forEach(([dateStr, count]) => {
      const date = new Date(dateStr);
      if (count === 1) oneDot.push(date);
      else if (count === 2) twoDots.push(date);
      else if (count >= 3) threeDots.push(date);
    });
    
    return { oneDot, twoDots, threeDots };
  }, [plannedSessions]);

  const formatters = {
    formatCaption: (month: Date) =>
      new Intl.DateTimeFormat(browserLocale, { month: 'long', year: 'numeric' }).format(month),
    formatWeekdayName: (date: Date) =>
      new Intl.DateTimeFormat(browserLocale, { weekday: 'short' }).format(date),
  } as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Session</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
          <DialogDescription>
            Schedule a photography session for {leadName} in {projectName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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
              <Label htmlFor="session_date">Session Date *</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? new Intl.DateTimeFormat(browserLocale, { dateStyle: "medium" }).format(selectedDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      if (date) {
                        handleInputChange("session_date", format(date, "yyyy-MM-dd"));
                        setDatePickerOpen(false);
                      }
                    }}
                    onMonthChange={(m) => setVisibleMonth(m)}
                    weekStartsOn={weekStartsOn}
                    formatters={formatters}
                    modifiers={sessionModifiers}
                    modifiersClassNames={{
                      oneDot: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary",
                      twoDots: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:flex after:gap-0.5 after:before:h-1.5 after:before:w-1.5 after:before:rounded-full after:before:bg-primary after:after:h-1.5 after:after:w-1.5 after:after:rounded-full after:after:bg-primary",
                      threeDots: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:flex after:gap-0.5 after:before:h-1.5 after:before:w-1.5 after:before:rounded-full after:before:bg-primary after:after:h-1.5 after:after:w-1.5 after:after:rounded-full after:after:bg-primary after:[&::before]:h-1.5 after:[&::before]:w-1.5 after:[&::before]:rounded-full after:[&::before]:bg-primary",
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {sessionsForDay.length > 0 && (
                <div className="rounded-md border p-3 animate-fade-in">
                  <div className="text-xs text-muted-foreground mb-2">Planned sessions on this day</div>
                  <ul className="space-y-2">
                    {sessionsForDay.map((s: any) => (
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
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}