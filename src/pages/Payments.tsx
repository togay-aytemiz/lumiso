import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DateRangePicker } from "@/components/DateRangePicker";
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

type DateFilterType = 'last7days' | 'last4weeks' | 'last3months' | 'last12months' | 'monthToDate' | 'quarterToDate' | 'yearToDate' | 'allTime' | 'custom';

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('allTime');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
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
      
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, base_price, lead_id')
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
      case 'custom':
        if (customDateRange?.from && customDateRange?.to) {
          return { start: customDateRange.from, end: customDateRange.to };
        }
        return null;
      case 'allTime':
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

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'due':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
              setCurrentPage(1);
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
              <SelectItem value="allTime">All time</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          
          {selectedFilter === 'custom' && (
            <DateRangePicker
              dateRange={customDateRange}
              onDateRangeChange={(range) => {
                setCustomDateRange(range);
                setCurrentPage(1);
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
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalPaid)}</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extra Services</CardTitle>
            <div className="h-2 w-2 rounded-full bg-blue-600"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.extraServices)}</div>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.remainingBalance)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No payments found</h3>
              <p className="text-muted-foreground">No payments found for selected period.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((payment, index) => (
                    <TableRow 
                      key={payment.id} 
                      className={index % 2 === 0 ? "bg-muted/30" : ""}
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
                            className="p-0 h-auto font-normal text-primary"
                            onClick={() => navigate(`/projects`)}
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
                            className="p-0 h-auto font-normal text-primary"
                            onClick={() => navigate(`/leads/${payment.projects?.leads?.id}`)}
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
                        <Badge variant={getStatusBadgeVariant(payment.status)}>
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
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center py-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => handlePageChange(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;