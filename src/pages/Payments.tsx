import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { toast } from "@/hooks/use-toast";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, subDays, subMonths, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import { formatDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { PageLoadingSkeleton, TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { EditPaymentDialog } from "@/components/EditPaymentDialog";

interface Payment {
  id: string;
  amount: number;
  date_paid: string | null;
  status: string;
  description: string | null;
  type: string;
  project_id: string;
  created_at: string;
  projects: {
    id: string;
    name: string;
    base_price: number | null;
    lead_id: string;
    status_id?: string | null;
    project_type_id?: string | null;
    description?: string | null;
    updated_at?: string;
    created_at?: string;
    user_id?: string;
    leads: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface PaymentMetrics {
  totalPaid: number;
  extraServices: number;
  remainingBalance: number;
}

type SortField = 'date_paid' | 'amount' | 'project_name' | 'lead_name' | 'description' | 'status' | 'type';
type SortDirection = 'asc' | 'desc';
type DateFilterType = 'last7days' | 'last4weeks' | 'last3months' | 'last12months' | 'monthToDate' | 'quarterToDate' | 'yearToDate' | 'lastMonth' | 'allTime' | 'custom';

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('allTime');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date_paid");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      // First get payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Get unique project IDs
      const projectIds = Array.from(new Set(paymentsData?.map(p => p.project_id).filter(Boolean) || []));
      
      // Fetch projects with more detailed info
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, base_price, lead_id, status_id, project_type_id, description, updated_at, created_at, user_id')
        .in('id', projectIds);

      if (projectsError) throw projectsError;

      // Get unique lead IDs
      const leadIds = Array.from(new Set(projectsData?.map(p => p.lead_id).filter(Boolean) || []));
      
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, name')
        .in('id', leadIds);

      if (leadsError) throw leadsError;

      // Create maps for quick lookup
      const leadsMap = new Map(leadsData?.map(l => [l.id, l]) || []);
      const projectsMap = new Map(projectsData?.map(p => [p.id, {
        ...p,
        leads: leadsMap.get(p.lead_id) || null
      }]) || []);

      // Combine payments with project and lead data
      const paymentsWithProjects = paymentsData?.map(payment => ({
        ...payment,
        projects: projectsMap.get(payment.project_id) || null
      })) || [];

      setPayments(paymentsWithProjects);
    } catch (error: any) {
      toast({
        title: "Error fetching payments",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeForFilter = (filter: DateFilterType): { start: Date; end: Date } | null => {
    const now = new Date();
    
    switch (filter) {
      case 'last7days':
        return { start: subDays(now, 7), end: now };
      case 'last4weeks':
        return { start: subDays(now, 28), end: now };
      case 'last3months':
        return { start: subMonths(now, 3), end: now };
      case 'last12months':
        return { start: subMonths(now, 12), end: now };
      case 'monthToDate':
        return { start: startOfMonth(now), end: now };
      case 'quarterToDate':
        return { start: startOfQuarter(now), end: now };
      case 'yearToDate':
        return { start: startOfYear(now), end: now };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: startOfMonth(now) };
      case 'allTime':
      case 'custom':
        if (customDateRange?.from && customDateRange?.to) {
          return { start: customDateRange.from, end: customDateRange.to };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredAndSortedPayments = useMemo(() => {
    let filtered = payments;

    // Apply date filter
    if (selectedFilter !== 'allTime') {
      const dateRange = getDateRangeForFilter(selectedFilter);
      if (dateRange) {
        filtered = filtered.filter(payment => {
          const paymentDate = new Date(payment.date_paid || payment.created_at);
          return paymentDate >= dateRange.start && paymentDate <= dateRange.end;
        });
      }
    }

    // Apply label filter
    if (labelFilter.trim()) {
      filtered = filtered.filter(payment => {
        const label = payment.description || 'Payment';
        return label.toLowerCase().includes(labelFilter.toLowerCase());
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date_paid':
          aValue = new Date(a.date_paid || a.created_at).getTime();
          bValue = new Date(b.date_paid || b.created_at).getTime();
          break;
        case 'amount':
          aValue = Number(a.amount);
          bValue = Number(b.amount);
          break;
        case 'project_name':
          aValue = a.projects?.name?.toLowerCase() || '';
          bValue = b.projects?.name?.toLowerCase() || '';
          break;
        case 'lead_name':
          aValue = a.projects?.leads?.name?.toLowerCase() || '';
          bValue = b.projects?.leads?.name?.toLowerCase() || '';
          break;
        case 'description':
          aValue = (a.description || 'Payment').toLowerCase();
          bValue = (b.description || 'Payment').toLowerCase();
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case 'type':
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
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
  }, [payments, selectedFilter, customDateRange, labelFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const metrics = useMemo((): PaymentMetrics => {
    const totalPaid = filteredAndSortedPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const extraServices = filteredAndSortedPayments
      .filter(p => p.type === 'extra' && p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate remaining balance based on base prices and unpaid amounts
    const totalBaseAndExtras = filteredAndSortedPayments
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const remainingBalance = totalBaseAndExtras - totalPaid;

    return {
      totalPaid,
      extraServices,
      remainingBalance
    };
  }, [filteredAndSortedPayments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader
        title="Payments"
        subtitle="Track and manage all payments across projects"
      >
        <PageHeaderSearch>
          <GlobalSearch />
        </PageHeaderSearch>
      </PageHeader>

      <div className="p-4 sm:p-6">
        {loading ? (
          <TableLoadingSkeleton />
        ) : (
          <>

      {/* Date Filter */}
      <div className="mb-6 flex justify-end">
        <div className="flex items-center gap-4">
          <Select
            value={selectedFilter}
            onValueChange={(value) => {
              setSelectedFilter(value as DateFilterType);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 days</SelectItem>
              <SelectItem value="last4weeks">Last 4 weeks</SelectItem>
              <SelectItem value="last3months">Last 3 months</SelectItem>
              <SelectItem value="last12months">Last 12 months</SelectItem>
              <SelectItem value="monthToDate">Month to date</SelectItem>
              <SelectItem value="quarterToDate">Quarter to date</SelectItem>
              <SelectItem value="yearToDate">Year to date</SelectItem>
              <SelectItem value="lastMonth">Last month</SelectItem>
              <SelectItem value="allTime">All time</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          
          {selectedFilter === 'custom' && (
            <DateRangePicker
              dateRange={customDateRange}
              onDateRangeChange={(range) => {
                setCustomDateRange(range);
              }}
            />
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalPaid)}</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extra Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.extraServices)}</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.remainingBalance)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by label:</span>
                <Input
                  placeholder="Filter by label..."
                  value={labelFilter}
                  onChange={(e) => setLabelFilter(e.target.value)}
                  className="w-full sm:w-48 min-w-0"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto overflow-y-hidden" style={{ maxWidth: '100vw' }}>
            <div className="min-w-max">
              <Table style={{ minWidth: '900px' }}>
                <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('date_paid')}
                >
                  <div className="flex items-center gap-2">
                    Date
                    {getSortIcon('date_paid')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    Amount
                    {getSortIcon('amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('project_name')}
                >
                  <div className="flex items-center gap-2">
                    Project
                    {getSortIcon('project_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('lead_name')}
                >
                  <div className="flex items-center gap-2">
                    Lead
                    {getSortIcon('lead_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-2">
                    Label
                    {getSortIcon('description')}
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    Type
                    {getSortIcon('type')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPayments.length > 0 ? (
                filteredAndSortedPayments.map((payment, index) => (
                  <TableRow 
                    key={payment.id}
                    className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 0 ? "" : "bg-muted/30"}`}
                  >
                    <TableCell>
                      {formatDate(payment.date_paid || payment.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(payment.amount))}
                    </TableCell>
                    <TableCell>
                      {payment.projects ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto font-normal text-foreground hover:text-foreground hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingProject(payment.projects);
                            setShowProjectDialog(true);
                          }}
                        >
                          {payment.projects.name}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.projects?.leads ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto font-normal text-foreground hover:text-foreground hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${payment.projects?.leads?.id}`);
                          }}
                        >
                          {payment.projects.leads.name}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.description || 'Payment'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={payment.status === 'paid' ? 'default' : 'secondary'}
                        className={payment.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}
                      >
                        {payment.status === 'paid' ? 'Paid' : 'Due'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {payment.type === 'base_price' ? 'Base' : 
                         payment.type === 'extra' ? 'Extra' : 'Manual'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {labelFilter 
                      ? `No payments found with label containing "${labelFilter}".`
                      : "No payments found for selected period."
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

      {/* Project Details Dialog */}
      <ViewProjectDialog
        project={viewingProject}
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onProjectUpdated={fetchPayments}
        leadName={viewingProject?.leads?.name || ""}
      />
          </>
        )}
      </div>

      {/* Payment dialogs - temporarily removed due to interface mismatch */}
      {/*
      <AddPaymentDialog
        projectId=""
        onPaymentAdded={fetchPayments}
      />
      
      <EditPaymentDialog
        payment={editingPayment}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingPayment(null);
        }}
        onPaymentUpdated={fetchPayments}
      />
      */}
    </div>
  );
};

export default Payments;