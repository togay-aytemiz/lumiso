import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, LogOut, Calendar, Users, CheckCircle, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import AddLeadDialog from "./AddLeadDialog";
import NewSessionDialog from "./NewSessionDialog";

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

const CrmDashboard = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'qualified': return 'outline';
      case 'proposal_sent': return 'destructive';
      case 'booked': return 'default';
      case 'completed': return 'success';
      case 'lost': return 'destructive';
      default: return 'default';
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
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Sweet Dreams CRM
            </h1>
            <p className="text-muted-foreground">Newborn Photography Business</p>
          </div>
          <Button onClick={handleSignOut} variant="outline" className="hover:shadow-md transition-shadow">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
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
                    <Badge variant={getStatusBadgeVariant(lead.status)} className="shadow-sm">
                      {lead.status.replace('_', ' ')}
                    </Badge>
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