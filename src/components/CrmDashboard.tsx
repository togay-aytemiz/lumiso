import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, Users, CheckCircle, XCircle, Bell, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import NewSessionDialog from "@/components/NewSessionDialog";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { ADD_ACTION_EVENTS } from "@/constants/addActionEvents";
import GlobalSearch from "@/components/GlobalSearch";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { getWeekRange, getUserLocale, formatLongDate, formatTime, formatDate } from "@/lib/utils";
import { DashboardLoadingSkeleton } from "@/components/ui/loading-presets";
import { useDashboardTranslation } from "@/hooks/useTypedTranslation";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import type { Database } from "@/integrations/supabase/types";
import DashboardDailyFocus, { type SessionWithLead } from "@/components/DashboardDailyFocus";
import { ProjectCreationWizardSheet } from "@/features/project-creation";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

const CrmDashboard = () => {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithLead[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useDashboardTranslation();

  useEffect(() => {
    const handleAddLead = (event: Event) => {
      event.preventDefault();
      setAddLeadDialogOpen(true);
    };
    window.addEventListener(ADD_ACTION_EVENTS.lead, handleAddLead);
    return () => {
      window.removeEventListener(ADD_ACTION_EVENTS.lead, handleAddLead);
    };
  }, []);

  useEffect(() => {
    const handleAddProject = (event: Event) => {
      event.preventDefault();
      setProjectWizardOpen(true);
    };

    window.addEventListener(ADD_ACTION_EVENTS.project, handleAddProject);
    return () => {
      window.removeEventListener(ADD_ACTION_EVENTS.project, handleAddProject);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      const metadata =
        (data.user?.user_metadata as {
          full_name?: string;
          name?: string;
          first_name?: string;
          last_name?: string;
          username?: string;
          preferred_name?: string;
        }) || {};
      const constructedName = [metadata.first_name, metadata.last_name].filter(Boolean).join(" ").trim();
      const derivedName =
        metadata.full_name ||
        metadata.preferred_name ||
        metadata.name ||
        constructedName ||
        metadata.username ||
        null;
      setUserName(derivedName || null);
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from<LeadRow>('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from<AppointmentRow>('appointments')
        .select('*')
        .order('date', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Fetch activities with reminders
      const { data: activitiesData, error: activitiesError } = await supabase
        .from<ActivityRow>('activities')
        .select('*')
        .not('reminder_date', 'is', null)
        .order('reminder_date', { ascending: true });

      if (activitiesError) throw activitiesError;

      // Fetch this week's sessions
      const today = new Date();
      const { start: startOfWeek, end: endOfWeek } = getWeekRange(today);
      
      const { data: sessionsData, error: sessionsError } = await supabase
        .from<SessionRow>('sessions')
        .select('*')
        .gte('session_date', startOfWeek.toISOString().split('T')[0])
        .lte('session_date', endOfWeek.toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Get lead names for all sessions (no status filtering - show all sessions this week)
      if (sessionsData && sessionsData.length > 0) {
        const leadIds = sessionsData.map(session => session.lead_id);
        type LeadSummary = Pick<LeadRow, 'id' | 'name' | 'status'>;
        const { data: leadNamesData } = await supabase
          .from<LeadSummary>('leads')
          .select('id, name, status')
          .in('id', leadIds);

        const sessionSummaries: SessionWithLead[] = sessionsData.map(session => ({
          ...session,
          lead_name: leadNamesData?.find(lead => lead.id === session.lead_id)?.name || 'Unknown Client'
        }));

        setUpcomingSessions(sessionSummaries);
      } else {
        setUpcomingSessions([]);
      }

      setLeads(leadsData ?? []);
      setAppointments(appointmentsData ?? []);
      setActivities(activitiesData ?? []);
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Throttle refresh on window focus / visibility changes
  useThrottledRefetchOnFocus(fetchData, 30_000);

  

  const handleSignOut = async () => {
    const { signOutSafely } = await import('@/utils/authUtils');
    await signOutSafely();
  };


  const getStatCardGradient = (type: 'leads' | 'sessions' | 'booked' | 'completed' | 'lost') => {
    switch (type) {
      case 'leads': return 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-950/30';
      case 'sessions': return 'bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/20 dark:to-violet-950/30';
      case 'booked': return 'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-950/30';
      case 'completed': return 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-950/30';
      case 'lost': return 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950/20 dark:to-rose-950/30';
    }
  };

  const getIconColor = (type: 'leads' | 'sessions' | 'booked' | 'completed' | 'lost') => {
    switch (type) {
      case 'leads': return 'text-blue-600 dark:text-blue-400';
      case 'sessions': return 'text-purple-600 dark:text-purple-400';
      case 'booked': return 'text-amber-600 dark:text-amber-400';
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'lost': return 'text-red-600 dark:text-red-400';
    }
  };

  const getReminderCounts = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Only count non-completed reminders
    const activeActivities = activities.filter(activity => !activity.completed);
    
    const todayReminders = activeActivities.filter(activity => {
      if (!activity.reminder_date) return false;
      const reminderDate = new Date(activity.reminder_date);
      const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      return reminderDateOnly.getTime() === today.getTime();
    });
    
    const overdueReminders = activeActivities.filter(activity => {
      if (!activity.reminder_date) return false;
      const reminderDate = new Date(activity.reminder_date);
      const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      return reminderDateOnly.getTime() < today.getTime();
    });
    
    const upcomingReminders = activeActivities.filter(activity => {
      if (!activity.reminder_date) return false;
      const reminderDate = new Date(activity.reminder_date);
      const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      return reminderDateOnly.getTime() > today.getTime();
    });
    
    return {
      today: todayReminders,
      overdue: overdueReminders,
      upcoming: upcomingReminders
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-800 overflow-x-hidden">
      <PageHeader title={t('page.title')}>
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <DashboardDailyFocus
          leads={leads}
          sessions={upcomingSessions}
          activities={activities}
          loading={loading}
          userName={userName}
        />
        {loading ? (
          <DashboardLoadingSkeleton />
        ) : (
          <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
          <Card className={`${getStatCardGradient('leads')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stats.total_leads')}</CardTitle>
              <Users className={`h-5 w-5 ${getIconColor('leads')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{leads.length}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                +{leads.filter(lead => new Date(lead.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} {t('stats.this_week')}
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('sessions')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stats.this_weeks_sessions')}</CardTitle>
              <Calendar className={`h-5 w-5 ${getIconColor('sessions')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {upcomingSessions.length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('stats.this_week')} ({getUserLocale().startsWith('tr') ? t('stats.week_format_intl') : t('stats.week_format_us')})
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('booked')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stats.booked_leads')}</CardTitle>
              <Users className={`h-5 w-5 ${getIconColor('booked')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {leads.filter(lead => lead.status === 'booked').length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('stats.ready_for_shoots')}
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('completed')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stats.completed_leads')}</CardTitle>
              <CheckCircle className={`h-5 w-5 ${getIconColor('completed')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {leads.filter(lead => {
                  if (lead.status !== 'completed') return false;
                  const updatedDate = new Date(lead.updated_at);
                  const now = new Date();
                  return updatedDate.getMonth() === now.getMonth() && updatedDate.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('stats.this_month')}
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('lost')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('stats.lost_leads')}</CardTitle>
              <XCircle className={`h-5 w-5 ${getIconColor('lost')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {leads.filter(lead => {
                  if (lead.status !== 'lost') return false;
                  const updatedDate = new Date(lead.updated_at);
                  const now = new Date();
                  return updatedDate.getMonth() === now.getMonth() && updatedDate.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('stats.marked_lost_month')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reminders Card */}
        <Card className="mb-8 shadow-md hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-t-lg pb-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-slate-800 dark:text-slate-200">{t('sections.reminders.title')}</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">{t('sections.reminders.description')}</CardDescription>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="hover:shadow-md transition-shadow"
                onClick={() => navigate("/reminders")}
              >
                {t('buttons.view_all')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-6">
            {(() => {
              const { today, overdue, upcoming } = getReminderCounts();
              const totalTasks = today.length + overdue.length + upcoming.length;
              
              if (totalTasks === 0) {
                return (
                  <div className="text-center py-6">
                    <p className="text-slate-600 dark:text-slate-400">
                      {t('sections.reminders.no_tasks')}
                    </p>
                  </div>
                );
              }

              const getLeadName = (leadId: string) => {
                const lead = leads.find(l => l.id === leadId);
                return lead?.name || 'Unknown Lead';
              };

              const renderReminderSummary = (
                reminders: ActivityRow[],
                typeLabel: string,
                bgColor: string,
                textColor: string,
                iconColor: string,
                IconComponent: LucideIcon
              ) => {
                const displayReminders = reminders.slice(0, 3);
                const hasMore = reminders.length > 3;

                return (
                  <div className={`p-3 rounded-lg ${bgColor} border border-opacity-20`}>
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className={`h-4 w-4 ${iconColor}`} />
                      <div className="text-sm">
                        <span className="text-slate-600 dark:text-slate-400">{typeLabel}: </span>
                        <span className={`font-semibold ${textColor}`}>{reminders.length}</span>
                      </div>
                    </div>
                    {displayReminders.length > 0 && (
                      <div className="space-y-1">
                        {displayReminders.map((reminder, index) => (
                          <div key={index} className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {getLeadName(reminder.lead_id)} - {reminder.content}
                          </div>
                        ))}
                        {hasMore && (
                          <div className="text-xs text-slate-500 dark:text-slate-500 italic">
                            +{reminders.length - 3} {t('sections.reminders.more_tasks')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              };
              
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {renderReminderSummary(
                    today, 
                    t('sections.reminders.today'), 
                    "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                    "text-blue-700 dark:text-blue-300",
                    "text-blue-600 dark:text-blue-400",
                    Bell
                  )}
                  
                  {renderReminderSummary(
                    overdue, 
                    t('sections.reminders.overdue'), 
                    "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                    "text-red-700 dark:text-red-300",
                    "text-red-600 dark:text-red-400",
                    AlertTriangle
                  )}
                  
                  {renderReminderSummary(
                    upcoming, 
                    t('sections.reminders.upcoming'), 
                    "bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-700",
                    "text-slate-700 dark:text-slate-300",
                    "text-slate-600 dark:text-slate-400",
                    Calendar
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-md hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-t-lg">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-slate-800 dark:text-slate-200">{t('sections.recent_leads.title')}</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">{t('sections.recent_leads.description')}</CardDescription>
                </div>
                <Button 
                  size="sm"
                  onClick={() => setAddLeadDialogOpen(true)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  {t('buttons.add_lead')}
                </Button>
              </div>
              {leads.length > 0 && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-fit mt-4 hover:shadow-md transition-shadow"
                  onClick={() => navigate("/leads")}
                >
                  {t('buttons.see_all_leads')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {leads.slice(0, 5).map((lead) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 hover:shadow-sm dark:hover:bg-slate-800 transition-all duration-200"
                    onClick={() => navigate(`/leads/${lead.id}`, { state: { from: 'dashboard' } })}
                  >
                    <div className="space-y-1">
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">{lead.name}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{lead.email}</p>
                        {lead.due_date && (
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            {t('sections.recent_leads.due_label')}: {formatDate(lead.due_date)}
                          </p>
                        )}
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium shadow-sm ${getLeadStatusStyles(lead.status).className}`}>
                      {formatStatusText(lead.status)}
                    </span>
                  </div>
                ))}
                {leads.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('sections.recent_leads.no_leads')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-t-lg">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-slate-800 dark:text-slate-200">{t('sections.sessions.title')}</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">{t('sections.sessions.description')} ({getUserLocale().startsWith('tr') ? t('stats.week_format_intl') : t('stats.week_format_us')})</CardDescription>
                </div>
                <NewSessionDialog
                  onSessionScheduled={fetchData}
                  openEvent={ADD_ACTION_EVENTS.session}
                />
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-fit mt-4 hover:shadow-md transition-shadow"
                onClick={() => navigate("/sessions")}
              >
                {t('buttons.view_all_sessions')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingSessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('sections.sessions.no_sessions')}</p>
                  </div>
                ) : (
                  upcomingSessions.slice(0, 3).map((session) => (
                    <div 
                      key={session.id} 
                      className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 hover:shadow-sm dark:hover:bg-slate-800 transition-all duration-200"
                      onClick={() => navigate(`/leads/${session.lead_id}`, { state: { from: 'dashboard' } })}
                    >
                       <div className="space-y-1">
                         <h4 className="font-medium text-slate-800 dark:text-slate-200 hover:text-primary transition-colors">{session.lead_name || t('sections.sessions.unknown_client')}</h4>
                         <p className="text-sm text-slate-600 dark:text-slate-400">
                           {formatLongDate(session.session_date)} – {formatTime(session.session_time)}
                         </p>
                        {session.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-500">{session.notes}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
          </>
        )}
      </main>
      
      <EnhancedAddLeadDialog 
        onSuccess={() => fetchData()} 
        open={addLeadDialogOpen}
        onOpenChange={setAddLeadDialogOpen}
        onClose={() => setAddLeadDialogOpen(false)}
      />
      <ProjectCreationWizardSheet
        isOpen={projectWizardOpen}
        onOpenChange={setProjectWizardOpen}
        entrySource="dashboard_daily_focus"
        onProjectCreated={() => {
          setProjectWizardOpen(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default CrmDashboard;
