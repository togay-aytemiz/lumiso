import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/DateRangePicker";
import { ProjectSheetView } from "@/components/ProjectSheetView";
import { toast } from "@/hooks/use-toast";
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
import { FileDown, Loader2 } from "lucide-react";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import { PAYMENT_COLORS } from "@/lib/paymentColors";
import {
  AdvancedDataTable,
  type AdvancedTableColumn,
  type AdvancedDataTableSortState,
} from "@/components/data-table";
import { TableSearchInput } from "@/components/data-table/TableSearchInput";
import {
  PAGE_SIZE,
  SEARCH_MIN_CHARS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
} from "@/pages/payments/constants";
import {
  DateFilterType,
  Payment,
  PaymentMetrics,
  PaymentStatusFilter,
  PaymentTrendPoint,
  PaymentTypeFilter,
  ProjectDetails,
  SortDirection,
  SortField,
  TrendGrouping,
} from "@/pages/payments/types";
import { usePaymentsData } from "@/pages/payments/hooks/usePaymentsData";
import { usePaymentsTableColumns } from "@/pages/payments/hooks/usePaymentsTableColumns";

const Payments = () => {
  const { t } = useTranslation("pages");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DateFilterType>('allTime');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [statusFilters, setStatusFilters] = useState<PaymentStatusFilter[]>([]);
  const [statusDraft, setStatusDraft] = useState<PaymentStatusFilter[]>([]);
  const [typeFilters, setTypeFilters] = useState<PaymentTypeFilter[]>([]);
  const [typeDraft, setTypeDraft] = useState<PaymentTypeFilter[]>([]);
  const [amountMinFilter, setAmountMinFilter] = useState<number | null>(null);
  const [amountMaxFilter, setAmountMaxFilter] = useState<number | null>(null);
  const [amountMinDraft, setAmountMinDraft] = useState<string>("");
  const [amountMaxDraft, setAmountMaxDraft] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date_paid");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectDetails | null>(null);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [trendGrouping, setTrendGrouping] = useState<TrendGrouping>("month");
  const sheetCloseTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const dateLocale = useMemo(() => getDateFnsLocale(), []);
  const handleDataError = useCallback((error: Error) => {
    toast({
      title: t("payments.errorFetching"),
      description: error.message,
      variant: "destructive",
    });
  }, [t]);
  const compactCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    []
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
    setSearchDraft(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("paymentsTrendGrouping", trendGrouping);
  }, [trendGrouping]);

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
    statusFilters,
    typeFilters,
    amountMinFilter,
    amountMaxFilter,
    searchTerm,
    activeDateRange,
    onError: handleDataError,
  });

  useEffect(() => {
    setPage(1);
  }, [selectedFilter, customDateRange, statusFilters, typeFilters, amountMinFilter, amountMaxFilter]);

  useEffect(() => {
    const computedTotalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > computedTotalPages) {
      setPage(computedTotalPages);
    }
  }, [totalCount, page, pageSize]);

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

      const rows = exportPayments.map((payment) => ({
        [t("payments.table.date")]: formatDate(payment.date_paid || payment.created_at),
        [t("payments.table.project")]: payment.projects?.name ?? "",
        [t("payments.table.lead")]: payment.projects?.leads?.name ?? "",
        [t("payments.table.amount")]: Number(payment.amount),
        [t("payments.table.status")]:
          (payment.status || "").toLowerCase() === "paid"
            ? t("payments.status.paid")
            : t("payments.status.due"),
        [t("payments.table.type")]:
          payment.type === "base_price"
            ? t("payments.type.base")
            : payment.type === "extra"
              ? t("payments.type.extra")
              : t("payments.type.manual"),
        [t("payments.table.description")]: payment.description?.trim() ?? "",
      }));

      const worksheet = XLSXUtils.json_to_sheet(rows);
      const workbook = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(workbook, worksheet, "Payments");

      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      writeFileXLSX(workbook, `payments-${timestamp}.xlsx`);

      toast({
        title: t("payments.export.successTitle"),
        description: t("payments.export.successDescription"),
      });
    } catch (error: any) {
      toast({
        title: t("payments.export.errorTitle"),
        description: error.message ?? t("payments.export.errorDescription"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    fetchPaymentsData,
    paginatedPayments.length,
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

    metricsPayments.forEach((payment) => {
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
  }, [metricsPayments, selectedDateRange, trendGrouping, dateLocale]);

  const metrics = useMemo((): PaymentMetrics => {
    const totalInvoiced = metricsPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const totalPaid = metricsPayments
      .filter((p) => (p.status || "").toLowerCase() === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const remainingBalance = metricsPayments
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
  }, [metricsPayments]);

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

  const hasSearchTerm = searchTerm.trim().length >= SEARCH_MIN_CHARS;
  const hasStatusFilter =
    statusFilters.length > 0 && statusFilters.length < STATUS_FILTER_OPTIONS.length;
  const hasTypeFilter =
    typeFilters.length > 0 && typeFilters.length < TYPE_FILTER_OPTIONS.length;
  const hasMinAmountFilter = amountMinFilter !== null;
  const hasMaxAmountFilter = amountMaxFilter !== null;
  const activeFilterCount = [
    hasStatusFilter,
    hasTypeFilter,
    hasMinAmountFilter,
    hasMaxAmountFilter,
  ].filter(Boolean).length;

  const statusFilterOptions = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.map((value) => ({
        value,
        label: value === "paid" ? t("payments.status.paid") : t("payments.status.due"),
      })),
    [t]
  );

  const typeFilterOptions = useMemo(
    () =>
      TYPE_FILTER_OPTIONS.map((value) => ({
        value,
        label:
          value === "base_price"
            ? t("payments.type.base")
            : value === "extra"
              ? t("payments.type.extra")
              : t("payments.type.manual"),
      })),
    [t]
  );

  const handleStatusFilterChange = useCallback((values: string[]) => {
    setStatusDraft(values as PaymentStatusFilter[]);
  }, []);

  const handleTypeFilterChange = useCallback((values: string[]) => {
    setTypeDraft(values as PaymentTypeFilter[]);
  }, []);

  const applySearchIfNeeded = useCallback(
    (rawValue: string) => {
      const normalized = rawValue.trim();
      if (normalized.length === 0) {
        if (searchTerm !== "") {
          setSearchTerm("");
          setPage(1);
        }
        return;
      }

      if (normalized.length >= SEARCH_MIN_CHARS && normalized !== searchTerm) {
        setSearchTerm(normalized);
        setPage(1);
      }
    },
    [searchTerm]
  );

  const handleSearchDraftChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      applySearchIfNeeded(value);
    },
    [applySearchIfNeeded]
  );

  const handleClearSearchDraft = useCallback(() => {
    setSearchDraft("");
    applySearchIfNeeded("");
  }, [applySearchIfNeeded]);

  const parseAmountInputValue = useCallback((value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const handleApplyFilters = useCallback(() => {
    const nextMin = parseAmountInputValue(amountMinDraft);
    const nextMax = parseAmountInputValue(amountMaxDraft);
    const normalizedSearch = searchDraft.trim();

    setStatusFilters([...statusDraft]);
    setTypeFilters([...typeDraft]);
    setAmountMinFilter(nextMin);
    setAmountMaxFilter(nextMax);
    setSearchTerm(normalizedSearch);
    if (normalizedSearch.length >= SEARCH_MIN_CHARS || normalizedSearch.length === 0) {
      setSearchDraft(normalizedSearch);
    }
    setPage(1);
  }, [amountMaxDraft, amountMinDraft, parseAmountInputValue, searchDraft, statusDraft, typeDraft]);

  const handleResetFilters = useCallback(() => {
    setStatusFilters([]);
    setTypeFilters([]);
    setAmountMinFilter(null);
    setAmountMaxFilter(null);
    setStatusDraft([]);
    setTypeDraft([]);
    setAmountMinDraft("");
    setAmountMaxDraft("");
    setSearchTerm("");
    setSearchDraft("");
    setPage(1);
  }, []);

  useEffect(() => {
    setStatusDraft(statusFilters);
  }, [statusFilters]);

  useEffect(() => {
    setTypeDraft(typeFilters);
  }, [typeFilters]);

  useEffect(() => {
    setAmountMinDraft(amountMinFilter != null ? String(amountMinFilter) : "");
  }, [amountMinFilter]);

  useEffect(() => {
    setAmountMaxDraft(amountMaxFilter != null ? String(amountMaxFilter) : "");
  }, [amountMaxFilter]);

  const arraysMatch = useCallback((a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }, []);

  const amountDraftMin = parseAmountInputValue(amountMinDraft);
  const amountDraftMax = parseAmountInputValue(amountMaxDraft);

  const statusFiltersDirty = useMemo(() => !arraysMatch(statusFilters, statusDraft), [arraysMatch, statusDraft, statusFilters]);
  const typeFiltersDirty = useMemo(() => !arraysMatch(typeFilters, typeDraft), [arraysMatch, typeDraft, typeFilters]);
  const amountFiltersDirty = useMemo(
    () => amountDraftMin !== amountMinFilter || amountDraftMax !== amountMaxFilter,
    [amountDraftMax, amountDraftMin, amountMaxFilter, amountMinFilter]
  );

  const filtersDirty = statusFiltersDirty || typeFiltersDirty || amountFiltersDirty;
  const canClearSearchDraft = searchDraft.trim().length > 0;

  const toggleItemClasses =
    "rounded-full border border-border/60 bg-background px-3 py-1 text-sm font-medium transition-colors hover:border-border hover:bg-muted/20 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40";

  const filtersContent = useMemo(
    () => (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("payments.filters.statusHeading")}
          </p>
          <ToggleGroup
            type="multiple"
            value={statusDraft}
            onValueChange={handleStatusFilterChange}
            className="flex flex-wrap justify-start gap-2"
            size="sm"
          >
            {statusFilterOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value} className={toggleItemClasses}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("payments.filters.typeHeading")}
          </p>
          <ToggleGroup
            type="multiple"
            value={typeDraft}
            onValueChange={handleTypeFilterChange}
            className="flex flex-wrap justify-start gap-2"
            size="sm"
          >
            {typeFilterOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value} className={toggleItemClasses}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("payments.filters.amountHeading")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountMinDraft}
              onChange={(event) => setAmountMinDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleApplyFilters();
                }
              }}
              placeholder={t("payments.filters.amountMinPlaceholder")}
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amountMaxDraft}
              onChange={(event) => setAmountMaxDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleApplyFilters();
                }
              }}
              placeholder={t("payments.filters.amountMaxPlaceholder")}
            />
          </div>
        </div>
      </div>
    ),
    [
      amountMaxDraft,
      amountMinDraft,
      handleApplyFilters,
      handleStatusFilterChange,
      handleTypeFilterChange,
      statusDraft,
      statusFilterOptions,
      t,
      toggleItemClasses,
      typeDraft,
      typeFilterOptions,
    ]
  );

  const filtersFooter = useMemo(
    () => (
      <div className="flex w-full flex-col gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleApplyFilters}
          disabled={!filtersDirty}
        >
          {t("payments.filters.applyButton")}
        </Button>
      </div>
    ),
    [filtersDirty, handleApplyFilters, t]
  );

  const tableToolbar = useMemo(
    () => (
      <TableSearchInput
        value={searchDraft}
        onChange={handleSearchDraftChange}
        onClear={handleClearSearchDraft}
        placeholder={t("payments.searchPlaceholder")}
        loading={tableLoading}
        clearAriaLabel={t("payments.filters.searchClear")}
        className="w-full sm:max-w-xs lg:max-w-sm"
      />
    ),
    [handleClearSearchDraft, handleSearchDraftChange, searchDraft, tableLoading, t]
  );

  const hasAnyResults = totalCount > 0 || paginatedPayments.length > 0;

  const exportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={!hasAnyResults || tableLoading || exporting}
        className="flex items-center gap-2"
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

  const filtersConfig = useMemo(
    () => ({
      title: t("payments.filterPanel.title"),
      triggerLabel: t("payments.filterPanel.title"),
      content: filtersContent,
      activeCount: activeFilterCount,
      onReset: activeFilterCount ? handleResetFilters : undefined,
      collapsedByDefault: true,
      footer: filtersFooter,
    }),
    [filtersContent, filtersFooter, activeFilterCount, handleResetFilters, t]
  );

  const emptyStateMessage =
    hasSearchTerm || activeFilterCount > 0
      ? t("payments.emptyState.noPaymentsWithFilters")
      : t("payments.emptyState.noPaymentsForPeriod");

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
      setSelectedProject(payment.projects);
      handleProjectSheetOpenChange(true);
    },
    [handleProjectSheetOpenChange]
  );

  const handleViewFullDetails = useCallback(() => {
    if (!selectedProject) return;
    navigate(`/projects/${selectedProject.id}`);
    handleProjectSheetOpenChange(false);
  }, [handleProjectSheetOpenChange, navigate, selectedProject]);

  const tableColumns = usePaymentsTableColumns({
    onProjectSelect: handleProjectOpen,
    onNavigateToLead: (leadId) => navigate(`/leads/${leadId}`),
    formatAmount: (value) => formatCurrency(value),
  });

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

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

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
      <AdvancedDataTable
        title={t("payments.tableTitle")}
        data={paginatedPayments}
        columns={tableColumns}
        rowKey={(row) => row.id}
        isLoading={tableLoading}
        loadingState={<TableLoadingSkeleton />}
        zebra
        filters={filtersConfig}
        toolbar={tableToolbar}
        actions={exportActions}
        columnCustomization={{ storageKey: "payments.table.columns" }}
        sortState={sortStateForTable}
        onSortChange={handleTableSortChange}
        pagination={{
          page,
          pageSize,
          totalCount,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions: [10, 25, 50, 100],
        }}
        emptyState={<div className="text-muted-foreground">{emptyStateMessage}</div>}
        onRowClick={handleProjectOpen}
      />

      {/* Project Details Dialog */}
      <ProjectSheetView
        project={selectedProject}
        open={projectSheetOpen}
        onOpenChange={handleProjectSheetOpenChange}
        onProjectUpdated={fetchPayments}
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
