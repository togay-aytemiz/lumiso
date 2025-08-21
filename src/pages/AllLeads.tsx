import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Plus, Users, FileText, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AddLeadDialog from "@/components/AddLeadDialog";
import { useNavigate } from "react-router-dom";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { formatDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/hooks/useOnboarding";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  due_date: string;
  notes: string;
  status: string;
  status_id?: string;
  created_at: string;
  assignees?: string[];
}

type SortField = keyof Lead;
type SortDirection = 'asc' | 'desc';

const AllLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const navigate = useNavigate();
  const { completedCount, completeStep } = useOnboarding();

  const leadsTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Welcome to Lead Management",
      description: "This is your leads dashboard where you can track and manage all your potential clients. Here's what you can do:",
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Track Leads</h4>
              <p className="text-sm text-muted-foreground">View all your leads in one organized table with contact information and status.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Filter className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Filter & Sort</h4>
              <p className="text-sm text-muted-foreground">Filter by lead status and sort by any column to find exactly what you need.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Manage Details</h4>
              <p className="text-sm text-muted-foreground">Click on any lead to view detailed information, add notes, and track progress.</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: "Add Your First Lead",
      description: "Now let's add your first lead! Click the 'Add Lead' button in the top right corner to get started.",
      content: null,
      mode: "floating",
      canProceed: leads.length > 0,
      requiresAction: leads.length === 0,
      disabledTooltip: "Add at least 1 lead to continue"
    },
    {
      id: 3,
      title: "Excellent! Lead Management Complete 🎉",
      description: "Congratulations! You've successfully learned about lead management. You're ready to move on to the next step of your photography CRM setup.",
      content: null,
      mode: "modal",
      canProceed: true
    }
  ];

  // Check if we should show tutorial when component mounts
  useEffect(() => {
    if (completedCount === 1) {
      setShowTutorial(true);
      setCurrentTutorialStep(0); // Start from step 1
    }
  }, [completedCount]);

  // Update tutorial step when needed
  useEffect(() => {
    if (showTutorial && !addLeadDialogOpen && currentTutorialStep === 1) {
      // If we're on step 2 (floating) and dialog closes, move to step 3
      setCurrentTutorialStep(2);
    }
  }, [addLeadDialogOpen, showTutorial, currentTutorialStep]);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      await completeStep();
      setShowTutorial(false);
      navigate('/getting-started');
    } catch (error) {
      console.error('Error completing tutorial:', error);
      toast({
        title: "Error",
        description: "Failed to save progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTutorialExit = () => {
    setShowTutorial(false);
  };

  // Handle add lead dialog close - advance to step 3 if we're on step 2
  const handleAddLeadDialogChange = (open: boolean) => {
    setAddLeadDialogOpen(open);
    // Tutorial step advancement is handled in useEffect
  };

  useEffect(() => {
    fetchLeads();
    fetchLeadStatuses();
  }, []);

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeadStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching lead statuses:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_statuses(id, name, color, is_system_final)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching leads",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedLeads = useMemo(() => {
    let filtered = leads;
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = leads.filter(lead => (lead as any).lead_statuses?.name === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date values
      if (sortField === 'due_date' || sortField === 'created_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
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
  }, [leads, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (leadId: string) => {
    navigate(`/leads/${leadId}`, { state: { from: 'all-leads' } });
  };


  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    ...leadStatuses.map(status => ({
      value: status.name,
      label: status.name
    }))
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Leads"
        subtitle="Track and manage your potential clients"
      >
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <Button 
              size="sm"
              onClick={() => setAddLeadDialogOpen(true)}
              className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              data-testid="add-lead-button"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </div>
        </PageHeaderSearch>
      </PageHeader>
      
      <div className="p-4 sm:p-6">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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
          <div className="w-full overflow-x-auto overflow-y-hidden" style={{ maxWidth: '100vw' }}>
            <div className="min-w-max">
              <Table style={{ minWidth: '800px' }}>
                <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-2">
                      Phone
                      {getSortIcon('phone')}
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
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('due_date')}
                  >
                    <div className="flex items-center gap-2">
                      Due Date
                      {getSortIcon('due_date')}
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Assignees</TableHead>
                  <TableHead className="whitespace-nowrap">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLeads.length > 0 ? (
                  filteredAndSortedLeads.map((lead) => (
                    <TableRow 
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(lead.id)}
                    >
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.email || '-'}</TableCell>
                      <TableCell>{lead.phone || '-'}</TableCell>
                        <TableCell>
                          <LeadStatusBadge
                            leadId={lead.id}
                            currentStatusId={lead.status_id}
                            currentStatus={lead.status}
                            onStatusChange={fetchLeads}
                            editable={true}
                            size="sm"
                            statuses={leadStatuses}
                          />
                         </TableCell>
                      <TableCell>
                        {lead.due_date ? formatDate(lead.due_date) : '-'}
                      </TableCell>
                      <TableCell>
                        {lead.assignees && lead.assignees.length > 0 ? (
                          <AssigneeAvatars 
                            assigneeIds={lead.assignees} 
                            maxVisible={3}
                            size="sm"
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {lead.notes ? (
                          <div 
                            className="truncate hover:whitespace-normal hover:overflow-visible hover:text-wrap cursor-help"
                            title={lead.notes}
                          >
                            {lead.notes}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter === "all" 
                        ? "No leads found. Add your first lead to get started!"
                        : `No leads found with status "${statusFilter}".`
                      }
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
      
      <AddLeadDialog 
        onLeadAdded={fetchLeads} 
        open={addLeadDialogOpen}
        onOpenChange={handleAddLeadDialogChange}
      />

      <OnboardingTutorial
        steps={leadsTutorialSteps}
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        initialStepIndex={currentTutorialStep}
      />
    </div>
  );
};

export default AllLeads;