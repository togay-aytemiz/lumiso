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
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { FilterBar } from "@/components/FilterBar";
import { PageLoadingSkeleton } from "@/components/ui/loading-presets";
import SessionSheetView from "@/components/SessionSheetView";

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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      // Get sessions with proper validation using inner joins
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          leads!inner(id, name, status),
          projects(id, name, status_id)
        `)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Filter out sessions with invalid references or archived projects
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      let filteredSessions = sessionsData || [];
      
      if (userId) {
        // Get user's active organization
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('active_organization_id')
          .eq('user_id', userId)
          .single();

        if (!userSettings?.active_organization_id) {
          return sessionsData || [];
        }

        // Get archived status for filtering
        const { data: archivedStatus } = await supabase
          .from('project_statuses')
          .select('id, name')
          .eq('organization_id', userSettings.active_organization_id)
          .ilike('name', 'archived')
          .maybeSingle();
          
        filteredSessions = filteredSessions.filter(session => {
          // Must have valid lead (inner join ensures this)
          if (!session.leads) return false;
          
          // If session has a project, check if it's archived
          if (session.project_id && session.projects) {
            if (archivedStatus?.id && session.projects.status_id === archivedStatus.id) {
              return false;
            }
          }
          
          return true;
        });
      }

      // Process sessions with enhanced data validation
      if (filteredSessions.length > 0) {
        const sessionsWithInfo = filteredSessions.map(session => ({
          ...session,
          lead_name: session.leads?.name || 'Unknown Lead',
          lead_status: session.leads?.status || 'unknown',
          project_name: session.projects?.name || undefined
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
    setSelectedSessionId(session.id);
    setIsSessionSheetOpen(true);
  };

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionSheetOpen(true);
  };

  const handleViewFullSessionDetails = () => {
    if (selectedSessionId) {
      navigate(`/sessions/${selectedSessionId}`);
    }
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
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
      <div className="relative">
        <PageLoadingSkeleton />
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-sm text-muted-foreground">
          Loading Sessions...
        </div>
      </div>
    );
  }

  // Prepare filter options for FilterBar (mobile only)
  const quickFilters = [
    { key: "all", label: "All", count: getSessionCountForDateFilter("all") },
    { key: "today", label: "Today", count: getSessionCountForDateFilter("today") },
    { key: "tomorrow", label: "Tomorrow", count: getSessionCountForDateFilter("tomorrow") }
  ];

  const allDateFilters = [
    { key: "all", label: "All", count: getSessionCountForDateFilter("all") },
    { key: "past", label: "Past", count: getSessionCountForDateFilter("past") },
    { key: "today", label: "Today", count: getSessionCountForDateFilter("today") },
    { key: "tomorrow", label: "Tomorrow", count: getSessionCountForDateFilter("tomorrow") },
    { key: "thisweek", label: "This Week", count: getSessionCountForDateFilter("thisweek") },
    { key: "nextweek", label: "Next Week", count: getSessionCountForDateFilter("nextweek") },
    { key: "thismonth", label: "This Month", count: getSessionCountForDateFilter("thismonth") },
    { key: "nextmonth", label: "Next Month", count: getSessionCountForDateFilter("nextmonth") }
  ];

  const statusOptionsForFilter = statusOptions.map(option => ({
    key: option.value,
    label: option.label
  }));

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageHeader
        title="Sessions"
        subtitle="Manage your photo sessions and appointments"
      >
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
          </div>
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <ListLoadingSkeleton />
        ) : (
          <div>
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageHeader
        title="Sessions"
        subtitle="Manage your photo sessions and appointments"
      >
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <NewSessionDialog onSessionScheduled={fetchSessions}>
              <Button 
                size="sm"
                className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Session</span>
              </Button>
            </NewSessionDialog>
          </div>
        </PageHeaderSearch>
      </PageHeader>

      {/* Mobile Filter Bar (≤767px only) */}
      <div className="md:hidden">
        <FilterBar
          quickFilters={quickFilters}
          activeQuickFilter={dateFilter}
          onQuickFilterChange={setDateFilter}
          allDateFilters={allDateFilters}
          activeDateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          statusOptions={statusOptionsForFilter}
          activeStatus={statusFilter}
          onStatusChange={setStatusFilter}
          isSticky={true}
        />
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Desktop Status Filter (≥768px only) */}
              <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 min-w-0">
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
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Date Filters (≥768px only) */}
             <div className="p-6 pb-0">
               <div className="hidden md:block mb-6">
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
             <div className="w-full overflow-x-auto overflow-y-hidden" style={{ maxWidth: '100vw' }}>
               <div className="min-w-max">
                 <Table style={{ minWidth: '700px' }}>
                   <TableHeader>
                     <TableRow>
                     <TableHead className="whitespace-nowrap">Project</TableHead>
                     <TableHead 
                       className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                       onClick={() => handleSort('lead_name')}
                     >
                       <div className="flex items-center gap-2">
                         Client Name
                         {getSortIcon('lead_name')}
                       </div>
                     </TableHead>
                     <TableHead 
                       className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                       onClick={() => handleSort('session_date')}
                     >
                       <div className="flex items-center gap-2">
                         Date
                         {getSortIcon('session_date')}
                       </div>
                     </TableHead>
                     <TableHead 
                       className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                       onClick={() => handleSort('session_time')}
                     >
                       <div className="flex items-center gap-2">
                         Time
                         {getSortIcon('session_time')}
                       </div>
                     </TableHead>
                     <TableHead 
                       className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                       onClick={() => handleSort('status')}
                     >
                       <div className="flex items-center gap-2">
                         Status
                         {getSortIcon('status')}
                       </div>
                     </TableHead>
                     <TableHead className="whitespace-nowrap">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSessions.map((session) => (
                  <TableRow 
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(session)}
                  >
                     <TableCell className="whitespace-nowrap">
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
                     <TableCell className="font-medium whitespace-nowrap">
                       {session.lead_name}
                     </TableCell>
                     <TableCell className="whitespace-nowrap">
                       {formatLongDate(session.session_date)}
                     </TableCell>
                     <TableCell className="whitespace-nowrap">
                       {formatTime(session.session_time)}
                     </TableCell>
                     <TableCell className="whitespace-nowrap">
                       <SessionStatusBadge
                         sessionId={session.id}
                         currentStatus={session.status}
                         editable
                         size="sm"
                         onStatusChange={fetchSessions}
                       />
                     </TableCell>
                     <TableCell className="max-w-xs truncate whitespace-nowrap">
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
               </div>
             </div>
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
           </div>
           </CardContent>
        </Card>
      </div>

      <ViewProjectDialog
        project={viewingProject}
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onProjectUpdated={fetchSessions}
        leadName={viewingProject?.leads?.name || ''}
      />

      {selectedSessionId && (
        <SessionSheetView
          sessionId={selectedSessionId}
          isOpen={isSessionSheetOpen}
          onOpenChange={setIsSessionSheetOpen}
          onViewFullDetails={handleViewFullSessionDetails}
          onNavigateToLead={handleNavigateToLead}
          onNavigateToProject={handleNavigateToProject}
        />
      )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllSessions;