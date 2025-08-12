import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Plus, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import NewSessionDialog from "@/components/NewSessionDialog";
import { formatDate, formatTime, formatLongDate, getWeekRange } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";

interface Session {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';
  created_at: string;
  project_id?: string | null;
  project_name?: string;
  lead_name?: string;
  lead_status?: string;
}

type SortField = 'session_date' | 'session_time' | 'status' | 'lead_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

const AllSessions = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("planned");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("session_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const navigate = useNavigate();
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      // Get ALL sessions (not just upcoming or planned)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Filter out sessions linked to archived projects
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      let filteredSessions = sessionsData || [];
      if (userId) {
        const { data: archivedStatus } = await supabase
          .from('project_statuses')
          .select('id, name')
          .eq('user_id', userId)
          .ilike('name', 'archived')
          .maybeSingle();
        if (archivedStatus?.id) {
          const { data: archivedProjects } = await supabase
            .from('projects')
            .select('id')
            .eq('status_id', archivedStatus.id);
          const archivedIds = new Set((archivedProjects || []).map(p => p.id));
          filteredSessions = filteredSessions.filter(s => !s.project_id || !archivedIds.has(s.project_id));
        }
      }

      // Enrich with lead and project info
      if (filteredSessions.length > 0) {
        const leadIds = [...new Set(filteredSessions.map(s => s.lead_id))];
        const projectIds = [...new Set(filteredSessions.map(s => s.project_id).filter(Boolean))] as string[];

        const [leadsRes, projectsRes] = await Promise.all([
          supabase.from('leads').select('id, name, status').in('id', leadIds),
          projectIds.length
            ? supabase.from('projects').select('id, name').in('id', projectIds)
            : Promise.resolve({ data: [] as any[], error: null } as any)
        ]);

        if (leadsRes.error) throw leadsRes.error;
        if (projectsRes && 'error' in projectsRes && (projectsRes as any).error) throw (projectsRes as any).error;

        const leadsData = leadsRes.data || [];
        const projectsData = (projectsRes as any).data || [];

        const sessionsWithInfo = filteredSessions.map(session => ({
          ...session,
          lead_name: leadsData.find((l: any) => l.id === session.lead_id)?.name || 'Unknown',
          lead_status: leadsData.find((l: any) => l.id === session.lead_id)?.status || 'unknown',
          project_name: session.project_id ? (projectsData.find((p: any) => p.id === session.project_id)?.name || 'Unknown project') : undefined
        }));
        setSessions(sessionsWithInfo);
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

  const getDateRangeForFilter = (filter: string) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    switch (filter) {
      case 'past':
        return { start: new Date(0), end: startOfToday };
      case 'today':
        return { start: startOfToday, end: endOfToday };
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1);
        return { start: startOfTomorrow, end: endOfTomorrow };
      case 'thisweek':
        return getWeekRange(today);
      case 'nextweek':
        const nextWeekDate = new Date(today);
        nextWeekDate.setDate(today.getDate() + 7);
        return getWeekRange(nextWeekDate);
      case 'thismonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      case 'nextmonth':
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
        return { start: nextMonthStart, end: nextMonthEnd };
      default:
        return null;
    }
  };

  const getSessionCountForDateFilter = (filter: string) => {
    let filtered = sessions;
    
    // Apply status filter first
    if (statusFilter !== "all") {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Then apply date filter
    if (filter === "all") {
      return filtered.length;
    }

    const dateRange = getDateRangeForFilter(filter);
    if (!dateRange) return 0;

    return filtered.filter(session => {
      const sessionDate = new Date(session.session_date);
      return sessionDate >= dateRange.start && sessionDate < dateRange.end;
    }).length;
  };

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Apply date filter
    if (dateFilter !== "all") {
      const dateRange = getDateRangeForFilter(dateFilter);
      if (dateRange) {
        filtered = filtered.filter(session => {
          const sessionDate = new Date(session.session_date);
          return sessionDate >= dateRange.start && sessionDate < dateRange.end;
        });
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      // For date sorting, always add secondary sort by time
      if (sortField === 'session_date') {
        const aDate = a.session_date ? new Date(a.session_date).getTime() : 0;
        const bDate = b.session_date ? new Date(b.session_date).getTime() : 0;
        
        // First compare dates
        if (aDate !== bDate) {
          return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        // If dates are equal, sort by time (always ascending for better UX)
        const aTime = a.session_time || '';
        const bTime = b.session_time || '';
        return aTime.localeCompare(bTime);
      }
      
      // For other fields, use regular sorting
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date values
      if (sortField === 'created_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle time values
      if (sortField === 'session_time') {
        aValue = aValue ? aValue : '';
        bValue = bValue ? bValue : '';
      }

      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [sessions, statusFilter, dateFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (session: Session) => {
    navigate(`/leads/${session.lead_id}`, { state: { from: 'all-sessions' } });
  };

  const handleProjectClick = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    if (!session.project_id) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, lead_id, user_id, created_at, updated_at, status_id, previous_status_id, project_type_id')
        .eq('id', session.project_id)
        .single();
      if (error) throw error;
      
      // Fetch lead data separately
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('name')
        .eq('id', data.lead_id)
        .single();
      if (leadError) throw leadError;
      
      setViewingProject({ ...data, leads: leadData });
      setShowProjectDialog(true);
    } catch (err: any) {
      toast({ title: 'Unable to open project', description: err.message, variant: 'destructive' });
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_post_processing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'delivered': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatStatusText = (status: string) => {
    switch (status) {
      case 'in_post_processing': return 'In Post-Processing';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };


  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "planned", label: "Planned" },
    { value: "completed", label: "Completed" },
    { value: "in_post_processing", label: "Editing" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" }
  ];

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
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sessions</h1>
            <p className="text-muted-foreground">Manage your photo sessions and appointments</p>
          </div>
          <div className="w-full max-w-lg min-w-[480px] ml-8">
            <GlobalSearch />
          </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <NewSessionDialog onSessionScheduled={fetchSessions} />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filter by status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Date Filters */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dateFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("all")}
              >
                All ({getSessionCountForDateFilter("all")})
              </Button>
              <Button
                variant={dateFilter === "past" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("past")}
              >
                Past ({getSessionCountForDateFilter("past")})
              </Button>
              <Button
                variant={dateFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("today")}
              >
                Today ({getSessionCountForDateFilter("today")})
              </Button>
              <Button
                variant={dateFilter === "tomorrow" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("tomorrow")}
              >
                Tomorrow ({getSessionCountForDateFilter("tomorrow")})
              </Button>
              <Button
                variant={dateFilter === "thisweek" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("thisweek")}
              >
                This Week ({getSessionCountForDateFilter("thisweek")})
              </Button>
              <Button
                variant={dateFilter === "nextweek" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("nextweek")}
              >
                Next Week ({getSessionCountForDateFilter("nextweek")})
              </Button>
              <Button
                variant={dateFilter === "thismonth" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("thismonth")}
              >
                This Month ({getSessionCountForDateFilter("thismonth")})
              </Button>
              <Button
                variant={dateFilter === "nextmonth" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter("nextmonth")}
              >
                Next Month ({getSessionCountForDateFilter("nextmonth")})
              </Button>
            </div>
          </div>
          
          {filteredAndSortedSessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('lead_name')}
                  >
                    <div className="flex items-center gap-2">
                      Client Name
                      {getSortIcon('lead_name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('session_date')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {getSortIcon('session_date')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('session_time')}
                  >
                    <div className="flex items-center gap-2">
                      Time
                      {getSortIcon('session_time')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSessions.map((session) => (
                  <TableRow 
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(session)}
                  >
                    <TableCell>
                      {session.project_id ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto font-normal text-foreground hover:text-foreground hover:underline"
                          onClick={(e) => handleProjectClick(e, session)}
                          aria-label="View project details"
                        >
                          {session.project_name || 'Project'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {session.lead_name}
                    </TableCell>
                    <TableCell>
                      {formatLongDate(session.session_date)}
                    </TableCell>
                    <TableCell>
                      {formatTime(session.session_time)}
                    </TableCell>
                    <TableCell>
                      <SessionStatusBadge
                        sessionId={session.id}
                        currentStatus={session.status}
                        editable
                        size="sm"
                        onStatusChange={fetchSessions}
                      />
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
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No sessions found</h3>
              <p>
                {statusFilter === "all" 
                  ? "You don't have any sessions yet."
                  : `No sessions found with status "${statusFilter}".`
                }
              </p>
              <p className="text-sm mt-2">Click "Schedule Session" to add your first session.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ViewProjectDialog
        project={viewingProject}
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onProjectUpdated={fetchSessions}
        leadName={viewingProject?.leads?.name || ''}
      />
    </div>
  );
};

export default AllSessions;