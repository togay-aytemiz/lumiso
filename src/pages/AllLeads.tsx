import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, FileDown, Loader2 } from "lucide-react";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { useNavigate } from "react-router-dom";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { ADD_ACTION_EVENTS } from "@/constants/addActionEvents";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Calendar,
  MessageSquare,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { type LeadWithCustomFields } from "@/hooks/useLeadsWithCustomFields";
import { useLeadsData } from "@/pages/leads/hooks/useLeadsData";
import { useLeadTableColumns } from "@/hooks/useLeadTableColumns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import { writeFileXLSX, utils as XLSXUtils } from "xlsx/xlsx.mjs";
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
} from "@/components/data-table";
import { useLeadsFilters, type CustomFieldFilterValue } from "@/pages/leads/hooks/useLeadsFilters";
import type { LeadFieldDefinition } from "@/types/leadFields";
import { formatDate, getStartOfWeek } from "@/lib/utils";
import { format } from "date-fns";
import { KpiCard } from "@/components/ui/kpi-card";
import { getKpiIconPreset } from "@/components/ui/kpi-presets";
import { useThrottledRefetchOnFocus } from "@/hooks/useThrottledRefetchOnFocus";
import { useOrganization } from "@/contexts/OrganizationContext";

type LeadStatusOption = {
  id: string;
  name: string;
  color: string;
  is_system_final?: boolean;
};

type LeadNavigationState = {
  from: string;
  continueTutorial?: boolean;
  tutorialType?: "scheduling";
  tutorialStep?: number;
};

const parseBooleanFilterValue = (
  value: string | null | undefined
): boolean | null => {
  if (value == null) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const normalizeFilterText = (value: string | undefined) =>
  (value ?? "").toLowerCase();

const splitCommaValues = (value: string | null | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const isCustomFilterValueEmpty = (value?: CustomFieldFilterValue): boolean => {
  if (!value) return true;
  switch (value.type) {
    case "text":
      return value.value.trim() === "";
    case "number":
      return (value.min ?? "").trim() === "" && (value.max ?? "").trim() === "";
    case "date":
      return (value.start ?? "").trim() === "" && (value.end ?? "").trim() === "";
    case "select":
      return value.values.length === 0;
    case "checkbox":
      return value.value === "any";
    default:
      return true;
  }
};

interface FilterChipDetail {
  label: string;
  value: string;
}

const formatNumericBoundary = (
  label: string,
  min?: string,
  max?: string
): FilterChipDetail | null => {
  const trimmedMin = (min ?? "").trim();
  const trimmedMax = (max ?? "").trim();
  if (trimmedMin && trimmedMax) {
    return { label, value: `${trimmedMin} – ${trimmedMax}` };
  }
  if (trimmedMin) {
    return { label, value: `≥ ${trimmedMin}` };
  }
  if (trimmedMax) {
    return { label, value: `≤ ${trimmedMax}` };
  }
  return null;
};

const formatDateBoundary = (
  label: string,
  start?: string,
  end?: string
): FilterChipDetail | null => {
  const trimmedStart = (start ?? "").trim();
  const trimmedEnd = (end ?? "").trim();
  if (trimmedStart && trimmedEnd) {
    return {
      label,
      value: `${formatDate(trimmedStart)} – ${formatDate(trimmedEnd)}`,
    };
  }
  if (trimmedStart) {
    return { label, value: `≥ ${formatDate(trimmedStart)}` };
  }
  if (trimmedEnd) {
    return { label, value: `≤ ${formatDate(trimmedEnd)}` };
  }
  return null;
};

const describeCustomFieldFilterChip = (
  field: LeadFieldDefinition,
  filter: CustomFieldFilterValue,
  tPages: (key: string, options?: Record<string, unknown>) => string
): FilterChipDetail | null => {
  switch (filter.type) {
    case "text": {
      const trimmed = filter.value.trim();
      return trimmed ? { label: field.label, value: trimmed } : null;
    }
    case "number":
      return formatNumericBoundary(field.label, filter.min, filter.max);
    case "date":
      return formatDateBoundary(field.label, filter.start, filter.end);
    case "select": {
      const values = filter.values.filter(Boolean);
      return values.length
        ? { label: field.label, value: values.join(", ") }
        : null;
    }
    case "checkbox": {
      if (filter.value === "any") return null;
      const checkboxLabel = tPages(`leads.checkboxFilter.${filter.value}`);
      return { label: field.label, value: checkboxLabel };
    }
    default:
      return null;
  }
};

const AllLeadsNew = () => {
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusOption[]>([]);
  const [leadStatusesLoading, setLeadStatusesLoading] = useState(true);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const { currentStep, completeCurrentStep } = useOnboarding();
  const { t } = useTranslation('pages');
  const { t: tCommon } = useTranslation('common');
  const { activeOrganizationId } = useOrganization();

  useEffect(() => {
    const handleAddLead = (event: Event) => {
      event.preventDefault();
      setAddLeadDialogOpen(true);
    };
    window.addEventListener(ADD_ACTION_EVENTS.lead, handleAddLead);
    return () => {
      window.removeEventListener(ADD_ACTION_EVENTS.lead, handleAddLead);
    };
  }, []);

  // Server-side paginated leads (scalable like payments)
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "updated_at",
    direction: "desc",
  });

  const sortFieldForServer = useMemo(() => {
    if (sortState.columnId === "name") return "name" as const;
    if (sortState.columnId === "created_at") return "created_at" as const;
    return "updated_at" as const;
  }, [sortState.columnId]);

  const {
    advancedColumns,
    fieldDefinitions,
    sortAccessors,
    loading: columnsLoading,
  } = useLeadTableColumns({
    leadStatuses,
    leadStatusesLoading,
  });

  const {
    state: filtersState,
    filtersConfig,
    activeCount: activeFilterCount,
  } = useLeadsFilters({
    statuses: leadStatuses,
    fieldDefinitions,
  });

  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Map selected status names to IDs for server-side filtering
  const selectedStatusIds = useMemo(() => {
    if (!filtersState.status.length) return undefined;
    const byName = new Map(leadStatuses.map((s) => [s.name, s.id]));
    return filtersState.status
      .map((name) => byName.get(name))
      .filter(Boolean) as string[];
  }, [filtersState.status, leadStatuses]);

  // Fetch server‑side paginated data based on filters and sort
  const {
    pageLeads,
    metricsLeads,
    totalCount,
    initialLoading: leadsInitialLoading,
    tableLoading: leadsTableLoading,
    refetch: refetchLeads,
    fetchLeadsData,
  } = useLeadsData({
    page,
    pageSize,
    sortField: sortFieldForServer,
    sortDirection: (sortState.direction ?? "asc") as SortDirection,
    statusIds: selectedStatusIds,
    customFieldFilters: filtersState.customFields,
  });

  const fieldDefinitionMap = useMemo(() => {
    const map = new Map<string, (typeof fieldDefinitions)[number]>();
    fieldDefinitions.forEach((definition) => {
      map.set(definition.field_key, definition);
    });
    return map;
  }, [fieldDefinitions]);

  const totalIconPreset = useMemo(() => getKpiIconPreset("sky"), []);
  const conversionIconPreset = useMemo(() => getKpiIconPreset("emerald"), []);
  const inactivityIconPreset = useMemo(() => getKpiIconPreset("amber"), []);
  const closedIconPreset = useMemo(() => getKpiIconPreset("rose"), []);

  const formatNumber = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const formatPercent = (value: number) =>
    `${value.toLocaleString(undefined, {
      minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
      maximumFractionDigits: 1,
    })}%`;

  const formatSignedNumber = (value: number) => {
    if (value === 0) return "0";
    const formatted = formatNumber(Math.abs(value));
    return value > 0 ? `+${formatted}` : `-${formatted}`;
  };

  const formatSignedPercent = (value: number) => {
    if (value === 0) return "0%";
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString(undefined, {
      minimumFractionDigits: abs > 0 && abs < 10 ? 1 : 0,
      maximumFractionDigits: 1,
    });
    return value > 0 ? `+${formatted}%` : `-${formatted}%`;
  };

  const getTrendDirection = (value: number): "up" | "down" | "flat" => {
    if (value > 0) return "up";
    if (value < 0) return "down";
    return "flat";
  };

  const leadKpiMetrics = useMemo(() => {
    const nowDate = new Date();
    const now = nowDate.getTime();
    const dayInMs = 1000 * 60 * 60 * 24;

    // Locale-aware week boundaries for "this week" vs "last week"
    const startOfThisWeek = getStartOfWeek(nowDate).getTime();
    const startOfLastWeek = startOfThisWeek - 7 * dayInMs;

    const last30Start = now - 30 * dayInMs;
    const previous30Start = now - 60 * dayInMs;
    const inactiveThreshold = now - 14 * dayInMs;
    const inactivePreviousThreshold = now - 21 * dayInMs;

    const normalizeStatus = (status: string | null | undefined) =>
      (status ?? "").toLowerCase();

    const toMs = (value: string | null | undefined) => {
      if (!value) return null;
      const date = new Date(value);
      const ms = date.getTime();
      return Number.isNaN(ms) ? null : ms;
    };

    const convertedKeywords = [
      "booked",
      "completed",
      "won",
      "converted",
      "signed",
    ];
    const lostKeywords = ["lost", "canceled", "cancelled"];
    const closedKeywords = ["closed", "finished"];

    let newCurrent = 0;
    let newPrevious = 0;
    let currentEligible = 0;
    let currentConverted = 0;
    let previousEligible = 0;
    let previousConverted = 0;
    let inactiveCurrent = 0;
    let inactivePrevious = 0;
    let closedCurrent = 0;
    let closedPrevious = 0;

    metricsLeads.forEach((lead) => {
      const createdMs = toMs(lead.created_at);
      if (createdMs != null) {
        if (createdMs >= startOfThisWeek) {
          newCurrent += 1;
        } else if (createdMs >= startOfLastWeek && createdMs < startOfThisWeek) {
          newPrevious += 1;
        }
      }

      const updatedMs = toMs(lead.updated_at) ?? createdMs;
      if (updatedMs == null) {
        return;
      }

      const statusName = normalizeStatus(lead.lead_statuses?.name ?? lead.status);
      const isLost = lostKeywords.some((keyword) => statusName.includes(keyword));
      const isCompleted = statusName.includes("completed");
      const isConverted = convertedKeywords.some((keyword) =>
        statusName.includes(keyword),
      );
      const isClosed =
        Boolean(lead.lead_statuses?.is_system_final) ||
        isLost ||
        isCompleted ||
        closedKeywords.some((keyword) => statusName.includes(keyword)) ||
        isConverted;

      if (updatedMs >= last30Start) {
        if (!isLost) {
          currentEligible += 1;
          if (isConverted) {
            currentConverted += 1;
          }
        }
        if (isClosed) {
          closedCurrent += 1;
        }
      } else if (updatedMs >= previous30Start) {
        if (!isLost) {
          previousEligible += 1;
          if (isConverted) {
            previousConverted += 1;
          }
        }
        if (isClosed) {
          closedPrevious += 1;
        }
      }

      if (!isCompleted && !isLost) {
        if (updatedMs < inactiveThreshold) {
          inactiveCurrent += 1;
          if (updatedMs < inactivePreviousThreshold) {
            inactivePrevious += 1;
          }
        }
      }
    });

    const currentRate =
      currentEligible > 0 ? (currentConverted / currentEligible) * 100 : 0;
    const previousRate =
      previousEligible > 0 ? (previousConverted / previousEligible) * 100 : 0;

    return {
      totals: {
        total: totalCount,
        newCurrent,
        newPrevious,
        delta: newCurrent - newPrevious,
      },
      conversion: {
        currentRate,
        previousRate,
        delta: currentRate - previousRate,
      },
      inactivity: {
        current: inactiveCurrent,
        previous: inactivePrevious,
        delta: inactiveCurrent - inactivePrevious,
      },
      closed: {
        current: closedCurrent,
        previous: closedPrevious,
        delta: closedCurrent - closedPrevious,
      },
    };
  }, [metricsLeads, totalCount]);

  // Throttle refresh on focus/visibility to avoid request storms
  const refreshLeads = useCallback(async () => {
    if (typeof window !== "undefined" && activeOrganizationId) {
      window.localStorage.removeItem(`prefetch:leads:first:${activeOrganizationId}`);
      window.localStorage.removeItem(`prefetch:leads:metrics:${activeOrganizationId}`);
    }
    setPage(1);
    await refetchLeads();
  }, [activeOrganizationId, refetchLeads]);

  useThrottledRefetchOnFocus(refreshLeads, 30_000);

  const leadsTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t('leads.tutorial.welcome.title'),
      description: t('leads.tutorial.welcome.description'),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.welcome.trackLeads.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.welcome.trackLeads.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Filter className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.welcome.filterSort.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.welcome.filterSort.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.welcome.customizeColumns.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.welcome.customizeColumns.description')}</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: t('leads.tutorial.addFirstLead.title'),
      description: t('leads.tutorial.addFirstLead.description'),
      content: null,
      mode: "floating",
      canProceed: totalCount > 0,
      requiresAction: totalCount === 0,
      disabledTooltip: t('leads.tutorial.addFirstLead.disabledTooltip')
    },
    {
      id: 3,
      title: t('leads.tutorial.exploreDetails.title'),
      description: t('leads.tutorial.exploreDetails.description'),
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: t('leads.tutorial.exploreDetails.disabledTooltip')
    }
  ];

  const schedulingTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t('leads.tutorial.scheduling.title'),
      description: t('leads.tutorial.scheduling.description'),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.scheduling.chooseDateTime.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.scheduling.chooseDateTime.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.scheduling.selectClient.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.scheduling.selectClient.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.scheduling.addDetails.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.scheduling.addDetails.description')}</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: t('leads.tutorial.selectLeadForSession.title'),
      description: t('leads.tutorial.selectLeadForSession.description'),
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: t('leads.tutorial.selectLeadForSession.disabledTooltip')
    }
  ];

  // Check if we should show tutorial when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isSchedulingTutorialParam = urlParams.get('tutorial') === 'scheduling';
    
    if (isSchedulingTutorialParam) {
      setIsSchedulingTutorial(true);
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    } else if (currentStep === 2) {
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    }
  }, [currentStep]);

  // Update tutorial step when needed
  useEffect(() => {
    if (showTutorial && !addLeadDialogOpen && currentTutorialStep === 1) {
      setCurrentTutorialStep(2);
    }
  }, [addLeadDialogOpen, showTutorial, currentTutorialStep]);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      // Complete Step 2 (leads) since this tutorial was accessed from leads page
      await completeCurrentStep();
      setShowTutorial(false);
      console.log(t('leads.messages.tutorialCompleted'));
      navigate('/getting-started');
    } catch (error) {
      console.error(t('leads.messages.errorCompletingTutorial'), error);
      toast({
        title: "Error", 
        description: t('leads.messages.failedToSaveProgress'),
        variant: "destructive"
      });
    }
  };

  const handleTutorialExit = () => {
    setShowTutorial(false);
  };

  const handleAddLeadDialogChange = (open: boolean) => {
    setAddLeadDialogOpen(open);
  };

  const fetchLeadStatuses = useCallback(async () => {
    try {
      setLeadStatusesLoading(true);
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeadStatuses((data as LeadStatusOption[]) || []);
    } catch (error) {
      console.error(t('leads.messages.errorFetchingStatuses'), error);
    } finally {
      setLeadStatusesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLeadStatuses();
  }, [fetchLeadStatuses]);

  const handleSortChange = useCallback(
    (next: AdvancedDataTableSortState) => {
      setSortState(next);
    },
    []
  );

  // All custom-field filtering is applied server-side; no client fallback
  const filteredLeads = useMemo(() => pageLeads, [pageLeads]);

  const { columnId, direction } = sortState;

  const sortedLeads = useMemo(() => {
    if (!columnId) {
      return filteredLeads;
    }

    const accessor = sortAccessors[columnId];
    if (!accessor) {
      return filteredLeads;
    }

    const sorted = [...filteredLeads].sort((a, b) => {
      const aValue = accessor(a);
      const bValue = accessor(b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        const aValid = Number.isFinite(aValue);
        const bValid = Number.isFinite(bValue);
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return aValue - bValue;
      }

      const aString = (aValue ?? "").toString();
      const bString = (bValue ?? "").toString();

      const aEmpty = aString.length === 0;
      const bEmpty = bString.length === 0;

      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      return aString.localeCompare(bString);
    });

    if (direction === "desc") {
      sorted.reverse();
    }

    return sorted;
  }, [columnId, direction, filteredLeads, sortAccessors]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, totalCount]);

  useEffect(() => {
    setPage(1);
  }, [filtersState.status, filtersState.customFields]);

  const paginatedLeads = sortedLeads; // already server-paginated

  const hasMoreLeads = paginatedLeads.length < totalCount;
  const isLoadingMoreLeads = leadsTableLoading && page > 1;

  const handleLoadMoreLeads = useCallback(() => {
    if (leadsTableLoading || !hasMoreLeads) return;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
    if (totalPages && page >= totalPages) return;
    setPage((prev) => prev + 1);
  }, [hasMoreLeads, leadsTableLoading, page, pageSize, totalCount]);

  const exportColumns = useMemo(() => advancedColumns, [advancedColumns]);

  const handleExportLeads = useCallback(async () => {
    if (exporting) return;

    if (totalCount === 0) {
      toast({
        title: t("leads.export.noDataTitle"),
        description: t("leads.export.noDataDescription"),
      });
      return;
    }

    try {
      setExporting(true);

      // Fetch all filtered leads in chunks from the server to avoid loading everything at once
      const CHUNK = 500;
      const collected: LeadWithCustomFields[] = [];
      for (let from = 0; from < totalCount; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, totalCount - 1);
        const { leads: chunk } = await fetchLeadsData({ from, to, includeCount: false });
        collected.push(...chunk);
      }

      const rows = collected.map((lead) => {
        const row: Record<string, string | number> = {};
        exportColumns.forEach((column) => {
          const header =
            typeof column.label === "string" ? column.label : String(column.label);
          let value: unknown = "";
          if (column.accessor) {
            value = column.accessor(lead);
          } else if (typeof column.accessorKey === "string") {
            value = (lead as Record<string, unknown>)[column.accessorKey];
          }

          if (value == null) {
            row[header] = "";
          } else if (typeof value === "number") {
            row[header] = value;
          } else {
            row[header] = String(value);
          }
        });
        return row;
      });

      const worksheet = XLSXUtils.json_to_sheet(rows);
      const workbook = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(workbook, worksheet, "Leads");

      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      writeFileXLSX(workbook, `leads-${timestamp}.xlsx`);

      toast({
        title: t("leads.export.successTitle"),
        description: t("leads.export.successDescription"),
      });
    } catch (error) {
      console.error("Error exporting leads", error);
      toast({
        title: t("leads.export.errorTitle"),
        description:
          error instanceof Error
            ? error.message
            : t("leads.export.errorDescription"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [exportColumns, exporting, fetchLeadsData, t, totalCount]);

  const exportActions = useMemo(
    () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExportLeads}
        disabled={exporting || leadsTableLoading || sortedLeads.length === 0}
        className="hidden sm:inline-flex"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{t("leads.export.button")}</span>
      </Button>
    ),
    [exporting, handleExportLeads, leadsTableLoading, sortedLeads.length, t]
  );

  const tableSummaryText = useMemo(() => {
    if (activeFilterCount === 0) return undefined;
    return t("leads.tableSummaryFiltered", { visible: sortedLeads.length, total: totalCount });
  }, [activeFilterCount, sortedLeads.length, t, totalCount]);

  const filtersSummaryText = useMemo(() => {
    if (activeFilterCount === 0) {
      return t("leads.tableNoActiveFilters");
    }
    return t("leads.tableActiveFilters", { count: activeFilterCount });
  }, [activeFilterCount, t]);

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: React.ReactNode }[] = [];

    if (filtersState.status.length > 0) {
      filtersState.status.forEach((statusName, index) => {
        chips.push({
          id: `status-${statusName}-${index}`,
          label: (
            <span>
              <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
                {t("leads.filterChip.statusLabel")}:
              </span>
              {statusName}
            </span>
          ),
        });
      });
    }

    fieldDefinitions.forEach((field) => {
      const filterValue = filtersState.customFields[field.field_key];
      if (!filterValue || isCustomFilterValueEmpty(filterValue)) {
        return;
      }
      const detail = describeCustomFieldFilterChip(field, filterValue, t);
      if (detail) {
        chips.push({
          id: `custom-${field.field_key}`,
          label: (
            <span>
              <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
                {detail.label}:
              </span>
              {detail.value}
            </span>
          ),
        });
      }
    });

    return chips;
  }, [fieldDefinitions, filtersState, t]);

  const resetFilters = filtersConfig.onReset;

  const handleToolbarReset = useCallback(() => {
    resetFilters?.();
  }, [resetFilters]);

  const leadsHeaderSummary = useMemo(
    () => ({ text: tableSummaryText, chips: activeFilterChips }),
    [activeFilterChips, tableSummaryText]
  );

  const handleRowClick = (lead: LeadWithCustomFields) => {
    const state: LeadNavigationState = { from: "all-leads" };
    
    if (showTutorial) {
      if (isSchedulingTutorial && currentTutorialStep === 1) {
        state.continueTutorial = true;
        state.tutorialType = 'scheduling';
        state.tutorialStep = 3;
      } else if (currentTutorialStep === 2) {
        state.continueTutorial = true;
        state.tutorialStep = 4;
      }
    }
    
    navigate(`/leads/${lead.id}`, { state });
  };

  const hasCustomFieldFilters =
    Object.values(filtersState.customFields).some((value) => !isCustomFilterValueEmpty(value));
  const hasAnyFilters = activeFilterCount > 0;
  const hasStatusOnly =
    filtersState.status.length > 0 && hasAnyFilters && !hasCustomFieldFilters;
  const emptyStateMessage = hasStatusOnly
    ? filtersState.status.length === 1
      ? t("leads.noLeadsWithStatus", { status: filtersState.status[0] })
      : t("leads.noLeadsWithStatuses", { statuses: filtersState.status.join(", ") })
    : hasAnyFilters
    ? t("leads.noLeadsWithFilters")
    : t("leads.noLeadsAllStatuses");

  const emptyState = (
    <div className="py-8 text-center text-muted-foreground">
      {emptyStateMessage}
    </div>
  );

  const { totals, conversion: conversionMetrics, inactivity, closed } =
    leadKpiMetrics;

  const buildInfoLabel = (metricKey: string) =>
    t('leads.kpis.infoLabel', {
      metric: t(`leads.kpis.${metricKey}.title`),
    });

  const timeframeNew = t('leads.kpis.timeframes.newLast7Days');
  const timeframe30 = t('leads.kpis.timeframes.recent30Days');
  const timeframeInactive = t('leads.kpis.timeframes.inactive14Days');

  return (
    <div className="min-h-screen">
      <PageHeader title={t('leads.title')}>
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>
      
      <div className="space-y-6 p-4 sm:p-6">
        <section className="space-y-4">
          {(leadsInitialLoading || leadsTableLoading) ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-full rounded-2xl border border-border/60 bg-muted/40 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="mt-6 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                className="h-full"
                density="compact"
                icon={Users}
                {...totalIconPreset}
                subtitle={timeframeNew}
                title={t('leads.kpis.totalLeads.title')}
                value={formatNumber(totals.total)}
                trend={{
                  label: t('leads.kpis.totalLeads.trendLabel', {
                    count: formatNumber(totals.newCurrent),
                  }),
                  value: totals.delta,
                  direction: getTrendDirection(totals.delta),
                  valueFormat: "number",
                  showSign: true,
                  ariaLabel: t('leads.kpis.totalLeads.trendAria', {
                    delta: formatSignedNumber(totals.delta),
                    current: formatNumber(totals.newCurrent),
                    previous: formatNumber(totals.newPrevious),
                  }),
                }}
                info={{
                  content: t('leads.kpis.totalLeads.tooltip'),
                  ariaLabel: buildInfoLabel('totalLeads'),
                }}
              />
              <KpiCard
                className="h-full"
                density="compact"
                icon={TrendingUp}
                {...conversionIconPreset}
                subtitle={timeframe30}
                title={t('leads.kpis.conversionRate.title')}
                value={formatPercent(conversionMetrics.currentRate)}
                trend={{
                  value: conversionMetrics.delta,
                  direction: getTrendDirection(conversionMetrics.delta),
                  valueFormat: "percent",
                  decimals: 1,
                  showSign: true,
                  ariaLabel: t('leads.kpis.conversionRate.trendAria', {
                    delta: formatSignedPercent(conversionMetrics.delta),
                    current: formatPercent(conversionMetrics.currentRate),
                    previous: formatPercent(conversionMetrics.previousRate),
                  }),
                }}
                info={{
                  content: t('leads.kpis.conversionRate.tooltip'),
                  ariaLabel: buildInfoLabel('conversionRate'),
                }}
              />
              <KpiCard
                className="h-full"
                density="compact"
                icon={AlertCircle}
                {...inactivityIconPreset}
                subtitle={timeframeInactive}
                title={t('leads.kpis.noActivity.title')}
                value={formatNumber(inactivity.current)}
                trend={{
                  value: inactivity.delta,
                  direction: getTrendDirection(inactivity.delta),
                  valueFormat: "number",
                  showSign: true,
                  invert: true,
                  ariaLabel: t('leads.kpis.noActivity.trendAria', {
                    delta: formatSignedNumber(inactivity.delta),
                    current: formatNumber(inactivity.current),
                    previous: formatNumber(inactivity.previous),
                  }),
                }}
                info={{
                  content: t('leads.kpis.noActivity.tooltip'),
                  ariaLabel: buildInfoLabel('noActivity'),
                }}
              />
              <KpiCard
                className="h-full"
                density="compact"
                icon={XCircle}
                {...closedIconPreset}
                subtitle={timeframe30}
                title={t('leads.kpis.lost.title')}
                value={formatNumber(closed.current)}
                trend={{
                  value: closed.delta,
                  direction: getTrendDirection(closed.delta),
                  valueFormat: "number",
                  showSign: true,
                  ariaLabel: t('leads.kpis.lost.trendAria', {
                    delta: formatSignedNumber(closed.delta),
                    current: formatNumber(closed.current),
                    previous: formatNumber(closed.previous),
                  }),
                }}
                info={{
                  content: t('leads.kpis.lost.tooltip'),
                  ariaLabel: buildInfoLabel('lost'),
                }}
              />
            </div>
          )}
        </section>

        <section>
          {columnsLoading ? (
            <TableLoadingSkeleton />
          ) : (
          <AdvancedDataTable
              title={t('leads.tableTitle')}
              data={paginatedLeads}
              columns={advancedColumns}
              rowKey={(lead) => lead.id}
              onRowClick={handleRowClick}
              isLoading={leadsTableLoading && page === 1 && paginatedLeads.length === 0}
              loadingState={<TableLoadingSkeleton />}
              filters={filtersConfig}
              emptyState={emptyState}
              sortState={sortState}
              onSortChange={handleSortChange}
              actions={exportActions}
              summary={leadsHeaderSummary}
              onLoadMore={hasMoreLeads ? handleLoadMoreLeads : undefined}
              hasMore={hasMoreLeads}
              isLoadingMore={isLoadingMoreLeads}
            />
          )}
        </section>
      </div>
      
      <EnhancedAddLeadDialog 
        onSuccess={() => refreshLeads()} 
        open={addLeadDialogOpen}
        onOpenChange={handleAddLeadDialogChange}
        onClose={() => handleAddLeadDialogChange(false)}
      />

      <OnboardingTutorial
        steps={isSchedulingTutorial ? schedulingTutorialSteps : leadsTutorialSteps}
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        initialStepIndex={currentTutorialStep}
      />
    </div>
  );
};

export default AllLeadsNew;
