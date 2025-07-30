import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, LogOut, Calendar, Users } from "lucide-react";
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

      // Fetch upcoming sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .gte('session_date', new Date().toISOString().split('T')[0])
        .eq('status', 'scheduled')
        .order('session_date', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Get lead names for sessions
      if (sessionsData && sessionsData.length > 0) {
        const leadIds = sessionsData.map(session => session.lead_id);
        const { data: leadNamesData } = await supabase
          .from('leads')
          .select('id, name')
          .in('id', leadIds);

        const sessionsWithNames = sessionsData.map(session => ({
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
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'qualified': return 'outline';
      case 'proposal_sent': return 'destructive';
      case 'booked': return 'default';
      case 'completed': return 'default';
      case 'lost': return 'destructive';
      default: return 'default';
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Sweet Dreams CRM</h1>
            <p className="text-muted-foreground">Newborn Photography Business</p>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads.length}</div>
              <p className="text-xs text-muted-foreground">
                +{leads.filter(lead => new Date(lead.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {upcomingSessions.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Next 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Booked Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status === 'booked').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Ready for shoots
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Leads</CardTitle>
                  <CardDescription>Your latest potential clients</CardDescription>
                </div>
                <AddLeadDialog onLeadAdded={fetchData} />
              </div>
              {leads.length > 0 && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-fit mt-4"
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
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/leads/${lead.id}`, { state: { from: 'dashboard' } })}
                  >
                    <div className="space-y-1">
                      <h4 className="font-medium">{lead.name}</h4>
                      <p className="text-sm text-muted-foreground">{lead.email}</p>
                      {lead.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(lead.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                      {lead.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
                {leads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No leads yet. Add your first lead to get started!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Upcoming Sessions</CardTitle>
                  <CardDescription>Your next photography sessions</CardDescription>
                </div>
                <NewSessionDialog onSessionScheduled={fetchData} />
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-fit mt-4"
                onClick={() => navigate("/sessions")}
              >
                View All Sessions
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming sessions</p>
                  </div>
                ) : (
                  upcomingSessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-medium">{session.lead_name || 'Unknown Client'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.session_date).toLocaleDateString()} at {session.session_time}
                        </p>
                        {session.notes && (
                          <p className="text-xs text-muted-foreground">{session.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline">{session.status}</Badge>
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