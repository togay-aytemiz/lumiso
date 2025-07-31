import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";

interface Session {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  created_at: string;
  lead_name?: string;
}

const UpcomingSessions = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get sessions for today and future
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .gte('session_date', today)
        .eq('status', 'planned')
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Filter sessions by lead status and get lead names
      if (sessionsData && sessionsData.length > 0) {
        const leadIds = [...new Set(sessionsData.map(session => session.lead_id))];
        
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('id, name, status')
          .in('id', leadIds);

        if (leadsError) throw leadsError;

        // Only include sessions for leads with 'booked' status
        const filteredSessions = sessionsData.filter(session => {
          const lead = leadsData?.find(lead => lead.id === session.lead_id);
          return lead && lead.status === 'booked';
        });

        // Map lead names to sessions
        const sessionsWithNames = filteredSessions.map(session => ({
          ...session,
          lead_name: leadsData?.find(lead => lead.id === session.lead_id)?.name || 'Unknown'
        }));

        setSessions(sessionsWithNames);
      } else {
        setSessions([]);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching sessions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Sessions</h1>
        </div>
        <Card>
          <CardContent>
            {sessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                       <TableCell className="font-medium">
                         <button
                           onClick={() => navigate(`/leads/${session.lead_id}`, { state: { from: 'all-sessions' } })}
                           className="text-primary hover:underline cursor-pointer"
                         >
                           {session.lead_name}
                         </button>
                       </TableCell>
                      <TableCell>
                        {formatDate(session.session_date)}
                      </TableCell>
                      <TableCell>
                        {formatTime(session.session_time)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {session.notes ? (
                          <div 
                            className="truncate hover:whitespace-normal hover:overflow-visible hover:text-wrap cursor-help"
                            title={session.notes}
                          >
                            {session.notes}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No upcoming sessions</h3>
                <p>You don't have any sessions scheduled yet.</p>
                <p className="text-sm mt-2">Schedule sessions from the lead detail pages.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UpcomingSessions;