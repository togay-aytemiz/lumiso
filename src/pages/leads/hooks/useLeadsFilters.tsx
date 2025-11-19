import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AdvancedDataTableFiltersConfig } from "@/components/data-table";
import { useDraftFilters } from "@/components/data-table";
import type { LeadFieldDefinition, LeadFieldType } from "@/types/leadFields";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check } from "lucide-react";

type CheckboxSelection = "any" | "checked" | "unchecked";

export type CustomFieldFilterValue =
  | { type: "text"; value: string }
  | { type: "number"; min?: string; max?: string }
  | { type: "date"; start?: string; end?: string }
  | { type: "select"; values: string[] }
  | { type: "checkbox"; value: CheckboxSelection };

export interface LeadFiltersState {
  status: string[];
  customFields: Record<string, CustomFieldFilterValue>;
  inactiveOnly: boolean;
}

export type LeadsFiltersChangeReason = "apply" | "reset";

interface LeadStatusOption {
  id: string;
  name: string;
  color: string;
  is_system_final?: boolean;
}

interface UseLeadsFiltersOptions {
  statuses: LeadStatusOption[];
  fieldDefinitions: LeadFieldDefinition[];
  initialState?: LeadFiltersState;
  onStateChange?: (
    next: LeadFiltersState,
    meta: { reason: LeadsFiltersChangeReason }
  ) => void;
}

interface UseLeadsFiltersResult {
  state: LeadFiltersState;
  filtersConfig: AdvancedDataTableFiltersConfig;
  activeCount: number;
  isDirty: boolean;
}

const DEFAULT_STATE: LeadFiltersState = {
  status: [],
  customFields: {},
  inactiveOnly: false,
};

const FILTER_INPUT_CLASS =
  "h-9 rounded-full border border-border/60 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus:border-primary";

const mapFieldTypeToFilterType = (
  fieldType: LeadFieldType
): CustomFieldFilterValue["type"] => {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "select":
      return "select";
    case "checkbox":
      return "checkbox";
    default:
      return "text";
  }
};

const createDefaultFilterValue = (
  fieldType: LeadFieldType
): CustomFieldFilterValue => {
  const filterType = mapFieldTypeToFilterType(fieldType);
  switch (filterType) {
    case "number":
      return { type: "number", min: "", max: "" };
    case "date":
      return { type: "date", start: "", end: "" };
    case "select":
      return { type: "select", values: [] };
    case "checkbox":
      return { type: "checkbox", value: "any" };
    default:
      return { type: "text", value: "" };
  }
};

const normalizeString = (value?: string) => (value ?? "").trim();

const arraysEqualIgnoreOrder = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
};

const arraysMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((value) => seen.has(value));
};

const isCustomFieldFilterEmpty = (
  value?: CustomFieldFilterValue
): boolean => {
  if (!value) return true;
  switch (value.type) {
    case "text":
      return normalizeString(value.value) === "";
    case "number":
      return normalizeString(value.min) === "" && normalizeString(value.max) === "";
    case "date":
      return normalizeString(value.start) === "" && normalizeString(value.end) === "";
    case "select":
      return value.values.length === 0;
    case "checkbox":
      return value.value === "any";
    default:
      return true;
  }
};

const areCustomFieldFilterValuesEqual = (
  a?: CustomFieldFilterValue,
  b?: CustomFieldFilterValue
) => {
  if (!a && !b) return true;
  if (!a) return isCustomFieldFilterEmpty(b);
  if (!b) return isCustomFieldFilterEmpty(a);

  if (a.type !== b.type) {
    const emptyA = isCustomFieldFilterEmpty(a);
    const emptyB = isCustomFieldFilterEmpty(b);
    return emptyA && emptyB;
  }

  switch (a.type) {
    case "text":
      return normalizeString(a.value) === normalizeString(
        (b.type === "text" && b.value) || ""
      );
    case "number":
      return (
        normalizeString(a.min) === normalizeString(
          b.type === "number" ? b.min : ""
        ) &&
        normalizeString(a.max) === normalizeString(
          b.type === "number" ? b.max : ""
        )
      );
    case "date":
      return (
        normalizeString(a.start) === normalizeString(
          b.type === "date" ? b.start : ""
        ) &&
        normalizeString(a.end) === normalizeString(
          b.type === "date" ? b.end : ""
        )
      );
    case "select":
      return arraysEqualIgnoreOrder(
        a.values,
        b.type === "select" ? b.values : []
      );
    case "checkbox":
      return (
        a.value === (b.type === "checkbox" ? b.value : "any") ||
        (isCustomFieldFilterEmpty(a) && isCustomFieldFilterEmpty(b))
      );
    default:
      return true;
  }
};

const areLeadFiltersEqual = (a: LeadFiltersState, b: LeadFiltersState) => {
  if (!arraysMatch(a.status, b.status)) return false;
  if (a.inactiveOnly !== b.inactiveOnly) return false;
  const keys = new Set([
    ...Object.keys(a.customFields),
    ...Object.keys(b.customFields),
  ]);
  for (const key of keys) {
    if (!areCustomFieldFilterValuesEqual(a.customFields[key], b.customFields[key])) {
      return false;
    }
  }
  return true;
};

export function useLeadsFilters({
  statuses,
  fieldDefinitions,
  initialState,
  onStateChange,
}: UseLeadsFiltersOptions): UseLeadsFiltersResult {
  const { t: tPages } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");

  const filterableFields = useMemo(
    () => fieldDefinitions.filter((field) => !field.is_system),
    [fieldDefinitions]
  );

  const isFieldMultiSelect = useCallback((field: LeadFieldDefinition) => {
    if (field.allow_multiple === true) return true;
    if (field.allow_multiple === false) return false;

    const key = field.field_key.toLowerCase();
    const label = field.label.toLowerCase();
    if (key === "alan1" || label.includes("alan1")) {
      return true;
    }

    return false;
  }, []);

  const initialFiltersState = useMemo<LeadFiltersState>(
    () =>
      initialState
        ? {
            status: initialState.status ?? [],
            customFields: { ...initialState.customFields },
            inactiveOnly: Boolean(initialState.inactiveOnly),
          }
        : { ...DEFAULT_STATE },
    [initialState]
  );

  const {
    state: appliedState,
    draft,
    updateDraft,
    apply: commitDraft,
    reset: resetDraft,
  } = useDraftFilters<LeadFiltersState>({
    initialState: initialFiltersState,
    isEqual: areLeadFiltersEqual,
    onApply: (next) => onStateChange?.(next, { reason: "apply" }),
    onReset: (next) => onStateChange?.(next, { reason: "reset" }),
  });

  const fieldDefinitionMap = useMemo(() => {
    const map = new Map<string, LeadFieldDefinition>();
    fieldDefinitions.forEach((definition) => {
      map.set(definition.field_key, definition);
    });
    return map;
  }, [fieldDefinitions]);

  const manualFieldKeys = useMemo(() => {
    const manualTypes: LeadFieldType[] = [
      "text",
      "textarea",
      "email",
      "phone",
      "number",
      "date",
    ];
    return new Set(
      filterableFields
        .filter((field) => manualTypes.includes(field.field_type))
        .map((field) => field.field_key)
    );
  }, [filterableFields]);

  const [manualDrafts, setManualDrafts] = useState<Record<string, CustomFieldFilterValue>>({});
  const autoApplyRef = useRef(false);

  useEffect(() => {
    const nextDrafts: Record<string, CustomFieldFilterValue> = {};
    manualFieldKeys.forEach((fieldKey) => {
      const definition = fieldDefinitionMap.get(fieldKey);
      if (!definition) return;
      const appliedValue = appliedState.customFields[fieldKey];
      if (appliedValue && !isCustomFieldFilterEmpty(appliedValue)) {
        nextDrafts[fieldKey] = appliedValue;
      } else {
        nextDrafts[fieldKey] = createDefaultFilterValue(definition.field_type);
      }
    });
    setManualDrafts(nextDrafts);
  }, [appliedState, fieldDefinitionMap, manualFieldKeys]);

  const requestAutoApply = useCallback(() => {
    autoApplyRef.current = true;
  }, []);

  useEffect(() => {
    if (!autoApplyRef.current) {
      return;
    }
    const applied = commitDraft();
    if (applied) {
      autoApplyRef.current = false;
    }
  }, [commitDraft, draft]);

  const handleStatusToggle = useCallback(
    (statusName: string, checked: boolean) => {
      updateDraft((prev) => {
        const current = prev.status ?? [];
        const next = checked
          ? Array.from(new Set([...current, statusName]))
          : current.filter((value) => value !== statusName);
        if (arraysMatch(current, next)) {
          return prev;
        }
        return {
          ...prev,
          status: next,
        };
      });
      requestAutoApply();
    },
    [requestAutoApply, updateDraft]
  );

  const handleStatusClear = useCallback(() => {
    updateDraft((prev) => {
      if (prev.status.length === 0) {
        return prev;
      }
      return {
        ...prev,
        status: [],
      };
    });
    requestAutoApply();
  }, [requestAutoApply, updateDraft]);

  const setFieldFilter = useCallback(
    (fieldKey: string, value: CustomFieldFilterValue) => {
      updateDraft((prev) => {
        const nextCustomFields = { ...prev.customFields };
        if (isCustomFieldFilterEmpty(value)) {
          delete nextCustomFields[fieldKey];
        } else {
          nextCustomFields[fieldKey] = value;
        }
        return {
          ...prev,
          customFields: nextCustomFields,
        };
      });
    },
    [updateDraft]
  );

  const updateManualDraft = useCallback(
    (fieldKey: string, updater: (current: CustomFieldFilterValue) => CustomFieldFilterValue) => {
      setManualDrafts((prev) => {
        const definition = fieldDefinitionMap.get(fieldKey);
        if (!definition) {
          return prev;
        }
        const current =
          prev[fieldKey] ?? createDefaultFilterValue(definition.field_type);
        const nextValue = updater(current);
        if (areCustomFieldFilterValuesEqual(current, nextValue)) {
          return prev;
        }
        return {
          ...prev,
          [fieldKey]: nextValue,
        };
      });
    },
    [fieldDefinitionMap]
  );

  const handleManualApply = useCallback(
    (fieldKey: string) => {
      const definition = fieldDefinitionMap.get(fieldKey);
      if (!definition) {
        return;
      }
      const value =
        manualDrafts[fieldKey] ?? createDefaultFilterValue(definition.field_type);
      setFieldFilter(fieldKey, value);
      autoApplyRef.current = false;
      requestAutoApply();
    },
    [fieldDefinitionMap, manualDrafts, requestAutoApply, setFieldFilter]
  );

  const getAppliedValueForField = useCallback(
    (field: LeadFieldDefinition): CustomFieldFilterValue => {
      const existing = appliedState.customFields[field.field_key];
      if (
        existing &&
        mapFieldTypeToFilterType(field.field_type) === existing.type
      ) {
        return existing;
      }
      return createDefaultFilterValue(field.field_type);
    },
    [appliedState.customFields]
  );

  const handleSelectToggle = useCallback(
    (fieldKey: string, option: string, checked: boolean) => {
      const existingDraft =
        draft.customFields[fieldKey]?.type === "select"
          ? (draft.customFields[fieldKey] as Extract<CustomFieldFilterValue, { type: "select" }>)
          : undefined;
      const existingApplied =
        appliedState.customFields[fieldKey]?.type === "select"
          ? (appliedState.customFields[fieldKey] as Extract<CustomFieldFilterValue, { type: "select" }>)
          : undefined;
      const existing = existingDraft ?? existingApplied;
      const currentValues = existing?.values ?? [];
      const nextValues = checked
        ? Array.from(new Set([...currentValues, option]))
        : currentValues.filter((value) => value !== option);
      setFieldFilter(fieldKey, { type: "select", values: nextValues });
      requestAutoApply();
    },
    [appliedState.customFields, draft.customFields, requestAutoApply, setFieldFilter]
  );

  const handleSelectSingleChange = useCallback(
    (fieldKey: string, value: string | null) => {
      if (!value) {
        setFieldFilter(fieldKey, { type: "select", values: [] });
        requestAutoApply();
        return;
      }
      setFieldFilter(fieldKey, { type: "select", values: [value] });
      requestAutoApply();
    },
    [requestAutoApply, setFieldFilter]
  );

  const handleCheckboxChange = useCallback(
    (fieldKey: string, value: CheckboxSelection) => {
      setFieldFilter(fieldKey, { type: "checkbox", value });
      requestAutoApply();
    },
    [requestAutoApply, setFieldFilter]
  );

  const handleInactiveToggle = useCallback(
    (checked: boolean) => {
      updateDraft((prev) => {
        if (prev.inactiveOnly === checked) {
          return prev;
        }
        return {
          ...prev,
          inactiveOnly: checked,
        };
      });
      requestAutoApply();
    },
    [requestAutoApply, updateDraft]
  );

  const autoOpenSections = useMemo(() => {
    // Always show Status section by default (high priority filter)
    const sections: string[] = ["status"]; 
    if (appliedState.status.length > 0 && !sections.includes("status")) {
      sections.push("status");
    }
    filterableFields.forEach((field) => {
      const appliedValue = appliedState.customFields[field.field_key];
      if (appliedValue && !isCustomFieldFilterEmpty(appliedValue)) {
        sections.push(field.field_key);
      }
    });
    return sections;
  }, [appliedState, filterableFields]);

  const [accordionValue, setAccordionValue] = useState<string[]>(autoOpenSections);

  useEffect(() => {
    setAccordionValue((prev) => {
      const combined = new Set(prev);
      autoOpenSections.forEach((section) => combined.add(section));
      return Array.from(combined);
    });
  }, [autoOpenSections]);

  const handleResetFilters = useCallback(() => {
    resetDraft();
  }, [resetDraft]);

  const activeCount = useMemo(() => {
    let count = appliedState.status.length;
    Object.values(appliedState.customFields).forEach((filter) => {
      if (!isCustomFieldFilterEmpty(filter)) {
        count += 1;
      }
    });
    if (appliedState.inactiveOnly) {
      count += 1;
    }
    return count;
  }, [appliedState]);

  const filterContent = useMemo(() => {
    const renderManualApplyButton = (fieldKey: string, disabled: boolean) => (
      <Button
        type="button"
        size="icon"
        variant="default"
        className="h-9 w-9 shrink-0"
        onClick={() => handleManualApply(fieldKey)}
        disabled={disabled}
      >
        <Check className="h-4 w-4" />
      </Button>
    );

    return (
      <>
      <Accordion
        type="multiple"
        value={accordionValue}
        onValueChange={(value) =>
          setAccordionValue(Array.isArray(value) ? value : [value])
        }
        className="divide-y divide-border/60 border-y border-border/60"
      >
        <AccordionItem value="status" className="border-b border-border/40">
          <AccordionTrigger className="text-sm font-semibold text-foreground">
            {tPages("leads.filterByStatus")}
          </AccordionTrigger>
          <AccordionContent className="overflow-visible">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs text-muted-foreground">
                {draft.status.length > 0
                  ? tPages("leads.selectedStatusCount", { count: draft.status.length })
                  : tPages("leads.noStatusesSelected")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                onClick={handleStatusClear}
                disabled={draft.status.length === 0}
              >
                {tCommon("buttons.clear")}
              </Button>
            </div>
            <div className="space-y-2">
              {statuses.map((status) => (
                <label key={status.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.status.includes(status.name)}
                    onCheckedChange={(checked) =>
                      handleStatusToggle(status.name, Boolean(checked))
                    }
                  />
                  <span>{status.name}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {filterableFields.map((field) => {
          const fieldKey = field.field_key;
          const filterType = mapFieldTypeToFilterType(field.field_type);
          const isManual = manualFieldKeys.has(fieldKey);
          const appliedValue = getAppliedValueForField(field);
          const manualValue =
            manualDrafts[fieldKey] ?? createDefaultFilterValue(field.field_type);

          if (filterType === "select") {
            const options = field.options?.options ?? [];
            const allowMultiple = isFieldMultiSelect(field);
            const currentDraft =
              draft.customFields[fieldKey]?.type === "select"
                ? (draft.customFields[fieldKey] as Extract<
                    CustomFieldFilterValue,
                    { type: "select" }
                  >)
                : appliedState.customFields[fieldKey]?.type === "select"
                ? (appliedState.customFields[fieldKey] as Extract<
                    CustomFieldFilterValue,
                    { type: "select" }
                  >)
                : undefined;
            const selectedValues = currentDraft?.values ?? [];

            if (allowMultiple) {
              return (
                <AccordionItem
                  key={fieldKey}
                  value={fieldKey}
                  className="border-b border-border/40"
                >
                  <AccordionTrigger className="text-sm font-semibold text-foreground">
                    {field.label}
                    <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                      {tPages("leads.multiSelectHint")}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="overflow-visible pt-2">
                    {options.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-border/40 p-3">
                        {options.map((option) => (
                          <label key={option} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedValues.includes(option)}
                              onCheckedChange={(checked) =>
                                handleSelectToggle(fieldKey, option, Boolean(checked))
                              }
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        {tPages("leads.noOptionsConfigured")}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            }

            if (!allowMultiple) {
              const currentValue = selectedValues[0] ?? "";
              return (
                <AccordionItem
                  key={fieldKey}
                  value={fieldKey}
                  className="border-b border-border/40"
                >
                  <AccordionTrigger className="text-sm font-semibold text-foreground">
                    {field.label}
                  </AccordionTrigger>
                  <AccordionContent className="overflow-visible pt-2">
                    <div className="flex items-center gap-2">
                      <RadioGroup
                        value={currentValue}
                        onValueChange={(next) => handleSelectSingleChange(fieldKey, next)}
                        className="grid flex-1 gap-2"
                      >
                        {options.map((option) => {
                          const id = `${fieldKey}-${option}`;
                          return (
                            <div key={option} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={option} id={id} />
                              <label htmlFor={id} className="cursor-pointer text-sm">
                                {option}
                              </label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleSelectSingleChange(fieldKey, null)}
                        disabled={currentValue === ""}
                      >
                        {tCommon("buttons.clear")}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            }

            return (
              <AccordionItem
                key={fieldKey}
                value={fieldKey}
                className="border-b border-border/40"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground">
                  {field.label}
                </AccordionTrigger>
                <AccordionContent className="overflow-visible">
                  {options.length > 0 ? (
                    <div className="space-y-2 rounded-md border border-border/40 p-3">
                      {options.map((option) => (
                        <label
                          key={option}
                          className="flex items-center gap-2 text-sm"
                        >
                        <Checkbox
                          checked={selectedValues.includes(option)}
                          onCheckedChange={(isChecked) =>
                            handleSelectToggle(
                              fieldKey,
                              option,
                              Boolean(isChecked)
                            )
                          }
                        />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      {tPages("leads.noOptionsConfigured")}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          }

          if (filterType === "checkbox") {
            const currentValue =
              draft.customFields[fieldKey]?.type === "checkbox"
                ? (draft.customFields[fieldKey] as Extract<
                    CustomFieldFilterValue,
                    { type: "checkbox" }
                  >)
                : appliedValue.type === "checkbox"
                ? appliedValue
                : { type: "checkbox", value: "any" };

            return (
              <AccordionItem
                key={fieldKey}
                value={fieldKey}
                className="border-b border-border/40"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground">
                  {field.label}
                </AccordionTrigger>
                <AccordionContent className="overflow-visible pt-2">
                  <SegmentedControl
                    value={currentValue.value}
                    onValueChange={(next) => {
                      const resolved =
                        next === currentValue.value && next !== "any" ? "any" : next;
                      handleCheckboxChange(fieldKey, resolved as CheckboxSelection);
                    }}
                    options={[
                      {
                        value: "any",
                        label: tPages("leads.checkboxFilter.any"),
                      },
                      {
                        value: "checked",
                        label: tPages("leads.checkboxFilter.checked"),
                      },
                      {
                        value: "unchecked",
                        label: tPages("leads.checkboxFilter.unchecked"),
                      },
                    ]}
                    size="sm"
                  />
                </AccordionContent>
              </AccordionItem>
            );
          }

          const manualDirty =
            isManual &&
            !areCustomFieldFilterValuesEqual(manualValue, appliedValue);

          if (filterType === "number") {
            const numberValue =
              manualValue.type === "number"
                ? manualValue
                : { type: "number", min: "", max: "" };
            return (
              <AccordionItem
                key={fieldKey}
                value={fieldKey}
                className="border-b border-border/40"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground">
                  {field.label}
                </AccordionTrigger>
                <AccordionContent className="overflow-visible">
                  <div className="flex items-center gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder={tPages("leads.filtersPlaceholders.min")}
                        value={numberValue.min ?? ""}
                        onChange={(event) =>
                          updateManualDraft(fieldKey, (current) => ({
                            type: "number",
                            min: event.target.value,
                            max:
                              current.type === "number"
                                ? current.max ?? ""
                                : "",
                          }))
                        }
                        className={FILTER_INPUT_CLASS}
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder={tPages("leads.filtersPlaceholders.max")}
                        value={numberValue.max ?? ""}
                        onChange={(event) =>
                          updateManualDraft(fieldKey, (current) => ({
                            type: "number",
                            min:
                              current.type === "number"
                                ? current.min ?? ""
                                : "",
                            max: event.target.value,
                          }))
                        }
                        className={FILTER_INPUT_CLASS}
                      />
                    </div>
                    {renderManualApplyButton(fieldKey, !manualDirty)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          }

          if (filterType === "date") {
            const dateValue =
              manualValue.type === "date"
                ? manualValue
                : { type: "date", start: "", end: "" };
            return (
              <AccordionItem
                key={fieldKey}
                value={fieldKey}
                className="border-b border-border/40"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground">
                  {field.label}
                </AccordionTrigger>
                <AccordionContent className="overflow-visible">
                  <div className="flex items-center gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <Input
                        type="date"
                        value={dateValue.start ?? ""}
                        placeholder={tPages("leads.filtersPlaceholders.start")}
                        onChange={(event) =>
                          updateManualDraft(fieldKey, (current) => ({
                            type: "date",
                            start: event.target.value,
                            end:
                              current.type === "date"
                                ? current.end ?? ""
                                : "",
                          }))
                        }
                        className={FILTER_INPUT_CLASS}
                      />
                      <Input
                        type="date"
                        value={dateValue.end ?? ""}
                        placeholder={tPages("leads.filtersPlaceholders.end")}
                        onChange={(event) =>
                          updateManualDraft(fieldKey, (current) => ({
                            type: "date",
                            start:
                              current.type === "date"
                                ? current.start ?? ""
                                : "",
                            end: event.target.value,
                          }))
                        }
                        className={FILTER_INPUT_CLASS}
                      />
                    </div>
                    {renderManualApplyButton(fieldKey, !manualDirty)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          }

          const textValue =
            manualValue.type === "text" ? manualValue.value : "";

          return (
            <AccordionItem
              key={fieldKey}
              value={fieldKey}
              className="border-b border-border/40"
            >
              <AccordionTrigger className="text-sm font-semibold text-foreground">
                {field.label}
              </AccordionTrigger>
              <AccordionContent className="overflow-visible">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={tPages("leads.textFilterPlaceholder")}
                    value={textValue}
                    onChange={(event) =>
                      updateManualDraft(fieldKey, () => ({
                        type: "text",
                        value: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (!manualDirty) return;
                        handleManualApply(fieldKey);
                      }
                    }}
                    className={FILTER_INPUT_CLASS}
                  />
                  {renderManualApplyButton(fieldKey, !manualDirty)}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <div className="mt-6 rounded-2xl border border-border/50 bg-muted/40 p-4 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-foreground">
            {tPages("leads.inactiveFilter.label")}
          </p>
          <Switch
            checked={draft.inactiveOnly}
            onCheckedChange={handleInactiveToggle}
            aria-label={tPages("leads.inactiveFilter.label")}
          />
        </div>
        <p className="text-xs text-muted-foreground w-full">
          {tPages("leads.inactiveFilter.description")}
        </p>
      </div>
      </>
    );
  }, [
    accordionValue,
    appliedState,
    draft,
    filterableFields,
    getAppliedValueForField,
    handleCheckboxChange,
    handleManualApply,
    handleSelectSingleChange,
    handleSelectToggle,
    handleStatusClear,
    handleStatusToggle,
    manualDrafts,
    manualFieldKeys,
    setAccordionValue,
    statuses,
    isFieldMultiSelect,
    tCommon,
    tPages,
    updateManualDraft,
  ]);

  const filtersConfig = useMemo<AdvancedDataTableFiltersConfig>(
    () => ({
      title: tPages("leads.filtersTitle"),
      triggerLabel: tPages("leads.filtersTriggerLabel"),
      content: filterContent,
      footer: (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            onClick={handleResetFilters}
            disabled={activeCount === 0}
          >
            {tCommon("buttons.clearAll")}
          </Button>
        </div>
      ),
      activeCount,
      onReset: activeCount > 0 ? handleResetFilters : undefined,
      collapsedByDefault:
        filterableFields.length + 1 > 4 ? activeCount === 0 : false,
    }),
    [
      activeCount,
      filterContent,
      handleResetFilters,
      filterableFields.length,
      tCommon,
      tPages,
    ]
  );

  return {
    state: appliedState,
    filtersConfig,
    activeCount,
    isDirty: activeCount > 0,
  };
}
