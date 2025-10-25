import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { AdvancedDataTableFiltersConfig } from "@/components/data-table";

export type SessionPresenceFilter =
  | "any"
  | "none"
  | "hasAny"
  | "hasPlanned"
  | "hasUpcoming";

export type ProgressFilter = "any" | "not_started" | "in_progress" | "completed";

export type BalancePreset = "any" | "zero" | "due" | "credit";

type Option = { id: string; name: string };

export type ProjectsListFiltersState = {
  types: string[];
  stages: string[];
  sessionPresence: SessionPresenceFilter;
  progress: ProgressFilter;
  services: string[];
};

export type ProjectsArchivedFiltersState = {
  types: string[];
  balancePreset: BalancePreset;
  balanceMin: number | null;
  balanceMax: number | null;
};

export type FilterSummaryChip = {
  id: string;
  label: ReactNode;
};

interface UseProjectsListFiltersOptions {
  typeOptions: Option[];
  stageOptions: Option[];
  serviceOptions: Option[];
  initialState?: ProjectsListFiltersState;
  onStateChange?: (next: ProjectsListFiltersState) => void;
}

interface UseProjectsArchivedFiltersOptions {
  typeOptions: Option[];
  initialState?: ProjectsArchivedFiltersState;
  onStateChange?: (next: ProjectsArchivedFiltersState) => void;
}

interface UseProjectsListFiltersResult {
  state: ProjectsListFiltersState;
  filtersConfig: AdvancedDataTableFiltersConfig;
  activeCount: number;
  summaryChips: FilterSummaryChip[];
  reset: () => void;
}

interface UseProjectsArchivedFiltersResult {
  state: ProjectsArchivedFiltersState;
  filtersConfig: AdvancedDataTableFiltersConfig;
  activeCount: number;
  summaryChips: FilterSummaryChip[];
  reset: () => void;
}

const defaultListState: ProjectsListFiltersState = {
  types: [],
  stages: [],
  sessionPresence: "any",
  progress: "any",
  services: [],
};

const defaultArchivedState: ProjectsArchivedFiltersState = {
  types: [],
  balancePreset: "any",
  balanceMin: null,
  balanceMax: null,
};

const LIST_FILTER_CATEGORY_KEYS = [
  "types",
  "stages",
  "sessions",
  "progress",
  "services",
] as const;

const ARCHIVED_FILTER_CATEGORY_KEYS = ["types", "balance"] as const;

const LIST_FILTER_DEFAULT_EXPANDED_SECTIONS: string[] | undefined =
  LIST_FILTER_CATEGORY_KEYS.length < 4
    ? [...LIST_FILTER_CATEGORY_KEYS]
    : undefined;

const ARCHIVED_FILTER_DEFAULT_EXPANDED_SECTIONS: string[] | undefined =
  ARCHIVED_FILTER_CATEGORY_KEYS.length < 4
    ? [...ARCHIVED_FILTER_CATEGORY_KEYS]
    : undefined;

const toggleInArray = (values: string[], value: string, checked: boolean) => {
  if (checked) {
    if (values.includes(value)) {
      return values;
    }
    return [...values, value];
  }
  return values.filter((item) => item !== value);
};

const sanitizeSelections = (selections: string[], options: Option[]) => {
  if (selections.length === 0) return selections;
  const allowed = new Set(options.map((option) => option.id));
  let changed = false;
  const filtered = selections.filter((selection) => {
    const keep = allowed.has(selection);
    if (!keep) changed = true;
    return keep;
  });
  return changed ? filtered : selections;
};

export function useProjectsListFilters({
  typeOptions,
  stageOptions,
  serviceOptions,
  initialState = defaultListState,
  onStateChange,
}: UseProjectsListFiltersOptions): UseProjectsListFiltersResult {
  const { t } = useTranslation("pages");

  const [state, setState] = useState<ProjectsListFiltersState>(initialState);

  useEffect(() => {
    setState((prev) => {
      const nextTypes = sanitizeSelections(prev.types, typeOptions);
      const nextStages = sanitizeSelections(prev.stages, stageOptions);
      const nextServices = sanitizeSelections(prev.services, serviceOptions);

      if (
        nextTypes === prev.types &&
        nextStages === prev.stages &&
        nextServices === prev.services
      ) {
        return prev;
      }

      return {
        ...prev,
        types: nextTypes,
        stages: nextStages,
        services: nextServices,
      };
    });
  }, [serviceOptions, stageOptions, typeOptions]);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  const setStateAndNotify = useCallback((updater: (prev: ProjectsListFiltersState) => ProjectsListFiltersState) => {
    setState((prev) => {
      const next = updater(prev);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(defaultListState);
  }, []);

  const handleTypeToggle = useCallback(
    (value: string, checked: boolean) => {
      setStateAndNotify((prev) => ({
        ...prev,
        types: toggleInArray(prev.types, value, checked),
      }));
    },
    [setStateAndNotify]
  );

  const handleStageToggle = useCallback(
    (value: string, checked: boolean) => {
      setStateAndNotify((prev) => ({
        ...prev,
        stages: toggleInArray(prev.stages, value, checked),
      }));
    },
    [setStateAndNotify]
  );

  const handleServicesToggle = useCallback(
    (value: string, checked: boolean) => {
      setStateAndNotify((prev) => ({
        ...prev,
        services: toggleInArray(prev.services, value, checked),
      }));
    },
    [setStateAndNotify]
  );

  const handleSessionPresenceChange = useCallback(
    (value: SessionPresenceFilter) => {
      setStateAndNotify((prev) => ({ ...prev, sessionPresence: value }));
    },
    [setStateAndNotify]
  );

  const handleProgressChange = useCallback(
    (value: ProgressFilter) => {
      setStateAndNotify((prev) => ({ ...prev, progress: value }));
    },
    [setStateAndNotify]
  );

  const activeCount = useMemo(() => {
    const counters = [
      state.types.length > 0,
      state.stages.length > 0,
      state.sessionPresence !== "any",
      state.progress !== "any",
      state.services.length > 0,
    ];
    return counters.filter(Boolean).length;
  }, [state]);

  const summaryChips = useMemo<FilterSummaryChip[]>(() => {
    const chips: FilterSummaryChip[] = [];

    const renderLabel = (heading: string, value: string) => (
      <span>
        <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
          {heading}:
        </span>
        {value}
      </span>
    );

    if (state.types.length > 0) {
      const names = typeOptions
        .filter((option) => state.types.includes(option.id))
        .map((option) => option.name)
        .join(", ");
      chips.push({
        id: "types",
        label: renderLabel(t("projects.filters.typesHeading"), names),
      });
    }

    if (state.stages.length > 0) {
      const names = stageOptions
        .filter((option) => state.stages.includes(option.id))
        .map((option) => option.name)
        .join(", ");
      chips.push({
        id: "stages",
        label: renderLabel(t("projects.filters.stagesHeading"), names),
      });
    }

    if (state.sessionPresence !== "any") {
      chips.push({
        id: "sessionPresence",
        label: renderLabel(
          t("projects.filters.sessionsHeading"),
          t(`projects.filters.presence.${state.sessionPresence}`)
        ),
      });
    }

    if (state.progress !== "any") {
      chips.push({
        id: "progress",
        label: renderLabel(
          t("projects.filters.progressHeading"),
          t(`projects.filters.progressOptions.${state.progress}`)
        ),
      });
    }

    if (state.services.length > 0) {
      const names = serviceOptions
        .filter((option) => state.services.includes(option.id))
        .map((option) => option.name)
        .join(", ");
      chips.push({
        id: "services",
        label: renderLabel(t("projects.filters.servicesHeading"), names),
      });
    }

    return chips;
  }, [serviceOptions, stageOptions, state.progress, state.sessionPresence, state.services, state.stages, state.types, t, typeOptions]);

  const filtersContent = useMemo(() => {
    const toggleItemClasses =
      "rounded-full border border-border/60 bg-background px-3 py-1 text-sm font-medium transition-colors hover:border-border hover:bg-muted/20 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40";

    return (
      <Accordion
        type="multiple"
        defaultValue={LIST_FILTER_DEFAULT_EXPANDED_SECTIONS}
        className="divide-y divide-border/60 border-y border-border/60"
      >
        <AccordionItem value="types" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.typesHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            {typeOptions.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/40 p-3">
                {typeOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.types.includes(option.id)}
                      onCheckedChange={(checked) =>
                        handleTypeToggle(option.id, Boolean(checked))
                      }
                    />
                    <span>{option.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {t("projects.filters.noOptions")}
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="stages" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.stagesHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            {stageOptions.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/40 p-3">
                {stageOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.stages.includes(option.id)}
                      onCheckedChange={(checked) =>
                        handleStageToggle(option.id, Boolean(checked))
                      }
                    />
                    <span>{option.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {t("projects.filters.noOptions")}
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sessions" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.sessionsHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            <ToggleGroup
              type="single"
              value={state.sessionPresence}
              onValueChange={(value) =>
                handleSessionPresenceChange((value as SessionPresenceFilter) || "any")
              }
              className="flex flex-wrap justify-start gap-2"
              size="sm"
            >
              {(["any", "none", "hasAny", "hasPlanned", "hasUpcoming"] as SessionPresenceFilter[]).map((value) => (
                <ToggleGroupItem key={value} value={value} className={toggleItemClasses}>
                  {t(`projects.filters.presence.${value}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="progress" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.progressHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            <ToggleGroup
              type="single"
              value={state.progress}
              onValueChange={(value) =>
                handleProgressChange((value as ProgressFilter) || "any")
              }
              className="flex flex-wrap justify-start gap-2"
              size="sm"
            >
              {(["any", "not_started", "in_progress", "completed"] as ProgressFilter[]).map((value) => (
                <ToggleGroupItem key={value} value={value} className={toggleItemClasses}>
                  {t(`projects.filters.progressOptions.${value}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="services" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.servicesHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            {serviceOptions.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/40 p-3">
                {serviceOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.services.includes(option.id)}
                      onCheckedChange={(checked) =>
                        handleServicesToggle(option.id, Boolean(checked))
                      }
                    />
                    <span>{option.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {t("projects.filters.noOptions")}
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }, [
    handleProgressChange,
    handleServicesToggle,
    handleSessionPresenceChange,
    handleStageToggle,
    handleTypeToggle,
    serviceOptions,
    stageOptions,
    state.progress,
    state.services,
    state.sessionPresence,
    state.stages,
    state.types,
    t,
    typeOptions,
  ]);

  const filtersConfig = useMemo<AdvancedDataTableFiltersConfig>(() => ({
    title: t("projects.filters.title"),
    triggerLabel: t("projects.filters.title"),
    content: filtersContent,
    activeCount,
    onReset: activeCount ? reset : undefined,
    collapsedByDefault: true,
  }), [activeCount, filtersContent, reset, t]);

  return { state, filtersConfig, activeCount, summaryChips, reset };
}

export function useProjectsArchivedFilters({
  typeOptions,
  initialState = defaultArchivedState,
  onStateChange,
}: UseProjectsArchivedFiltersOptions): UseProjectsArchivedFiltersResult {
  const { t } = useTranslation("pages");

  const [state, setState] = useState<ProjectsArchivedFiltersState>(initialState);

  useEffect(() => {
    setState((prev) => {
      const nextTypes = sanitizeSelections(prev.types, typeOptions);
      if (nextTypes === prev.types) {
        return prev;
      }
      return {
        ...prev,
        types: nextTypes,
      };
    });
  }, [typeOptions]);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  const reset = useCallback(() => {
    setState(defaultArchivedState);
  }, []);

  const handleTypeToggle = useCallback((value: string, checked: boolean) => {
    setState((prev) => ({
      ...prev,
      types: toggleInArray(prev.types, value, checked),
    }));
  }, []);

  const handleBalancePresetChange = useCallback((value: BalancePreset) => {
    setState((prev) => ({ ...prev, balancePreset: value }));
  }, []);

  const handleBalanceInputChange = useCallback((key: "balanceMin" | "balanceMax", value: string) => {
    const parsed = value.trim() === "" ? null : Number(value);
    setState((prev) => ({
      ...prev,
      balancePreset: value.trim() === "" ? prev.balancePreset : "any",
      [key]: Number.isFinite(parsed) ? (parsed as number) : null,
    }));
  }, []);

  const activeCount = useMemo(() => {
    const counters = [
      state.types.length > 0,
      state.balancePreset !== "any",
      state.balanceMin !== null,
      state.balanceMax !== null,
    ];
    return counters.filter(Boolean).length;
  }, [state]);

  const summaryChips = useMemo<FilterSummaryChip[]>(() => {
    const chips: FilterSummaryChip[] = [];

    const renderLabel = (heading: string, value: string) => (
      <span>
        <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
          {heading}:
        </span>
        {value}
      </span>
    );

    if (state.types.length > 0) {
      const names = typeOptions
        .filter((option) => state.types.includes(option.id))
        .map((option) => option.name)
        .join(", ");
      chips.push({
        id: "types",
        label: renderLabel(t("projects.filters.typesHeading"), names),
      });
    }

    if (state.balancePreset !== "any") {
      chips.push({
        id: "balancePreset",
        label: renderLabel(
          t("projects.filters.balanceHeading"),
          t(`projects.filters.balancePresets.${state.balancePreset}`)
        ),
      });
    }

    if (state.balanceMin !== null || state.balanceMax !== null) {
      const minLabel =
        state.balanceMin !== null
          ? state.balanceMin.toLocaleString()
          : t("projects.filters.balanceRangeMin");
      const maxLabel =
        state.balanceMax !== null
          ? state.balanceMax.toLocaleString()
          : t("projects.filters.balanceRangeMax");
      const rangeValue = `${minLabel} – ${maxLabel}`;
      chips.push({
        id: "balanceRange",
        label: renderLabel(t("projects.filters.balanceHeading"), rangeValue),
      });
    }

    return chips;
  }, [
    state.balanceMax,
    state.balanceMin,
    state.balancePreset,
    state.types,
    t,
    typeOptions,
  ]);

  const filtersContent = useMemo(() => {
    const toggleItemClasses =
      "rounded-full border border-border/60 bg-background px-3 py-1 text-sm font-medium transition-colors hover:border-border hover:bg-muted/20 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40";

    return (
      <Accordion
        type="multiple"
        defaultValue={ARCHIVED_FILTER_DEFAULT_EXPANDED_SECTIONS}
        className="divide-y divide-border/60 border-y border-border/60"
      >
        <AccordionItem value="types" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.typesHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            {typeOptions.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/40 p-3">
                {typeOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.types.includes(option.id)}
                      onCheckedChange={(checked) =>
                        handleTypeToggle(option.id, Boolean(checked))
                      }
                    />
                    <span>{option.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {t("projects.filters.noOptions")}
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="balance" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {t("projects.filters.balanceHeading")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            <ToggleGroup
              type="single"
              value={state.balancePreset}
              onValueChange={(value) =>
                handleBalancePresetChange((value as BalancePreset) || "any")
              }
              className="flex flex-wrap justify-start gap-2"
              size="sm"
            >
              {(["any", "zero", "due", "credit"] as BalancePreset[]).map((value) => (
                <ToggleGroupItem key={value} value={value} className={toggleItemClasses}>
                  {t(`projects.filters.balancePresets.${value}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="grid gap-2 sm:grid-cols-2 mt-3">
              <Input
                type="number"
                value={state.balanceMin ?? ""}
                onChange={(event) => handleBalanceInputChange("balanceMin", event.target.value)}
                placeholder={t("projects.filters.balanceMinPlaceholder")}
                min={0}
              />
              <Input
                type="number"
                value={state.balanceMax ?? ""}
                onChange={(event) => handleBalanceInputChange("balanceMax", event.target.value)}
                placeholder={t("projects.filters.balanceMaxPlaceholder")}
                min={0}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }, [
    handleBalanceInputChange,
    handleBalancePresetChange,
    handleTypeToggle,
    state.balanceMax,
    state.balanceMin,
    state.balancePreset,
    state.types,
    t,
    typeOptions,
  ]);

  const filtersConfig = useMemo<AdvancedDataTableFiltersConfig>(() => ({
    title: t("projects.filters.title"),
    triggerLabel: t("projects.filters.title"),
    content: filtersContent,
    activeCount,
    onReset: activeCount ? reset : undefined,
    collapsedByDefault: true,
  }), [activeCount, filtersContent, reset, t]);

  return { state, filtersConfig, activeCount, summaryChips, reset };
}
