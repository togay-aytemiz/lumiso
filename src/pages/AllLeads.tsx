import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AddLeadDialog from "@/components/AddLeadDialog";
import { useNavigate } from "react-router-dom";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { formatDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch, PageHeaderActions } from "@/components/ui/page-header";

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
  const navigate = useNavigate();

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
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader
        title="Leads"
        subtitle="Track and manage your potential clients"
      >
        <PageHeaderSearch>
          <GlobalSearch />
        </PageHeaderSearch>
        <PageHeaderActions>
          <Button 
            size="sm"
            onClick={() => setAddLeadDialogOpen(true)}
            className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 sm:px-4 px-3"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </Button>
        </PageHeaderActions>
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
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
        onOpenChange={setAddLeadDialogOpen}
      />
    </div>
  );
};

export default AllLeads;