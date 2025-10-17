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
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfDay,
  endOfDay,
  isSameDay,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn, formatDate, getDateFnsLocale } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { EditPaymentDialog } from "@/components/EditPaymentDialog";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PAYMENT_COLORS } from "@/lib/paymentColors";

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
  totalInvoiced: number;
  remainingBalance: number;
  collectionRate: number;
}

interface PaymentTrendPoint {
  period: string;
  paid: number;
  due: number;
}

type TrendGrouping = "day" | "week" | "month";

type SortField = 'date_paid' | 'amount' | 'project_name' | 'lead_name' | 'description' | 'status' | 'type';
type SortDirection = 'asc' | 'desc';
type DateFilterType = 'last7days' | 'last4weeks' | 'last3months' | 'last12months' | 'monthToDate' | 'quarterToDate' | 'yearToDate' | 'lastMonth' | 'allTime' | 'custom';

const Payments = () => {
  const { t } = useTranslation("pages");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('allTime');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date_paid");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [trendGrouping, setTrendGrouping] = useState<TrendGrouping>("month");
  const navigate = useNavigate();
  const dateLocale = useMemo(() => getDateFnsLocale(), []);
  const compactCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    []
  );

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("paymentsTrendGrouping") as TrendGrouping | null;
    if (stored === "day" || stored === "week" || stored === "month") {
      setTrendGrouping(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("paymentsTrendGrouping", trendGrouping);
  }, [trendGrouping]);

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
        title: t("payments.errorFetching"),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeForFilter = (filter: DateFilterType): { start: Date; end: Date } | null => {
    const now = new Date();
    const endToday = endOfDay(now);
    
    switch (filter) {
      case 'last7days':
        return { start: startOfDay(subDays(endToday, 6)), end: endToday };
      case 'last4weeks':
        return { start: startOfDay(subDays(endToday, 27)), end: endToday };
      case 'last3months':
        return { start: startOfDay(subMonths(endToday, 3)), end: endToday };
      case 'last12months':
        return { start: startOfDay(subMonths(endToday, 12)), end: endToday };
      case 'monthToDate':
        return { start: startOfDay(startOfMonth(now)), end: endToday };
      case 'quarterToDate':
        return { start: startOfDay(startOfQuarter(now)), end: endToday };
      case 'yearToDate':
        return { start: startOfDay(startOfYear(now)), end: endToday };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfDay(startOfMonth(lastMonth)),
          end: endOfDay(endOfMonth(lastMonth)),
        };
      case 'allTime':
      case 'custom':
        if (customDateRange?.from) {
          return {
            start: startOfDay(customDateRange.from),
            end: endOfDay(customDateRange.to ?? customDateRange.from),
          };
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
    const labelTerm = labelFilter.trim().toLowerCase();
    const clientTerm = clientFilter.trim().toLowerCase();
    const projectTerm = projectFilter.trim().toLowerCase();

    if (labelTerm) {
      filtered = filtered.filter(payment => {
        const label = payment.description || t("payments.defaultLabel");
        return label.toLowerCase().includes(labelTerm);
      });
    }

    if (clientTerm) {
      filtered = filtered.filter(payment => {
        const leadName = payment.projects?.leads?.name || "";
        return leadName.toLowerCase().includes(clientTerm);
      });
    }

    if (projectTerm) {
      filtered = filtered.filter(payment => {
        const projectName = payment.projects?.name || "";
        return projectName.toLowerCase().includes(projectTerm);
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
  }, [
    payments,
    selectedFilter,
    customDateRange,
    labelFilter,
    clientFilter,
    projectFilter,
    sortField,
    sortDirection,
    t,
  ]);

  const selectedDateRange = useMemo(() => {
    const range = getDateRangeForFilter(selectedFilter);
    if (range) {
      return range;
    }

    const paymentsForRange =
      selectedFilter === "allTime" ? payments : filteredAndSortedPayments;

    const sortedDates = paymentsForRange
      .map((payment) => new Date(payment.date_paid || payment.created_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (!sortedDates.length) {
      return null;
    }

    const earliest = startOfDay(sortedDates[0]);
    const latest =
      selectedFilter === "allTime"
        ? endOfDay(new Date())
        : endOfDay(sortedDates[sortedDates.length - 1]);

    return {
      start: earliest,
      end: latest,
    };
  }, [selectedFilter, filteredAndSortedPayments, customDateRange, payments]);

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

  const isCustomRangeMissing = selectedFilter === 'custom' && !customDateRange?.from;

  const rangeLabel = useMemo(() => {
    if (!selectedDateRange) {
      return "";
    }

    if (isSameDay(selectedDateRange.start, selectedDateRange.end)) {
      return format(selectedDateRange.start, "PP", { locale: dateLocale });
    }

    return `${format(selectedDateRange.start, "PP", { locale: dateLocale })} – ${format(selectedDateRange.end, "PP", { locale: dateLocale })}`;
  }, [selectedDateRange, dateLocale]);

  const rangeNotice = useMemo(() => {
    if (isCustomRangeMissing) {
      return t("payments.range.noSelection");
    }

    if (!rangeLabel) {
      return t("payments.range.noData");
    }

    return "";
  }, [isCustomRangeMissing, rangeLabel, t]);

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      paid: {
        label: t("payments.chart.legend.paid"),
        color: PAYMENT_COLORS.paid.hex,
      },
      due: {
        label: t("payments.chart.legend.due"),
        color: PAYMENT_COLORS.due.hex,
      },
    }),
    [t]
  );

  const chartLegendLabels = useMemo(
    () => ({
      paid: t("payments.chart.legend.paid"),
      due: t("payments.chart.legend.due"),
    }),
    [t]
  );

  const paymentsTrend = useMemo<PaymentTrendPoint[]>(() => {
    if (!selectedDateRange) {
      return [];
    }

    const { start, end } = selectedDateRange;

    if (start > end) {
      return [];
    }

    const interval =
      trendGrouping === "day"
        ? eachDayOfInterval({ start, end })
        : trendGrouping === "week"
        ? eachWeekOfInterval({ start, end }, { locale: dateLocale })
        : eachMonthOfInterval({ start, end });

    if (!interval.length) {
      return [];
    }

    type Bucket = {
      paid: number;
      due: number;
      labelStart: Date;
      labelEnd: Date;
    };

    const getBucketDescriptor = (date: Date) => {
      switch (trendGrouping) {
        case "day": {
          const labelStart = startOfDay(date);
          const labelEnd = endOfDay(date);
          return {
            key: format(labelStart, "yyyy-MM-dd"),
            labelStart,
            labelEnd,
          };
        }
        case "week": {
          const weekStart = startOfWeek(date, { locale: dateLocale });
          const weekEnd = endOfWeek(weekStart, { locale: dateLocale });
          return {
            key: format(weekStart, "yyyy-MM-dd"),
            labelStart: weekStart,
            labelEnd: weekEnd,
          };
        }
        default: {
          const monthStart = startOfMonth(date);
          const monthEnd = endOfMonth(monthStart);
          return {
            key: format(monthStart, "yyyy-MM"),
            labelStart: monthStart,
            labelEnd: monthEnd,
          };
        }
      }
    };

    const buckets = new Map<string, Bucket>();

    interval.forEach((date) => {
      const { key, labelStart, labelEnd } = getBucketDescriptor(date);
      if (!buckets.has(key)) {
        buckets.set(key, { paid: 0, due: 0, labelStart, labelEnd });
      }
    });

    filteredAndSortedPayments.forEach((payment) => {
      const paymentDate = new Date(payment.date_paid || payment.created_at);
      if (Number.isNaN(paymentDate.getTime())) {
        return;
      }

      if (paymentDate < start || paymentDate > end) {
        return;
      }

      const { key } = getBucketDescriptor(paymentDate);
      const bucket = buckets.get(key);
      if (!bucket) {
        return;
      }

      const amount = Number(payment.amount) || 0;
      const isPaid = (payment.status || "").toLowerCase() === "paid";

      if (isPaid) {
        bucket.paid += amount;
      } else {
        bucket.due += amount;
      }
    });

    const clampToRange = (date: Date) => {
      if (date < start) return start;
      if (date > end) return end;
      return date;
    };

    const formatLabel = (bucket: Bucket) => {
      const labelStart = clampToRange(bucket.labelStart);
      const labelEnd = clampToRange(bucket.labelEnd);

      if (trendGrouping === "day") {
        return format(labelStart, "dd MMM", { locale: dateLocale });
      }

      if (trendGrouping === "week") {
        const startLabel = format(labelStart, "dd MMM", { locale: dateLocale });
        const endLabel = format(labelEnd, "dd MMM", { locale: dateLocale });
        return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
      }

      return format(labelStart, "LLL yy", { locale: dateLocale });
    };

    return Array.from(buckets.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, bucket]) => ({
        period: formatLabel(bucket),
        paid: bucket.paid,
        due: bucket.due,
      }));
  }, [filteredAndSortedPayments, selectedDateRange, trendGrouping, dateLocale]);

  const metrics = useMemo((): PaymentMetrics => {
    const totalInvoiced = filteredAndSortedPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const totalPaid = filteredAndSortedPayments
      .filter((p) => (p.status || "").toLowerCase() === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const remainingBalance = filteredAndSortedPayments
      .filter((p) => (p.status || "").toLowerCase() !== "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const collectionRate =
      totalInvoiced > 0 ? totalPaid / totalInvoiced : 0;

    return {
      totalPaid,
      totalInvoiced,
      remainingBalance,
      collectionRate,
    };
  }, [filteredAndSortedPayments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const hasTrendData = paymentsTrend.some(
    (point) => Math.abs(point.paid) > 0 || Math.abs(point.due) > 0
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader
        title={t("payments.title")}
        subtitle={t("payments.subtitle")}
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {rangeLabel ? (
          <div className="inline-flex flex-col rounded-md border border-border/60 bg-muted/40 px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("payments.range.label")}
            </span>
            <span className="text-lg font-semibold text-foreground">
              {rangeLabel}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{rangeNotice}</span>
        )}
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Select
            value={selectedFilter}
            onValueChange={(value) => {
              setSelectedFilter(value as DateFilterType);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("payments.selectPeriod")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">{t("payments.dateFilters.last7days")}</SelectItem>
              <SelectItem value="last4weeks">{t("payments.dateFilters.last4weeks")}</SelectItem>
              <SelectItem value="last3months">{t("payments.dateFilters.last3months")}</SelectItem>
              <SelectItem value="last12months">{t("payments.dateFilters.last12months")}</SelectItem>
              <SelectItem value="monthToDate">{t("payments.dateFilters.monthToDate")}</SelectItem>
              <SelectItem value="quarterToDate">{t("payments.dateFilters.quarterToDate")}</SelectItem>
              <SelectItem value="yearToDate">{t("payments.dateFilters.yearToDate")}</SelectItem>
              <SelectItem value="lastMonth">{t("payments.dateFilters.lastMonth")}</SelectItem>
              <SelectItem value="allTime">{t("payments.dateFilters.allTime")}</SelectItem>
              <SelectItem value="custom">{t("payments.dateFilters.customRange")}</SelectItem>
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
      <div className="grid gap-6 mb-8 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <Card className="border border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-medium">
                {t("payments.chart.title")}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("payments.chart.groupingLabel")}
                </span>
                <ToggleGroup
                  type="single"
                  value={trendGrouping}
                  onValueChange={(value) => value && setTrendGrouping(value as TrendGrouping)}
                  className="rounded-md border"
                  size="sm"
                >
                  <ToggleGroupItem value="day" className="text-xs px-3">
                    {t("payments.chart.grouping.day")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="week" className="text-xs px-3">
                    {t("payments.chart.grouping.week")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="month" className="text-xs px-3">
                    {t("payments.chart.grouping.month")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasTrendData ? (
              <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                <LineChart data={paymentsTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-6">
                            <span className="text-muted-foreground">
                              {typeof name === "string"
                                ? chartLegendLabels[
                                    name.toLowerCase() as keyof typeof chartLegendLabels
                                  ] ?? name
                                : name}
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatCurrency(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    key={`paid-${trendGrouping}-${rangeLabel}`}
                    type="monotone"
                    dataKey="paid"
                    stroke={chartConfig.paid.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={paymentsTrend.length > 1}
                    animationDuration={600}
                  />
                  <Line
                    key={`due-${trendGrouping}-${rangeLabel}`}
                    type="monotone"
                    dataKey="due"
                    stroke={chartConfig.due.color}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                    activeDot={{ r: 5 }}
                    isAnimationActive={paymentsTrend.length > 1}
                    animationDuration={600}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/10 text-sm text-muted-foreground">
                {t("payments.chart.empty")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">{t("payments.metrics.overviewTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{t("payments.metrics.totalInvoiced")}</span>
              <div className="text-2xl font-semibold">{formatCurrency(metrics.totalInvoiced)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{t("payments.metrics.totalPaid")}</span>
              <div className={cn("text-xl font-semibold", PAYMENT_COLORS.paid.textClass)}>
                {formatCurrency(metrics.totalPaid)}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{t("payments.metrics.remainingBalance")}</span>
              <div className={cn("text-xl font-semibold", PAYMENT_COLORS.due.textClass)}>
                {formatCurrency(metrics.remainingBalance)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t("payments.metrics.collectionRate")}</span>
                <span className="font-medium text-foreground">{formatPercent(metrics.collectionRate)}</span>
              </div>
              <Progress className="h-2" value={metrics.collectionRate * 100} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base font-medium">
                {t("payments.tableTitle")}
              </CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="grid w-full gap-4 sm:grid-cols-1 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{t("payments.filterByClient")}</span>
                  <Input
                    placeholder={t("payments.filterByClientPlaceholder")}
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{t("payments.filterByProject")}</span>
                  <Input
                    placeholder={t("payments.filterByProjectPlaceholder")}
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="w-full min-w-0"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{t("payments.filterByLabel")}</span>
                  <Input
                    placeholder={t("payments.filterByLabelPlaceholder")}
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    className="w-full min-w-0"
                  />
                </div>
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
                    {t("payments.table.date")}
                    {getSortIcon('date_paid')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('lead_name')}
                >
                  <div className="flex items-center gap-2">
                    {t("payments.table.lead")}
                    {getSortIcon('lead_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('project_name')}
                >
                  <div className="flex items-center gap-2">
                    {t("payments.table.project")}
                    {getSortIcon('project_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    {t("payments.table.amount")}
                    {getSortIcon('amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-2">
                    {t("payments.table.label")}
                    {getSortIcon('description')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    {t("payments.table.status")}
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    {t("payments.table.type")}
                    {getSortIcon('type')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPayments.length > 0 ? (
                filteredAndSortedPayments.map((payment, index) => {
                  const isPaid = (payment.status || "").toLowerCase() === "paid";

                  return (
                    <TableRow 
                      key={payment.id}
                      className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 0 ? "" : "bg-muted/30"}`}
                    >
                    <TableCell>
                      {formatDate(payment.date_paid || payment.created_at)}
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
                    <TableCell className="font-medium">
                      {formatCurrency(Number(payment.amount))}
                    </TableCell>
                    <TableCell>
                      {payment.description || t("payments.defaultLabel")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0.5 text-xs font-semibold",
                          isPaid ? PAYMENT_COLORS.paid.badgeClass : PAYMENT_COLORS.due.badgeClass
                        )}
                      >
                        {isPaid ? t("payments.status.paid") : t("payments.status.due")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {payment.type === 'base_price' ? t("payments.type.base") : 
                         payment.type === 'extra' ? t("payments.type.extra") : t("payments.type.manual")}
                      </Badge>
                    </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {labelFilter 
                      ? t("payments.emptyState.noPaymentsWithLabel", { labelFilter })
                      : t("payments.emptyState.noPaymentsForPeriod")
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
