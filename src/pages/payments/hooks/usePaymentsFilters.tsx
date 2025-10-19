import { useCallback, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AdvancedDataTableFiltersConfig } from "@/components/data-table";
import { useDraftFilters } from "@/components/data-table";
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

type AppliedFiltersState = Omit<PaymentsFiltersState, "search">;

const arraysMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
};

const buildAppliedInitialState = (state: PaymentsFiltersState): AppliedFiltersState => ({
  status: state.status ?? [],
  type: state.type ?? [],
  amountMin: state.amountMin ?? null,
  amountMax: state.amountMax ?? null,
});

export function usePaymentsFilters({
  onStateChange,
  initialState = defaultState,
}: UsePaymentsFiltersOptions = {}): UsePaymentsFiltersResult {
  const { t } = useTranslation("pages");

  const [filtersState, setFiltersState] = useState<PaymentsFiltersState>(initialState);
  const [searchDraft, setSearchDraft] = useState<string>(initialState.search);
  const [amountMinDraft, setAmountMinDraft] = useState<string>(
    initialState.amountMin != null ? String(initialState.amountMin) : ""
  );
  const [amountMaxDraft, setAmountMaxDraft] = useState<string>(
    initialState.amountMax != null ? String(initialState.amountMax) : ""
  );

  const appliedFilters = useDraftFilters<AppliedFiltersState>({
    initialState: buildAppliedInitialState(initialState),
    isEqual: (a, b) =>
      arraysMatch(a.status, b.status) &&
      arraysMatch(a.type, b.type) &&
      a.amountMin === b.amountMin &&
      a.amountMax === b.amountMax,
    onApply: (next) => {
      const nextState: PaymentsFiltersState = { ...next, search: filtersState.search };
      setFiltersState(nextState);
      onStateChange?.(nextState, { reason: "apply" });
    },
    onReset: (next) => {
      const nextState: PaymentsFiltersState = { ...next, search: "" };
      setFiltersState(nextState);
      setSearchDraft("");
      onStateChange?.(nextState, { reason: "reset" });
    },
  });

  const { state: appliedState, draft: appliedDraft, updateDraft: updateAppliedDraft, apply: commitDraft, reset: resetDraft, dirty: filtersDirty } = appliedFilters;

  const parseAmountInputValue = useCallback((value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  useEffect(() => {
    setAmountMinDraft(appliedDraft.amountMin != null ? String(appliedDraft.amountMin) : "");
  }, [appliedDraft.amountMin]);

  useEffect(() => {
    setAmountMaxDraft(appliedDraft.amountMax != null ? String(appliedDraft.amountMax) : "");
  }, [appliedDraft.amountMax]);

  const activeFilterCount = useMemo(() => {
    const hasStatus = appliedState.status.length > 0 && appliedState.status.length < STATUS_FILTER_OPTIONS.length;
    const hasType = appliedState.type.length > 0 && appliedState.type.length < TYPE_FILTER_OPTIONS.length;
    const hasMin = appliedState.amountMin !== null;
    const hasMax = appliedState.amountMax !== null;
    return [hasStatus, hasType, hasMin, hasMax].filter(Boolean).length;
  }, [appliedState]);

  const handleApplyFilters = useCallback(() => {
    commitDraft();
  }, [commitDraft]);

  const handleResetFilters = useCallback(() => {
    const resetPerformed = resetDraft();
    if (!resetPerformed && filtersState.search !== "") {
      const nextState: PaymentsFiltersState = {
        ...buildAppliedInitialState(filtersState),
        search: "",
      };
      setFiltersState(nextState);
      setSearchDraft("");
      onStateChange?.(nextState, { reason: "reset" });
    }
  }, [filtersState, onStateChange, resetDraft]);

  const handleStatusDraftChange = useCallback(
    (values: PaymentStatusFilter[]) => {
      updateAppliedDraft({ status: values });
    },
    [updateAppliedDraft]
  );

  const handleTypeDraftChange = useCallback(
    (values: PaymentTypeFilter[]) => {
      updateAppliedDraft({ type: values });
    },
    [updateAppliedDraft]
  );

  const handleAmountMinDraftChange = useCallback(
    (value: string) => {
      setAmountMinDraft(value);
      updateAppliedDraft({ amountMin: parseAmountInputValue(value) });
    },
    [parseAmountInputValue, updateAppliedDraft]
  );

  const handleAmountMaxDraftChange = useCallback(
    (value: string) => {
      setAmountMaxDraft(value);
      updateAppliedDraft({ amountMax: parseAmountInputValue(value) });
    },
    [parseAmountInputValue, updateAppliedDraft]
  );

  const handleSearchDraftChange = useCallback(
    (value: string) => {
      setSearchDraft(value);
      const trimmed = value.trim();
      if (trimmed.length >= SEARCH_MIN_CHARS || trimmed.length === 0) {
        setFiltersState((prev) => {
          if (prev.search === trimmed) {
            return prev;
          }
          const next = { ...prev, search: trimmed };
          onStateChange?.(next, { reason: "search" });
          return next;
        });
      }
    },
    [onStateChange]
  );

  const handleClearSearchDraft = useCallback(() => {
    setSearchDraft("");
    setFiltersState((prev) => {
      if (prev.search === "") {
        return prev;
      }
      const next = { ...prev, search: "" };
      onStateChange?.(next, { reason: "search" });
      return next;
    });
  }, [onStateChange]);

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
            value={appliedDraft.status}
            onValueChange={(values) => handleStatusDraftChange(values as PaymentStatusFilter[])}
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
            value={appliedDraft.type}
            onValueChange={(values) => handleTypeDraftChange(values as PaymentTypeFilter[])}
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
              onChange={(event) => handleAmountMinDraftChange(event.target.value)}
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
              onChange={(event) => handleAmountMaxDraftChange(event.target.value)}
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
      appliedDraft.status,
      appliedDraft.type,
      handleAmountMaxDraftChange,
      handleAmountMinDraftChange,
      handleApplyFilters,
      handleStatusDraftChange,
      handleTypeDraftChange,
      statusFilterOptions,
      t,
      toggleItemClasses,
      typeFilterOptions,
    ]
  );

  const filtersConfig: AdvancedDataTableFiltersConfig = useMemo(
    () => ({
      title: t("payments.filterPanel.title"),
      triggerLabel: t("payments.filterPanel.title"),
      content: filtersContent,
      activeCount: activeFilterCount,
      onReset: activeFilterCount ? handleResetFilters : undefined,
      collapsedByDefault: true,
      footer: (
        <div className="flex w-full flex-col gap-2">
          <Button type="button" size="sm" onClick={handleApplyFilters} disabled={!filtersDirty}>
            {t("payments.filters.applyButton")}
          </Button>
        </div>
      ),
    }),
    [activeFilterCount, filtersContent, filtersDirty, handleApplyFilters, handleResetFilters, t]
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
