import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AdvancedDataTableFiltersConfig } from "@/components/data-table";
import { useDraftFilters } from "@/components/data-table";

export type SessionPresenceFilter =
  | "any"
  | "none"
  | "hasAny"
  | "hasPlanned"
  | "hasUpcoming";

export type ProjectsFiltersState = {
  types: string[];
  stages: string[];
  plannedMin: number | null;
  plannedMax: number | null;
  sessionPresence: SessionPresenceFilter;
  progressMin: number | null;
  progressMax: number | null;
  services: string[];
};

interface UseProjectsFiltersOptions {
  typeOptions: { id: string; name: string }[];
  stageOptions: { id: string; name: string }[];
  serviceOptions: { id: string; name: string }[];
  initialState?: ProjectsFiltersState;
  onStateChange?: (next: ProjectsFiltersState, meta: { reason: "apply" | "reset" }) => void;
}

interface UseProjectsFiltersResult {
  state: ProjectsFiltersState;
  filtersConfig: AdvancedDataTableFiltersConfig;
  activeCount: number;
}

const defaultState: ProjectsFiltersState = {
  types: [],
  stages: [],
  plannedMin: null,
  plannedMax: null,
  sessionPresence: "any",
  progressMin: null,
  progressMax: null,
  services: [],
};

const arraysMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((v) => aSet.has(v));
};

export function useProjectsFilters({
  typeOptions,
  stageOptions,
  serviceOptions,
  initialState = defaultState,
  onStateChange,
}: UseProjectsFiltersOptions): UseProjectsFiltersResult {
  const { t } = useTranslation("pages");

  const applied = useDraftFilters<ProjectsFiltersState>({
    initialState,
    isEqual: (a, b) =>
      arraysMatch(a.types, b.types) &&
      arraysMatch(a.stages, b.stages) &&
      a.plannedMin === b.plannedMin &&
      a.plannedMax === b.plannedMax &&
      a.sessionPresence === b.sessionPresence &&
      a.progressMin === b.progressMin &&
      a.progressMax === b.progressMax &&
      arraysMatch(a.services, b.services),
    onApply: (next) => onStateChange?.(next, { reason: "apply" }),
    onReset: (next) => onStateChange?.(next, { reason: "reset" }),
  });

  const { state, draft, updateDraft, apply, reset, dirty } = applied;

  const handleToggleArray = useCallback(
    (key: keyof ProjectsFiltersState, values: string[]) => {
      updateDraft((prev) => ({ ...prev, [key]: values }));
    },
    [updateDraft]
  );

  const activeCount = useMemo(() => {
    const s = state;
    return [
      s.types.length > 0,
      s.stages.length > 0,
      s.plannedMin !== null,
      s.plannedMax !== null,
      s.sessionPresence !== "any",
      s.progressMin !== null,
      s.progressMax !== null,
      s.services.length > 0,
    ].filter(Boolean).length;
  }, [state]);

  const toggleItemClasses =
    "rounded-full border border-border/60 bg-background px-3 py-1 text-sm font-medium transition-colors hover:border-border hover:bg-muted/20 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40";

  const filtersContent = useMemo(() => {
    return (
      <div className="space-y-6">
        {/* Types */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("projects.filters.typesHeading")}
          </p>
          <ToggleGroup
            type="multiple"
            value={draft.types}
            onValueChange={(v) => handleToggleArray("types", v as string[])}
            className="flex flex-wrap justify-start gap-2"
            size="sm"
          >
            {typeOptions.map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} className={toggleItemClasses}>
                {opt.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Stages */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("projects.filters.stagesHeading")}
          </p>
          <ToggleGroup
            type="multiple"
            value={draft.stages}
            onValueChange={(v) => handleToggleArray("stages", v as string[])}
            className="flex flex-wrap justify-start gap-2"
            size="sm"
          >
            {stageOptions.map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} className={toggleItemClasses}>
                {opt.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Sessions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("projects.filters.sessionsHeading")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              value={draft.plannedMin ?? ""}
              onChange={(e) => updateDraft({ plannedMin: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder={t("projects.filters.plannedMinPlaceholder")}
            />
            <Input
              type="number"
              min={0}
              value={draft.plannedMax ?? ""}
              onChange={(e) => updateDraft({ plannedMax: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder={t("projects.filters.plannedMaxPlaceholder")}
            />
          </div>
          <ToggleGroup
            type="single"
            value={draft.sessionPresence}
            onValueChange={(v) => updateDraft({ sessionPresence: (v as SessionPresenceFilter) || "any" })}
            className="flex flex-wrap justify-start gap-2"
            size="sm"
          >
            {(["any", "none", "hasAny", "hasPlanned", "hasUpcoming"] as SessionPresenceFilter[]).map((key) => (
              <ToggleGroupItem key={key} value={key} className={toggleItemClasses}>
                {t(`projects.filters.presence.${key}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("projects.filters.progressHeading")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.progressMin ?? ""}
              onChange={(e) => updateDraft({ progressMin: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder={t("projects.filters.progressMinPlaceholder")}
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.progressMax ?? ""}
              onChange={(e) => updateDraft({ progressMax: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder={t("projects.filters.progressMaxPlaceholder")}
            />
          </div>
        </div>

        {/* Services */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("projects.filters.servicesHeading")}
          </p>
          <ToggleGroup
            type="multiple"
            value={draft.services}
            onValueChange={(v) => handleToggleArray("services", v as string[])}
            className="flex flex-wrap justify-start gap-2"
            size="sm"
          >
            {serviceOptions.map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} className={toggleItemClasses}>
                {opt.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    );
  }, [
    draft.types,
    draft.stages,
    draft.plannedMin,
    draft.plannedMax,
    draft.sessionPresence,
    draft.progressMin,
    draft.progressMax,
    draft.services,
    handleToggleArray,
    serviceOptions,
    stageOptions,
    t,
    toggleItemClasses,
    typeOptions,
    updateDraft,
  ]);

  const filtersConfig: AdvancedDataTableFiltersConfig = useMemo(
    () => ({
      title: t("projects.filters.title"),
      triggerLabel: t("projects.filters.title"),
      content: filtersContent,
      activeCount,
      onReset: activeCount ? () => reset() : undefined,
      collapsedByDefault: true,
      footer: (
        <div className="flex w-full flex-col gap-2">
          <Button type="button" size="sm" onClick={() => apply()} disabled={!dirty}>
            {t("projects.filters.applyButton")}
          </Button>
        </div>
      ),
    }),
    [activeCount, apply, dirty, filtersContent, reset, t]
  );

  return { state, filtersConfig, activeCount };
}

