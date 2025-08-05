import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ViewProjectDialog } from "@/components/ViewProjectDialog";
import { toast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, subDays, subMonths, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import { formatDate } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";

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

type DateFilterType = 'last7days' | 'last4weeks' | 'last3months' | 'last12months' | 'monthToDate' | 'quarterToDate' | 'yearToDate' | 'lastMonth' | 'allTime' | 'custom';

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('allTime');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
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

  const filteredPayments = useMemo(() => {
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

    return filtered;
  }, [payments, selectedFilter, customDateRange]);

  const metrics = useMemo((): PaymentMetrics => {
    const totalPaid = filteredPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const extraServices = filteredPayments
      .filter(p => p.type === 'extra' && p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate remaining balance based on base prices and unpaid amounts
    const totalBaseAndExtras = filteredPayments
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const remainingBalance = totalBaseAndExtras - totalPaid;

    return {
      totalPaid,
      extraServices,
      remainingBalance
    };
  }, [filteredPayments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<Payment>[] = [
    {
      key: 'date_paid',
      header: 'Date',
      sortable: true,
      filterable: false,
      render: (payment) => formatDate(payment.date_paid || payment.created_at)
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      filterable: false,
      render: (payment) => (
        <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
      )
    },
    {
      key: 'projects.name',
      header: 'Project',
      sortable: true,
      filterable: true,
      accessor: (payment) => payment.projects?.name,
      render: (payment) => (
        payment.projects ? (
          <Button
            variant="link"
            className="p-0 h-auto font-normal text-primary"
            onClick={(e) => {
              e.stopPropagation();
              if (payment.projects) {
                setViewingProject(payment.projects);
                setShowProjectDialog(true);
              }
            }}
          >
            {payment.projects.name}
          </Button>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      )
    },
    {
      key: 'projects.leads.name',
      header: 'Lead',
      sortable: true,
      filterable: true,
      accessor: (payment) => payment.projects?.leads?.name,
      render: (payment) => (
        payment.projects?.leads ? (
          <Button
            variant="link"
            className="p-0 h-auto font-normal text-primary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/leads/${payment.projects?.leads?.id}`);
            }}
          >
            {payment.projects.leads.name}
          </Button>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      )
    },
    {
      key: 'description',
      header: 'Label',
      sortable: true,
      filterable: false,
      render: (payment) => payment.description || 'Payment'
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: false,
      render: (payment) => (
        <Badge 
          variant={payment.status === 'paid' ? 'default' : 'secondary'}
          className={payment.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}
        >
          {payment.status === 'paid' ? 'Paid' : 'Due'}
        </Badge>
      )
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      filterable: true,
      render: (payment) => (
        <Badge variant="outline">
          {payment.type === 'base_price' ? 'Base' : 
           payment.type === 'extra' ? 'Extra' : 'Manual'}
        </Badge>
      )
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payments</h1>
            <p className="text-muted-foreground">Track and manage all payments across projects</p>
          </div>
          <div className="w-full max-w-lg min-w-[480px] ml-8">
            <GlobalSearch />
          </div>
        </div>
      </div>

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
      <Card>
        <CardContent className="p-6">
          <DataTable
            data={filteredPayments}
            columns={columns}
            itemsPerPage={20}
            emptyState={
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No payments found</h3>
                <p className="text-muted-foreground">No payments found for selected period.</p>
              </div>
            }
          />
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
    </div>
  );
};

export default Payments;