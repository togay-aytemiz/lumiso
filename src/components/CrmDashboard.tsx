import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, LogOut, Calendar, Users, CheckCircle, XCircle, Bell, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import AddLeadDialog from "./AddLeadDialog";
import NewSessionDialog from "./NewSessionDialog";
import GlobalSearch from "./GlobalSearch";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  due_date: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  title: string;
  date: string;
  location: string;
  status: string;
  lead_id: string;
}

interface Session {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  lead_name?: string;
}

interface Activity {
  id: string;
  content: string;
  reminder_date: string;
  reminder_time: string;
  type: string;
  lead_id: string;
}

const CrmDashboard = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Fetch activities with reminders
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('*')
        .not('reminder_date', 'is', null)
        .order('reminder_date', { ascending: true });

      if (activitiesError) throw activitiesError;

      // Fetch upcoming sessions - only for leads with 'booked' status
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .gte('session_date', new Date().toISOString().split('T')[0])
        .eq('status', 'scheduled')
        .order('session_date', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Filter sessions by lead status and get lead names
      if (sessionsData && sessionsData.length > 0) {
        const leadIds = sessionsData.map(session => session.lead_id);
        const { data: leadNamesData } = await supabase
          .from('leads')
          .select('id, name, status')
          .in('id', leadIds);

        // Only include sessions for leads with 'booked' status
        const sessionsWithNames = sessionsData
          .filter(session => {
            const lead = leadNamesData?.find(lead => lead.id === session.lead_id);
            return lead && lead.status === 'booked';
          })
          .map(session => ({
            ...session,
            lead_name: leadNamesData?.find(lead => lead.id === session.lead_id)?.name || 'Unknown Client'
          }));

        setUpcomingSessions(sessionsWithNames);
      } else {
        setUpcomingSessions([]);
      }

      setLeads(leadsData || []);
      setAppointments(appointmentsData || []);
      setActivities(activitiesData || []);
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Clean up any auth state first
      localStorage.removeItem('supabase.auth.token');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // Sign out with global scope to ensure all sessions are terminated
      await supabase.auth.signOut({ scope: 'global' });
      
      // Force a full page refresh to ensure clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force navigation even if signOut fails
      window.location.href = '/auth';
    }
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
    
    const todayReminders = activities.filter(activity => {
      if (!activity.reminder_date) return false;
      // Parse the reminder date properly (it's already in ISO format from Supabase)
      const reminderDate = new Date(activity.reminder_date);
      const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      return reminderDateOnly.getTime() === today.getTime();
    });
    
    const overdueReminders = activities.filter(activity => {
      if (!activity.reminder_date) return false;
      const reminderDate = new Date(activity.reminder_date);
      const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      return reminderDateOnly.getTime() < today.getTime();
    });
    
    const upcomingReminders = activities.filter(activity => {
      if (!activity.reminder_date) return false;
      const reminderDate = new Date(activity.reminder_date);
      const reminderDateOnly = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
      return reminderDateOnly.getTime() > today.getTime();
    });
    
    console.log('Reminder counts:', { today: todayReminders.length, overdue: overdueReminders.length, upcoming: upcomingReminders.length });
    console.log('Activities:', activities);
    
    return {
      today: todayReminders.length,
      overdue: overdueReminders.length,
      upcoming: upcomingReminders.length
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading your CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-800">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8 px-6 py-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your photography business
          </p>
        </div>
        <div className="flex items-center justify-end flex-1 ml-8">
          <div className="w-full max-w-lg min-w-[480px]">
            <GlobalSearch />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
          <Card className={`${getStatCardGradient('leads')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Leads</CardTitle>
              <Users className={`h-5 w-5 ${getIconColor('leads')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{leads.length}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                +{leads.filter(lead => new Date(lead.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('sessions')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Upcoming Sessions</CardTitle>
              <Calendar className={`h-5 w-5 ${getIconColor('sessions')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {upcomingSessions.length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Next 30 days
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('booked')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Booked Leads</CardTitle>
              <Users className={`h-5 w-5 ${getIconColor('booked')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {leads.filter(lead => lead.status === 'booked').length}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Ready for shoots
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('completed')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Completed Leads</CardTitle>
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
                This month
              </p>
            </CardContent>
          </Card>

          <Card className={`${getStatCardGradient('lost')} border-0 shadow-md hover:shadow-lg transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Lost Leads</CardTitle>
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
                Marked as lost this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reminders Card */}
        <Card className="mb-8 shadow-md hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-t-lg pb-4">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-slate-800 dark:text-slate-200">Reminders</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">Task reminders and notifications</CardDescription>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="hover:shadow-md transition-shadow"
                onClick={() => navigate("/reminders")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-6">
            {(() => {
              const { today, overdue, upcoming } = getReminderCounts();
              const totalTasks = today + overdue + upcoming;
              
              if (totalTasks === 0) {
                return (
                  <div className="text-center py-6">
                    <p className="text-slate-600 dark:text-slate-400">
                      No tasks scheduled. Enjoy your day 👏
                    </p>
                  </div>
                );
              }
              
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <div className="text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Today: </span>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">{today}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <div className="text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Overdue: </span>
                      <span className="font-semibold text-red-700 dark:text-red-300">{overdue}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-700">
                    <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <div className="text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Upcoming: </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{upcoming}</span>
                    </div>
                  </div>
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
                  <CardTitle className="text-slate-800 dark:text-slate-200">Recent Leads</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">Your latest potential clients</CardDescription>
                </div>
                <AddLeadDialog onLeadAdded={fetchData} />
              </div>
              {leads.length > 0 && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-fit mt-4 hover:shadow-md transition-shadow"
                  onClick={() => navigate("/leads")}
                >
                  See All Leads
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
                          Due: {new Date(lead.due_date).toLocaleDateString()}
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
                    <p>No leads yet. Add your first lead to get started!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow border-slate-200 dark:border-slate-700">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-t-lg">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-slate-800 dark:text-slate-200">Upcoming Sessions</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">Your next photography sessions</CardDescription>
                </div>
                <NewSessionDialog onSessionScheduled={fetchData} />
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-fit mt-4 hover:shadow-md transition-shadow"
                onClick={() => navigate("/sessions")}
              >
                View All Sessions
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingSessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming sessions</p>
                  </div>
                ) : (
                  upcomingSessions.slice(0, 3).map((session) => (
                    <div 
                      key={session.id} 
                      className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 hover:shadow-sm dark:hover:bg-slate-800 transition-all duration-200"
                      onClick={() => navigate(`/leads/${session.lead_id}`, { state: { from: 'dashboard' } })}
                    >
                      <div className="space-y-1">
                        <h4 className="font-medium text-slate-800 dark:text-slate-200 hover:text-primary transition-colors">{session.lead_name || 'Unknown Client'}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {new Date(session.session_date).toLocaleDateString()} at {session.session_time}
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
      </main>
    </div>
  );
};

export default CrmDashboard;