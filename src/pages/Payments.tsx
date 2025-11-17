import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FileDown, Loader2, Check } from "lucide-react";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import { PAYMENT_COLORS } from "@/lib/paymentColors";
import { computePaymentSummaryMetrics } from "@/lib/payments/metrics";
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
  type AdvancedTableColumn,
} from "@/components/data-table";
import { PAGE_SIZE, SEARCH_MIN_CHARS } from "@/pages/payments/constants";
import {
  DateFilterType,
  Payment,
  PaymentMetrics,
  PaymentTrendPoint,
  ProjectDetails,
  PaymentView,
  ScheduledSortField,
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
import { SegmentedControl } from "@/components/ui/segmented-control";

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
  const [paymentsView, setPaymentsView] = useState<PaymentView>("recorded");
  const [scheduledAmountMin, setScheduledAmountMin] = useState<number | null>(null);
  const [scheduledAmountMax, setScheduledAmountMax] = useState<number | null>(null);
  const [scheduledAmountMinDraft, setScheduledAmountMinDraft] = useState<string>("");
  const [scheduledAmountMaxDraft, setScheduledAmountMaxDraft] = useState<string>("");
  const [scheduledSortField, setScheduledSortField] =
    useState<ScheduledSortField>("updated_at");
  const [scheduledSortDirection, setScheduledSortDirection] = useState<SortDirection>("desc");
  const handlePaymentsViewChange = useCallback((value: string) => {
    setPaymentsView(value as PaymentView);
  }, []);
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
    scheduledPayments,
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
    scheduledAmountMinFilter: scheduledAmountMin,
    scheduledAmountMaxFilter: scheduledAmountMax,
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

  useEffect(() => {
    setScheduledAmountMinDraft(
      scheduledAmountMin != null ? String(scheduledAmountMin) : ""
    );
  }, [scheduledAmountMin]);

  useEffect(() => {
    setScheduledAmountMaxDraft(
      scheduledAmountMax != null ? String(scheduledAmountMax) : ""
    );
  }, [scheduledAmountMax]);

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

  const parseScheduledAmountInput = useCallback((value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  // Columns are needed for export mapping; define before handleExport
  const tableColumns = usePaymentsTableColumns({
    onProjectSelect: handleProjectOpen,
    onNavigateToLead: handleNavigateToLead,
    formatAmount: formatCurrency,
  });

  const waitingColumns = useMemo<AdvancedTableColumn<Payment>[]>(
    () => [
      {
        id: "schedule_updated",
        label: t("payments.table.waiting.updated"),
        sortable: true,
        sortId: "updated_at",
        minWidth: "140px",
        render: (row) => formatDate(row.updated_at ?? row.created_at),
      },
      {
        id: "waiting_lead",
        label: t("payments.table.lead"),
        sortable: true,
        sortId: "lead_name",
        minWidth: "180px",
        render: (row) =>
          row.projects?.leads ? (
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.stopPropagation();
                if (row.projects?.leads?.id) {
                  handleNavigateToLead(row.projects.leads.id);
                }
              }}
            >
              {row.projects.leads.name}
            </Button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "waiting_project",
        label: t("payments.table.project"),
        sortable: true,
        sortId: "project_name",
        minWidth: "200px",
        render: (row) =>
          row.projects ? (
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleProjectOpen(row);
              }}
            >
              {row.projects.name}
            </Button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "waiting_remaining",
        label: t("payments.table.waiting.remaining"),
        sortable: true,
        sortId: "scheduled_remaining_amount",
        align: "right",
        minWidth: "140px",
        render: (row) => {
          const remaining = Math.max(
            Number(row.scheduled_remaining_amount ?? row.amount ?? 0),
            0
          );
          return <span className="tabular-nums">{formatCurrency(remaining)}</span>;
        },
      },
      {
        id: "waiting_collected",
        label: t("payments.table.waiting.collected"),
        sortable: true,
        sortId: "collected_amount",
        align: "right",
        minWidth: "140px",
        render: (row) => {
          const initial = Math.max(Number(row.scheduled_initial_amount ?? row.amount ?? 0), 0);
          const remaining = Math.max(Number(row.scheduled_remaining_amount ?? 0), 0);
          const collected = Math.max(initial - remaining, 0);
          return (
            <span className="tabular-nums text-muted-foreground">{formatCurrency(collected)}</span>
          );
        },
      },
    ],
    [formatCurrency, handleNavigateToLead, handleProjectOpen, t]
  );

  const handleScheduledAmountMinDraftChange = useCallback((value: string) => {
    setScheduledAmountMinDraft(value);
  }, []);

  const handleScheduledAmountMaxDraftChange = useCallback((value: string) => {
    setScheduledAmountMaxDraft(value);
  }, []);

  const scheduledAmountDirty = useMemo(() => {
    const parsedMin = parseScheduledAmountInput(scheduledAmountMinDraft);
    const parsedMax = parseScheduledAmountInput(scheduledAmountMaxDraft);
    return parsedMin !== scheduledAmountMin || parsedMax !== scheduledAmountMax;
  }, [
    parseScheduledAmountInput,
    scheduledAmountMax,
    scheduledAmountMaxDraft,
    scheduledAmountMin,
    scheduledAmountMinDraft,
  ]);

  const handleScheduledFiltersApply = useCallback(() => {
    const parsedMin = parseScheduledAmountInput(scheduledAmountMinDraft);
    const parsedMax = parseScheduledAmountInput(scheduledAmountMaxDraft);
    setScheduledAmountMin(parsedMin);
    setScheduledAmountMax(parsedMax);
  }, [parseScheduledAmountInput, scheduledAmountMaxDraft, scheduledAmountMinDraft]);

  const handleScheduledFiltersReset = useCallback(() => {
    setScheduledAmountMin(null);
    setScheduledAmountMax(null);
    setScheduledAmountMinDraft("");
    setScheduledAmountMaxDraft("");
  }, []);

  const scheduledActiveFilterCount = useMemo(
    () => [scheduledAmountMin != null, scheduledAmountMax != null].filter(Boolean).length,
    [scheduledAmountMax, scheduledAmountMin]
  );

  const cleanedScheduledPayments = useMemo(
    () =>
      scheduledPayments.filter(
        (payment) => Number(payment.scheduled_remaining_amount ?? payment.amount ?? 0) > 0
      ),
    [scheduledPayments]
  );

  const scheduledSortedPayments = useMemo(() => {
    const list = [...cleanedScheduledPayments];
    const direction = scheduledSortDirection === "asc" ? 1 : -1;

    const getRemaining = (payment: Payment) =>
      Number(payment.scheduled_remaining_amount ?? payment.amount ?? 0) || 0;
    const getInitial = (payment: Payment) =>
      Number(payment.scheduled_initial_amount ?? payment.amount ?? 0) || 0;
    const getCollected = (payment: Payment) =>
      Math.max(getInitial(payment) - getRemaining(payment), 0);
    const getUpdatedTime = (payment: Payment) =>
      new Date(payment.updated_at ?? payment.created_at).getTime();

    list.sort((a, b) => {
      let diff = 0;
      switch (scheduledSortField) {
        case "scheduled_remaining_amount":
          diff = getRemaining(a) - getRemaining(b);
          break;
        case "scheduled_initial_amount":
          diff = getInitial(a) - getInitial(b);
          break;
        case "collected_amount":
          diff = getCollected(a) - getCollected(b);
          break;
        case "project_name": {
          const aName = a.projects?.name ?? "";
          const bName = b.projects?.name ?? "";
          return aName.localeCompare(bName, undefined, { sensitivity: "base" }) * direction;
        }
        case "lead_name": {
          const aName = a.projects?.leads?.name ?? "";
          const bName = b.projects?.leads?.name ?? "";
          return aName.localeCompare(bName, undefined, { sensitivity: "base" }) * direction;
        }
        default:
          diff = getUpdatedTime(a) - getUpdatedTime(b);
          break;
      }
      if (diff === 0) {
        return 0;
      }
      return diff * direction;
    });

    return list;
  }, [cleanedScheduledPayments, scheduledSortDirection, scheduledSortField]);

  const handleExport = useCallback(async () => {
    if (exporting) return;

    const runRecordedExport = async () => {
      const totalRecords = totalCount || paginatedPayments.length;
      if (totalRecords === 0) {
        toast({
          title: t("payments.export.noDataTitle"),
          description: t("payments.export.noDataDescription"),
        });
        return;
      }

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
            return formatDate(payment.log_timestamp || payment.date_paid || payment.created_at);
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
    };

    const runScheduledExport = async () => {
      const exportPayments = scheduledSortedPayments;

      if (!exportPayments.length) {
        toast({
          title: t("payments.export.noDataTitle"),
          description: t("payments.export.noDataDescription"),
        });
        return;
      }

      const rows = exportPayments.map((payment) => {
        const remaining = Math.max(
          Number(payment.scheduled_remaining_amount ?? payment.amount ?? 0),
          0
        );
        const initial = Math.max(
          Number(payment.scheduled_initial_amount ?? payment.amount ?? 0),
          0
        );
        const collected = Math.max(initial - remaining, 0);
        return {
          [t("payments.table.waiting.updated")]: formatDate(
            payment.updated_at ?? payment.created_at
          ),
          [t("payments.table.lead")]: payment.projects?.leads?.name ?? "",
          [t("payments.table.project")]: payment.projects?.name ?? "",
          [t("payments.table.waiting.remaining")]: formatCurrency(remaining),
          [t("payments.table.waiting.collected")]: formatCurrency(collected),
        };
      });

      const worksheet = XLSXUtils.json_to_sheet(rows);
      const workbook = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(workbook, worksheet, "Scheduled");

      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      writeFileXLSX(workbook, `scheduled-payments-${timestamp}.xlsx`);
    };

    try {
      setExporting(true);
      if (paymentsView === "recorded") {
        await runRecordedExport();
      } else {
        await runScheduledExport();
      }
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
    formatCurrency,
    paginatedPayments.length,
    paymentsView,
    scheduledSortedPayments,
    tableColumns,
    t,
    totalCount,
  ]);

  const selectedDateRange = useMemo(() => {
    if (activeDateRange) {
      return activeDateRange;
    }

    const sortedDates = metricsPayments
      .map((payment) => new Date(payment.log_timestamp ?? payment.date_paid ?? payment.created_at))
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
      refund: {
        label: t("payments.chart.legend.refund"),
        color: PAYMENT_COLORS.refund.hex,
      },
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
        buckets.set(key, { paid: 0, refund: 0, labelStart, labelEnd });
      }
    });

    const actualPayments = metricsPayments.filter((payment) => {
      const entryKind = payment.entry_kind ?? "recorded";
      if (entryKind !== "recorded") {
        return false;
      }
      const amount = Number(payment.amount) || 0;
      if (amount < 0) {
        return true;
      }
      return (payment.status || "").toLowerCase() === "paid";
    });

    actualPayments.forEach((payment) => {
      const timestamp = payment.log_timestamp ?? payment.date_paid ?? payment.created_at;
      const paymentDate = new Date(timestamp);
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
      if (amount < 0) {
        bucket.refund += Math.abs(amount);
      } else {
        bucket.paid += amount;
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
        refund: bucket.refund,
      }));
  }, [metricsPayments, selectedDateRange, trendGrouping, dateLocale]);

  const metrics = useMemo(
    (): PaymentMetrics => computePaymentSummaryMetrics(metricsPayments),
    [metricsPayments]
  );

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const hasTrendData = paymentsTrend.some(
    (point) =>
      Math.abs(point.paid) > 0 ||
      Math.abs(point.refund) > 0
  );

  const hasSearchTerm = filtersState.search.trim().length >= SEARCH_MIN_CHARS;
  const hasRecordedResults = totalCount > 0 || paginatedPayments.length > 0;
  const hasScheduledResults = scheduledSortedPayments.length > 0;

  const hasMorePayments = paginatedPayments.length < totalCount;
  const isLoadingMorePayments = tableLoading && page > 1;
  const displayedPayments = paymentsView === "recorded" ? paginatedPayments : scheduledSortedPayments;
  const displayedColumns = paymentsView === "recorded" ? tableColumns : waitingColumns;
  const tableIsLoading =
    paymentsView === "recorded"
      ? tableLoading && page === 1 && paginatedPayments.length === 0
      : tableLoading && !hasScheduledResults;
  const displayedHasMore = paymentsView === "recorded" ? hasMorePayments : false;
  const displayedOnLoadMore =
    paymentsView === "recorded" && hasMorePayments ? handleLoadMorePayments : undefined;
  const displayedIsLoadingMore = paymentsView === "recorded" ? isLoadingMorePayments : false;

  const handleLoadMorePayments = useCallback(() => {
    if (tableLoading || !hasMorePayments) return;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
    if (totalPages && page >= totalPages) return;
    setPage((prev) => prev + 1);
  }, [hasMorePayments, page, pageSize, tableLoading, totalCount]);

  const exportActions = useMemo(() => {
    const hasData = paymentsView === "recorded" ? hasRecordedResults : hasScheduledResults;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={!hasData || tableLoading || exporting}
        className="hidden sm:inline-flex"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t("payments.export.button")}</span>
      </Button>
    );
  }, [exporting, handleExport, hasRecordedResults, hasScheduledResults, paymentsView, tableLoading, t]);

  // Use AdvancedDataTable's built-in header search instead of toolbar

  const tableTitle = useMemo(
    () => (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <span className="text-lg font-semibold">{t("payments.tableTitle")}</span>
        <SegmentedControl
          size="sm"
          value={paymentsView}
          onValueChange={handlePaymentsViewChange}
          options={[
            { value: "recorded", label: t("payments.table.view.recorded") },
            { value: "scheduled", label: t("payments.table.view.scheduled") },
          ]}
        />
      </div>
    ),
    [handlePaymentsViewChange, paymentsView, t]
  );

  const emptyStateMessage =
    paymentsView === "recorded"
      ? hasSearchTerm || activeFilterCount > 0
        ? t("payments.emptyState.noPaymentsWithFilters")
        : t("payments.emptyState.noPaymentsForPeriod")
      : scheduledActiveFilterCount > 0
        ? t("payments.emptyState.noPaymentsWithFilters")
        : t("payments.emptyState.noScheduledPayments");

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

  const scheduledFilterSummary = useMemo(() => {
    const chips: { id: string; label: React.ReactNode }[] = [];
    if (scheduledAmountMin != null) {
      chips.push({
        id: "scheduled-min",
        label: (
          <span>
            <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
              {t("payments.filters.amountMinPlaceholder")}:
            </span>
            {formatCurrency(scheduledAmountMin)}
          </span>
        ),
      });
    }
    if (scheduledAmountMax != null) {
      chips.push({
        id: "scheduled-max",
        label: (
          <span>
            <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
              {t("payments.filters.amountMaxPlaceholder")}:
            </span>
            {formatCurrency(scheduledAmountMax)}
          </span>
        ),
      });
    }
    return chips;
  }, [formatCurrency, scheduledAmountMax, scheduledAmountMin, t]);

  const scheduledFiltersConfig = useMemo(
    () => ({
      title: t("payments.filterPanel.title"),
      content: (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("payments.filters.amountHeading")}
          </p>
          <div className="flex items-center gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={scheduledAmountMinDraft}
                onChange={(event) => handleScheduledAmountMinDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleScheduledFiltersApply();
                  }
                }}
                placeholder={t("payments.filters.amountMinPlaceholder")}
                className="h-9 rounded-full"
              />
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={scheduledAmountMaxDraft}
                onChange={(event) => handleScheduledAmountMaxDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleScheduledFiltersApply();
                  }
                }}
                placeholder={t("payments.filters.amountMaxPlaceholder")}
                className="h-9 rounded-full"
              />
            </div>
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleScheduledFiltersApply}
              disabled={!scheduledAmountDirty}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ),
      activeCount: scheduledActiveFilterCount,
      onReset: scheduledActiveFilterCount ? handleScheduledFiltersReset : undefined,
      collapsedByDefault: true,
    }),
    [
      handleScheduledAmountMaxDraftChange,
      handleScheduledAmountMinDraftChange,
      handleScheduledFiltersApply,
      handleScheduledFiltersReset,
      scheduledActiveFilterCount,
      scheduledAmountDirty,
      scheduledAmountMaxDraft,
      scheduledAmountMinDraft,
      t,
    ]
  );

  const filtersConfigForView = paymentsView === "recorded" ? filtersConfig : scheduledFiltersConfig;
  const summaryChipsForView =
    paymentsView === "recorded" ? filterSummaryChips : scheduledFilterSummary;

  // (moved up above columns)

  const handleViewFullDetails = useCallback(() => {
    if (!selectedProject) return;
    navigate(`/projects/${selectedProject.id}`);
    handleProjectSheetOpenChange(false);
  }, [handleProjectSheetOpenChange, navigate, selectedProject]);

  // tableColumns defined above (before handleExport)

  const recordedSortState = useMemo<AdvancedDataTableSortState>(
    () => ({ columnId: sortField, direction: sortDirection }),
    [sortField, sortDirection]
  );

  const scheduledSortState = useMemo<AdvancedDataTableSortState>(
    () => ({ columnId: scheduledSortField, direction: scheduledSortDirection }),
    [scheduledSortField, scheduledSortDirection]
  );

  const sortStateForTable = paymentsView === "recorded" ? recordedSortState : scheduledSortState;

  const handleTableSortChange = useCallback(
    (next: AdvancedDataTableSortState) => {
      if (!next.columnId) return;
      if (paymentsView === "recorded") {
        setSortField(next.columnId as SortField);
        setSortDirection(next.direction as SortDirection);
        setPage(1);
        return;
      }

      setScheduledSortField(next.columnId as ScheduledSortField);
      setScheduledSortDirection(next.direction as SortDirection);
    },
    [paymentsView]
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader title={t("payments.title")}>
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
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
        title={tableTitle}
        data={displayedPayments}
        columns={displayedColumns}
        filters={filtersConfigForView}
        toolbar={undefined}
        summary={{ text: undefined, chips: summaryChipsForView }}
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
        isLoading={tableIsLoading}
        onLoadMore={displayedOnLoadMore}
        hasMore={displayedHasMore}
        isLoadingMore={displayedIsLoadingMore}
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
