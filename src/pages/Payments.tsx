import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { FileDown, Loader2 } from "lucide-react";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import { PAYMENT_COLORS } from "@/lib/paymentColors";
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
} from "@/components/data-table";
import { PAGE_SIZE, SEARCH_MIN_CHARS } from "@/pages/payments/constants";
import {
  DateFilterType,
  Payment,
  PaymentMetrics,
  PaymentTrendPoint,
  ProjectDetails,
  SortDirection,
  SortField,
  TrendGrouping,
} from "@/pages/payments/types";
import { usePaymentsData } from "@/pages/payments/hooks/usePaymentsData";
import { usePaymentsFilters } from "@/pages/payments/hooks/usePaymentsFilters";
import { usePaymentsTableColumns } from "@/pages/payments/hooks/usePaymentsTableColumns";
import { PaymentsDateControls } from "@/pages/payments/components/PaymentsDateControls";
import { PaymentsTrendChart } from "@/pages/payments/components/PaymentsTrendChart";
import { PaymentsMetricsSummary } from "@/pages/payments/components/PaymentsMetricsSummary";
import { PaymentsTableSection } from "@/pages/payments/components/PaymentsTableSection";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";

const Payments = () => {
  const { t } = useTranslation("pages");
const [page, setPage] = useState(1);
const pageSize = PAGE_SIZE;
  const [exporting, setExporting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('allTime');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [sortField, setSortField] = useState<SortField>("date_paid");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedProject, setSelectedProject] = useState<ProjectDetails | null>(null);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [trendGrouping, setTrendGrouping] = useState<TrendGrouping>("month");
  const sheetCloseTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const dateLocale = useMemo(() => getDateFnsLocale(), []);
  const handleDataError = useCallback((error: Error) => {
    toast({
      title: t("payments.errorFetching"),
      description: error.message,
      variant: "destructive",
    });
  }, [t]);
  const {
    state: filtersState,
    filtersConfig,
    searchValue,
    onSearchChange,
    activeFilterCount,
  } = usePaymentsFilters({
    onStateChange: () => {
      setPage(1);
    },
  });
  const compactCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    []
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
      }),
    []
  );

  const formatCurrency = useCallback(
    (amount: number) => currencyFormatter.format(amount),
    [currencyFormatter]
  );

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

  useEffect(() => {
    setPage(1);
  }, [selectedFilter, customDateRange]);

  useEffect(() => {
    return () => {
      if (sheetCloseTimeoutRef.current) {
        window.clearTimeout(sheetCloseTimeoutRef.current);
      }
    };
  }, []);

  const getDateRangeForFilter = useCallback((filter: DateFilterType): { start: Date; end: Date } | null => {
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
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfDay(startOfMonth(lastMonth)),
          end: endOfDay(endOfMonth(lastMonth)),
        };
      }
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
  }, [customDateRange]);

  const activeDateRange = useMemo(
    () => getDateRangeForFilter(selectedFilter),
    [getDateRangeForFilter, selectedFilter]
  );

  const {
    paginatedPayments,
    metricsPayments,
    totalCount,
    initialLoading,
    tableLoading,
    fetchPayments,
    fetchPaymentsData,
  } = usePaymentsData({
    page,
    pageSize,
    sortField,
    sortDirection,
    statusFilters: filtersState.status,
    typeFilters: filtersState.type,
    amountMinFilter: filtersState.amountMin,
    amountMaxFilter: filtersState.amountMax,
    searchTerm: filtersState.search,
    activeDateRange,
    onError: handleDataError,
  });

  // Throttle data refresh on window focus / visibility changes
  const refreshPayments = useCallback(async () => {
    setPage(1);
    await fetchPayments();
  }, [fetchPayments]);

  useThrottledRefetchOnFocus(refreshPayments, 30_000);

  useEffect(() => {
    const computedTotalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > computedTotalPages) {
      setPage(computedTotalPages);
    }
  }, [totalCount, page, pageSize]);

  // Project row open/close handlers (define before columns so columns can reference them)
  const handleProjectSheetOpenChange = useCallback((open: boolean) => {
    if (sheetCloseTimeoutRef.current) {
      window.clearTimeout(sheetCloseTimeoutRef.current);
      sheetCloseTimeoutRef.current = null;
    }
    setProjectSheetOpen(open);
    if (!open) {
      sheetCloseTimeoutRef.current = window.setTimeout(() => {
        setSelectedProject(null);
        sheetCloseTimeoutRef.current = null;
      }, 300);
    }
  }, []);

  const handleProjectOpen = useCallback(
    (payment: Payment) => {
      if (!payment.project_id || !payment.projects) {
        return;
      }
      if (isMobile) {
        navigate(`/projects/${payment.project_id}`);
        return;
      }
      setSelectedProject(payment.projects);
      handleProjectSheetOpenChange(true);
    },
    [handleProjectSheetOpenChange, isMobile, navigate]
  );

  const handleNavigateToLead = useCallback(
    (leadId: string) => {
      navigate(`/leads/${leadId}`);
    },
    [navigate]
  );

  // Columns are needed for export mapping; define before handleExport
  const tableColumns = usePaymentsTableColumns({
    onProjectSelect: handleProjectOpen,
    onNavigateToLead: handleNavigateToLead,
    formatAmount: formatCurrency,
  });

  const handleExport = useCallback(async () => {
    if (exporting) return;

    const totalRecords = totalCount || paginatedPayments.length;
    if (totalRecords === 0) {
      toast({
        title: t("payments.export.noDataTitle"),
        description: t("payments.export.noDataDescription"),
      });
      return;
    }

    try {
      setExporting(true);
      const range = { from: 0, to: totalRecords - 1 };
      const { payments: exportPayments } = await fetchPaymentsData({
        range,
        includeMetrics: false,
        includeCount: false,
      });

      if (!exportPayments.length) {
        toast({
          title: t("payments.export.noDataTitle"),
          description: t("payments.export.noDataDescription"),
        });
        return;
      }

      const visibleOrderedColumns = [...tableColumns];

      const valueForColumn = (payment: Payment, columnId: string) => {
        switch (columnId) {
          case "date_paid":
            return formatDate(payment.date_paid || payment.created_at);
          case "project":
            return payment.projects?.name ?? "";
          case "lead":
            return payment.projects?.leads?.name ?? "";
          case "amount":
            return payment.entry_kind === "scheduled"
              ? Number(payment.scheduled_remaining_amount ?? payment.amount)
              : Number(payment.amount);
          case "description":
            return payment.description?.trim() ?? "";
          case "status": {
            const isPaid = (payment.status || "").toLowerCase() === "paid";
            return isPaid ? t("payments.status.paid") : t("payments.status.due");
          }
          case "type":
            if ((payment.entry_kind ?? "recorded") === "scheduled") {
              return t("payments.type.scheduled");
            }
            return payment.type === "deposit_payment"
              ? t("payments.type.deposit")
              : payment.type === "balance_due"
                ? t("payments.type.balance")
                : t("payments.type.manual");
          default: {
            const fallbackValue = (payment as Record<string, unknown>)[columnId];
            return fallbackValue ?? "";
          }
        }
      };

      const columnLabels = visibleOrderedColumns.map((c) =>
        typeof c.label === "string" ? c.label : String(c.label)
      );

      const rows = exportPayments.map((payment) => {
        const row: Record<string, string | number | boolean | null> = {};
        visibleOrderedColumns.forEach((col, index) => {
          row[columnLabels[index]] = valueForColumn(payment, col.id) as
            | string
            | number
            | boolean
            | null;
        });
        return row;
      });

      const worksheet = XLSXUtils.json_to_sheet(rows);
      const workbook = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(workbook, worksheet, "Payments");

      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      writeFileXLSX(workbook, `payments-${timestamp}.xlsx`);

      toast({
        title: t("payments.export.successTitle"),
        description: t("payments.export.successDescription"),
      });
    } catch (error: unknown) {
      toast({
        title: t("payments.export.errorTitle"),
        description:
          error instanceof Error
            ? error.message
            : t("payments.export.errorDescription"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    fetchPaymentsData,
    paginatedPayments.length,
    tableColumns,
    t,
    totalCount,
  ]);

  const selectedDateRange = useMemo(() => {
    if (activeDateRange) {
      return activeDateRange;
    }

    const sortedDates = metricsPayments
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
  }, [activeDateRange, metricsPayments, selectedFilter]);

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
      refund: {
        label: t("payments.chart.legend.refund"),
        color: PAYMENT_COLORS.refund.hex,
      },
    }),
    [t]
  );

  const chartLegendLabels = useMemo(
    () => ({
      paid: t("payments.chart.legend.paid"),
      due: t("payments.chart.legend.due"),
      refund: t("payments.chart.legend.refund"),
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
      refund: number;
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
        buckets.set(key, { paid: 0, due: 0, refund: 0, labelStart, labelEnd });
      }
    });

    metricsPayments.forEach((payment) => {
      const entryKind = payment.entry_kind ?? "recorded";
      const isScheduled = entryKind === "scheduled";
      const amount = Number(payment.amount) || 0;
      const paymentDate = isScheduled
        ? new Date(payment.updated_at ?? payment.created_at)
        : new Date(payment.date_paid || payment.created_at);
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

      if (isScheduled) {
        const scheduledValue =
          Number(
            payment.scheduled_remaining_amount ??
              payment.scheduled_initial_amount ??
              payment.amount ??
              0
          ) || 0;
        bucket.due += scheduledValue;
        return;
      }

      const isPaid = (payment.status || "").toLowerCase() === "paid";
      const isRefund = amount < 0;

      if (isRefund) {
        bucket.refund += Math.abs(amount);
      }

      if (isPaid) {
        bucket.paid += amount;
      } else if (!isRefund) {
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
        refund: bucket.refund,
      }));
  }, [metricsPayments, selectedDateRange, trendGrouping, dateLocale]);

  const metrics = useMemo((): PaymentMetrics => {
    const recordedEntries = metricsPayments.filter(
      (payment) => (payment.entry_kind ?? "recorded") !== "scheduled"
    );
    const scheduledEntries = metricsPayments.filter(
      (payment) => (payment.entry_kind ?? "recorded") === "scheduled"
    );

    const totalPaid = recordedEntries
      .filter((payment) => (payment.status || "").toLowerCase() === "paid" && Number(payment.amount) > 0)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const totalRefunded = recordedEntries
      .filter((payment) => Number(payment.amount) < 0)
      .reduce((sum, payment) => sum + Math.abs(Number(payment.amount)), 0);

    const manualDueTotal = recordedEntries
      .filter((payment) => (payment.status || "").toLowerCase() !== "paid")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const scheduledInitialTotal = scheduledEntries.reduce(
      (sum, payment) => sum + Number(payment.scheduled_initial_amount ?? payment.amount ?? 0),
      0
    );

    const scheduledRemainingTotal = scheduledEntries.reduce(
      (sum, payment) => sum + Number(payment.scheduled_remaining_amount ?? payment.amount ?? 0),
      0
    );

    const totalInvoiced = scheduledInitialTotal + manualDueTotal;
    const remainingBalance = scheduledRemainingTotal + manualDueTotal;
    const netCollected = Math.max(totalPaid - totalRefunded, 0);
    const collectionRate = totalInvoiced > 0 ? netCollected / totalInvoiced : 0;

    return {
      totalPaid,
      totalInvoiced,
      totalRefunded,
      remainingBalance,
      collectionRate,
    };
  }, [metricsPayments]);

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const hasTrendData = paymentsTrend.some(
    (point) => Math.abs(point.paid) > 0 || Math.abs(point.due) > 0 || Math.abs(point.refund) > 0
  );

  const hasSearchTerm = filtersState.search.trim().length >= SEARCH_MIN_CHARS;
  const hasAnyResults = totalCount > 0 || paginatedPayments.length > 0;

  const hasMorePayments = paginatedPayments.length < totalCount;
  const isLoadingMorePayments = tableLoading && page > 1;

  const handleLoadMorePayments = useCallback(() => {
    if (tableLoading || !hasMorePayments) return;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
    if (totalPages && page >= totalPages) return;
    setPage((prev) => prev + 1);
  }, [hasMorePayments, page, pageSize, tableLoading, totalCount]);

  const exportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={!hasAnyResults || tableLoading || exporting}
        className="hidden sm:inline-flex"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t("payments.export.button")}</span>
      </Button>
    ),
    [exporting, handleExport, hasAnyResults, tableLoading, t]
  );

  // Use AdvancedDataTable's built-in header search instead of toolbar

  const emptyStateMessage =
    hasSearchTerm || activeFilterCount > 0
      ? t("payments.emptyState.noPaymentsWithFilters")
      : t("payments.emptyState.noPaymentsForPeriod");

  // Build filter summary chips similar to leads/projects
  const filterSummaryChips = useMemo(() => {
    const chips: { id: string; label: React.ReactNode }[] = [];

    const renderLabel = (
      heading: string,
      value: string
    ) => (
      <span>
        <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
          {heading}:
        </span>
        {value}
      </span>
    );

    if (filtersState.status.length) {
      const statusLabel = filtersState.status
        .map((value) =>
          value === "paid"
            ? t("payments.status.paid")
            : value === "due"
              ? t("payments.status.due")
              : t("payments.refund.badge", { defaultValue: "Refund" })
        )
        .join(", ");

      chips.push({
        id: "status",
        label: renderLabel(t("payments.filters.statusHeading"), statusLabel),
      });
    }

    if (filtersState.type.length) {
      const typeLabel = filtersState.type
        .map((value) => {
          switch (value) {
            case "deposit_payment":
              return t("payments.type.deposit");
            case "balance_due":
              return t("payments.type.balance");
            default:
              return t("payments.type.manual");
          }
        })
        .join(", ");

      chips.push({
        id: "type",
        label: renderLabel(t("payments.filters.typeHeading"), typeLabel),
      });
    }

    if (filtersState.amountMin != null || filtersState.amountMax != null) {
      const amountParts: string[] = [];
      if (filtersState.amountMin != null) {
        amountParts.push(
          `${t("payments.filters.amountMinPlaceholder")}: ${formatCurrency(filtersState.amountMin)}`
        );
      }
      if (filtersState.amountMax != null) {
        amountParts.push(
          `${t("payments.filters.amountMaxPlaceholder")}: ${formatCurrency(filtersState.amountMax)}`
        );
      }

      chips.push({
        id: "amount",
        label: renderLabel(
          t("payments.filters.amountHeading"),
          amountParts.join(" • ")
        ),
      });
    }

    return chips;
  }, [
    filtersState.amountMax,
    filtersState.amountMin,
    filtersState.status,
    filtersState.type,
    formatCurrency,
    t,
  ]);

  // (moved up above columns)

  const handleViewFullDetails = useCallback(() => {
    if (!selectedProject) return;
    navigate(`/projects/${selectedProject.id}`);
    handleProjectSheetOpenChange(false);
  }, [handleProjectSheetOpenChange, navigate, selectedProject]);

  // tableColumns defined above (before handleExport)

  const sortStateForTable = useMemo<AdvancedDataTableSortState>(
    () => ({ columnId: sortField, direction: sortDirection }),
    [sortField, sortDirection]
  );

  const handleTableSortChange = useCallback(
    (next: AdvancedDataTableSortState) => {
      if (!next.columnId) return;
      setSortField(next.columnId as SortField);
      setSortDirection(next.direction as SortDirection);
      setPage(1);
    },
    []
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
        {initialLoading ? (
          <TableLoadingSkeleton />
        ) : (
          <>

      {/* Date Filter */}
      <PaymentsDateControls
        rangeLabel={rangeLabel}
        rangeNotice={rangeNotice}
        selectedFilter={selectedFilter}
        onSelectedFilterChange={setSelectedFilter}
        customDateRange={customDateRange}
        onCustomDateRangeChange={setCustomDateRange}
      />

      {/* Metrics Cards */}
      <div className="grid gap-6 mb-8 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <PaymentsTrendChart
          hasTrendData={hasTrendData}
          chartConfig={chartConfig}
          chartLegendLabels={chartLegendLabels}
          paymentsTrend={paymentsTrend}
          trendGrouping={trendGrouping}
          onTrendGroupingChange={setTrendGrouping}
          rangeLabel={rangeLabel}
          compactCurrencyFormatter={compactCurrencyFormatter}
          formatCurrency={formatCurrency}
        />
        <PaymentsMetricsSummary
          metrics={metrics}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
        />
      </div>

      {/* Payments Table */}
      <PaymentsTableSection
        title={t("payments.tableTitle")}
        data={paginatedPayments}
        columns={tableColumns}
        filters={filtersConfig}
        toolbar={undefined}
        summary={{ text: undefined, chips: filterSummaryChips }}
        actions={exportActions}
        sortState={sortStateForTable}
        onSortChange={handleTableSortChange}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={t("payments.searchPlaceholder")}
        searchLoading={tableLoading}
        searchMinChars={SEARCH_MIN_CHARS}
        emptyState={<div className="text-muted-foreground">{emptyStateMessage}</div>}
        onRowClick={handleProjectOpen}
        isLoading={tableLoading && page === 1 && paginatedPayments.length === 0}
        onLoadMore={hasMorePayments ? handleLoadMorePayments : undefined}
        hasMore={hasMorePayments}
        isLoadingMore={isLoadingMorePayments}
      />

      {/* Project Details Dialog */}
      <ProjectSheetView
        project={selectedProject}
        open={projectSheetOpen}
        onOpenChange={handleProjectSheetOpenChange}
        onProjectUpdated={refreshPayments}
        leadName={selectedProject?.leads?.name ?? ""}
        mode="sheet"
        onViewFullDetails={handleViewFullDetails}
      />
          </>
        )}
      </div>

    </div>
  );
};

export default Payments;
