import { useCallback, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AdvancedDataTableFiltersConfig } from "@/components/data-table";
import {
  SEARCH_MIN_CHARS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
} from "../constants";
import type {
  PaymentStatusFilter,
  PaymentTypeFilter,
} from "../types";

export type PaymentsFiltersState = {
  status: PaymentStatusFilter[];
  type: PaymentTypeFilter[];
  amountMin: number | null;
  amountMax: number | null;
  search: string;
};

export type PaymentsFiltersChangeReason = "apply" | "reset" | "search";

interface UsePaymentsFiltersOptions {
  onStateChange?: (
    next: PaymentsFiltersState,
    meta: { reason: PaymentsFiltersChangeReason }
  ) => void;
  initialState?: PaymentsFiltersState;
}

interface UsePaymentsFiltersResult {
  state: PaymentsFiltersState;
  filtersConfig: AdvancedDataTableFiltersConfig;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  activeFilterCount: number;
}

const defaultState: PaymentsFiltersState = {
  status: [],
  type: [],
  amountMin: null,
  amountMax: null,
  search: "",
};

const arraysMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
};

export function usePaymentsFilters({
  onStateChange,
  initialState = defaultState,
}: UsePaymentsFiltersOptions = {}): UsePaymentsFiltersResult {
  const { t } = useTranslation("pages");

  const normalizedInitialState = useMemo(
    () => ({ ...defaultState, ...initialState }),
    [initialState]
  );

  const [filtersState, setFiltersState] = useState<PaymentsFiltersState>(
    normalizedInitialState
  );
  const [searchDraft, setSearchDraft] = useState<string>(
    normalizedInitialState.search
  );
  const [amountMinDraft, setAmountMinDraft] = useState<string>(
    normalizedInitialState.amountMin != null
      ? String(normalizedInitialState.amountMin)
      : ""
  );
  const [amountMaxDraft, setAmountMaxDraft] = useState<string>(
    normalizedInitialState.amountMax != null
      ? String(normalizedInitialState.amountMax)
      : ""
  );

  useEffect(() => {
    setFiltersState(normalizedInitialState);
    setSearchDraft(normalizedInitialState.search);
    setAmountMinDraft(
      normalizedInitialState.amountMin != null
        ? String(normalizedInitialState.amountMin)
        : ""
    );
    setAmountMaxDraft(
      normalizedInitialState.amountMax != null
        ? String(normalizedInitialState.amountMax)
        : ""
    );
  }, [normalizedInitialState]);

  const parseAmountInputValue = useCallback((value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  useEffect(() => {
    setAmountMinDraft(
      filtersState.amountMin != null ? String(filtersState.amountMin) : ""
    );
  }, [filtersState.amountMin]);

  useEffect(() => {
    setAmountMaxDraft(
      filtersState.amountMax != null ? String(filtersState.amountMax) : ""
    );
  }, [filtersState.amountMax]);

  const updateState = useCallback(
    (
      updater: (prev: PaymentsFiltersState) => PaymentsFiltersState,
      reason: PaymentsFiltersChangeReason = "apply"
    ) => {
      setFiltersState((prev) => {
        const next = updater(prev);
        const unchanged =
          arraysMatch(prev.status, next.status) &&
          arraysMatch(prev.type, next.type) &&
          prev.amountMin === next.amountMin &&
          prev.amountMax === next.amountMax &&
          prev.search === next.search;
        if (unchanged) {
          return prev;
        }
        onStateChange?.(next, { reason });
        return next;
      });
    },
    [onStateChange]
  );

  const activeFilterCount = useMemo(() => {
    const hasStatus =
      filtersState.status.length > 0 &&
      filtersState.status.length < STATUS_FILTER_OPTIONS.length;
    const hasType =
      filtersState.type.length > 0 &&
      filtersState.type.length < TYPE_FILTER_OPTIONS.length;
    const hasMin = filtersState.amountMin !== null;
    const hasMax = filtersState.amountMax !== null;
    return [hasStatus, hasType, hasMin, hasMax].filter(Boolean).length;
  }, [filtersState]);

  const handleResetFilters = useCallback(() => {
    const resetState: PaymentsFiltersState = {
      ...normalizedInitialState,
      search: "",
    };
    setFiltersState(resetState);
    setSearchDraft("");
    setAmountMinDraft(
      resetState.amountMin != null ? String(resetState.amountMin) : ""
    );
    setAmountMaxDraft(
      resetState.amountMax != null ? String(resetState.amountMax) : ""
    );
    onStateChange?.(resetState, { reason: "reset" });
  }, [normalizedInitialState, onStateChange]);

  const handleStatusChange = useCallback(
    (values: PaymentStatusFilter[]) => {
      updateState((prev) => ({ ...prev, status: values }));
    },
    [updateState]
  );

  const handleTypeChange = useCallback(
    (values: PaymentTypeFilter[]) => {
      updateState((prev) => ({ ...prev, type: values }));
    },
    [updateState]
  );

  const handleAmountMinDraftChange = useCallback((value: string) => {
    setAmountMinDraft(value);
  }, []);

  const handleAmountMaxDraftChange = useCallback((value: string) => {
    setAmountMaxDraft(value);
  }, []);

  const handleApplyAmountFilters = useCallback(() => {
    const nextMin = parseAmountInputValue(amountMinDraft);
    const nextMax = parseAmountInputValue(amountMaxDraft);
    updateState(
      (prev) => ({ ...prev, amountMin: nextMin, amountMax: nextMax })
    );
  }, [amountMaxDraft, amountMinDraft, parseAmountInputValue, updateState]);

  const amountDirty = useMemo(() => {
    const parsedMin = parseAmountInputValue(amountMinDraft);
    const parsedMax = parseAmountInputValue(amountMaxDraft);
    return (
      parsedMin !== filtersState.amountMin || parsedMax !== filtersState.amountMax
    );
  }, [
    amountMaxDraft,
    amountMinDraft,
    filtersState.amountMax,
    filtersState.amountMin,
    parseAmountInputValue,
  ]);

  const handleSearchDraftChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      const trimmed = value.trim();
      if (trimmed.length >= SEARCH_MIN_CHARS || trimmed.length === 0) {
        updateState((prev) => ({ ...prev, search: trimmed }), "search");
      }
    },
    [updateState]
  );

  const handleClearSearchDraft = useCallback(() => {
    setSearchDraft("");
    updateState((prev) => ({ ...prev, search: "" }), "search");
  }, [updateState]);

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
            value={filtersState.status}
            onValueChange={(values) => handleStatusChange(values as PaymentStatusFilter[])}
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
            value={filtersState.type}
            onValueChange={(values) => handleTypeChange(values as PaymentTypeFilter[])}
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
          <div className="flex items-center gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amountMinDraft}
                onChange={(event) => handleAmountMinDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleApplyAmountFilters();
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
                value={amountMaxDraft}
                onChange={(event) => handleAmountMaxDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleApplyAmountFilters();
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
              onClick={handleApplyAmountFilters}
              disabled={!amountDirty}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    ),
    [
      amountMaxDraft,
      amountMinDraft,
      filtersState.status,
      filtersState.type,
      handleAmountMaxDraftChange,
      handleAmountMinDraftChange,
      handleApplyAmountFilters,
      handleStatusChange,
      handleTypeChange,
      statusFilterOptions,
      t,
      toggleItemClasses,
      typeFilterOptions,
      amountDirty,
    ]
  );

  const filtersConfig: AdvancedDataTableFiltersConfig = useMemo(
    () => ({
      title: t("payments.filterPanel.title"),
      triggerLabel: t("payments.filterPanel.title"),
      content: filtersContent,
      activeCount: activeFilterCount,
      onReset: activeFilterCount ? handleResetFilters : undefined,
      // Keep the filter rail closed by default; it will auto-open when
      // there are active filters due to AdvancedDataTable logic.
      collapsedByDefault: true,
    }),
    [activeFilterCount, filtersContent, handleResetFilters, t]
  );

  return {
    state: filtersState,
    filtersConfig,
    searchValue: searchDraft,
    onSearchChange: handleSearchDraftChange,
    onSearchClear: handleClearSearchDraft,
    activeFilterCount,
  };
}
