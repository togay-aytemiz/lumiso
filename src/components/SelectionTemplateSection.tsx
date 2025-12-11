import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export interface SelectionTemplateRuleForm {
  id: string;
  part: string;
  min: string;
  max: string;
  required: boolean;
}

export const createRuleId = () => `rule-${Math.random().toString(16).slice(2)}`;

export const createEmptyRule = (): SelectionTemplateRuleForm => ({
  id: createRuleId(),
  part: "",
  min: "",
  max: "",
  required: true,
});

export const deserializeSelectionTemplate = (template: unknown): SelectionTemplateRuleForm[] => {
  if (!Array.isArray(template)) return [];

  return template
    .map((item, index) => {
      if (item && typeof item === "object") {
        const typed = item as Record<string, unknown>;
        return {
          id: createRuleId() || `rule-${index}`,
          part: typeof typed.part === "string" ? typed.part : "",
          min: typed.min != null ? String(typed.min) : "",
          max: typed.max != null ? String(typed.max) : "",
          required: typeof typed.required === "boolean" ? typed.required : true,
        };
      }
      return null;
    })
    .filter(Boolean) as SelectionTemplateRuleForm[];
};

export const normalizeSelectionTemplate = (rules: SelectionTemplateRuleForm[]) => {
  const clampNumber = (value: string) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const cleaned = rules
    .map((rule) => {
      const part = rule.part.trim();
      const min = clampNumber(rule.min);
      const max = clampNumber(rule.max);
      const normalizedMax = max != null && min != null && max < min ? min : max;
      return {
        part,
        min,
        max: normalizedMax,
        required: Boolean(rule.required),
      };
    })
    .filter((rule) => rule.part || rule.min !== null || rule.max !== null);

  return cleaned.length > 0 ? cleaned : null;
};

interface SelectionTemplateEditorProps {
  rules: SelectionTemplateRuleForm[];
  onChange: (rules: SelectionTemplateRuleForm[]) => void;
}

const SelectionTemplateEditor = ({ rules, onChange }: SelectionTemplateEditorProps) => {
  const { t } = useFormsTranslation();

  const handleUpdateRule = (id: string, updates: Partial<SelectionTemplateRuleForm>) => {
    onChange(
      rules.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule))
    );
  };

  const handleRemoveRule = (id: string) => {
    onChange(rules.filter((rule) => rule.id !== id));
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("service.selection_template.empty_state")}
        </p>
      ) : (
        <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-white/80 shadow-xs">
          {rules.map((rule, index) => {
            const isFirst = index === 0;
            const minLabel = t("service.selection_template.min_helper", { defaultValue: "En az" });
            const maxLabel = t("service.selection_template.max_helper", { defaultValue: "En fazla" });
            const showMinHelper = isFirst && Boolean(rule.min);
            const showMaxHelper = isFirst && Boolean(rule.max);

            return (
              <div
                key={rule.id}
                className={cn(
                  "grid w-full gap-2 p-3 sm:grid-cols-[80px,minmax(0,1fr),90px,90px,90px,40px] sm:items-center",
                  isFirst && "pt-5"
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("service.selection_template.rule_label", { index: index + 1 })}
                </span>
                <div className={cn("flex w-full flex-col", isFirst ? "gap-1" : "gap-0")}>
                  {isFirst ? (
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {t("service.selection_template.part_helper", {
                        defaultValue: "Müşterinin göreceği başlık",
                      })}
                    </p>
                  ) : null}
                  <Input
                    className={cn("h-8 w-full text-sm", isFirst && "mt-1")}
                    value={rule.part}
                    onChange={(event) =>
                      handleUpdateRule(rule.id, { part: event.target.value })
                    }
                    placeholder={t("service.selection_template.part_placeholder")}
                    aria-label={t("service.selection_template.part_label")}
                  />
                </div>
                <div className={cn("flex w-full flex-col", showMinHelper ? "gap-1" : "gap-0")}>
                  {showMinHelper ? (
                    <p className="text-[11px] leading-tight text-muted-foreground">{minLabel}</p>
                  ) : null}
                  <Input
                    className={cn("h-8 w-full text-sm", showMinHelper && "mt-1")}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rule.min}
                    onChange={(event) =>
                      handleUpdateRule(rule.id, { min: event.target.value })
                    }
                    placeholder={minLabel}
                    aria-label={minLabel}
                  />
                </div>
                <div className={cn("flex w-full flex-col", showMaxHelper ? "gap-1" : "gap-0")}>
                  {showMaxHelper ? (
                    <p className="text-[11px] leading-tight text-muted-foreground">{maxLabel}</p>
                  ) : null}
                  <Input
                    className={cn("h-8 w-full text-sm", showMaxHelper && "mt-1")}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rule.max}
                    onChange={(event) =>
                      handleUpdateRule(rule.id, { max: event.target.value })
                    }
                    placeholder={maxLabel}
                    aria-label={maxLabel}
                  />
                </div>
                <label
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-1 whitespace-nowrap",
                    isFirst && "mt-5"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                    checked={rule.required}
                    onChange={(event) =>
                      handleUpdateRule(rule.id, { required: event.target.checked })
                    }
                    aria-label={t("service.selection_template.required_label")}
                  />
                  <span className="text-xs text-muted-foreground">
                    {rule.required
                      ? t("service.selection_template.required_on")
                      : t("service.selection_template.required_off")}
                  </span>
                </label>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveRule(rule.id)}
                    aria-label={t("service.selection_template.remove_rule_aria")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface SelectionTemplateSectionProps {
  enabled: boolean;
  onToggleRequest?: (enabled: boolean) => void;
  rules: SelectionTemplateRuleForm[];
  onRulesChange: (rules: SelectionTemplateRuleForm[]) => void;
  tone?: "indigo" | "emerald";
  className?: string;
  variant?: "default" | "unstyled";
  showHeader?: boolean;
  showToggle?: boolean;
  titleOverride?: string;
  descriptionOverride?: string;
  showAddButton?: boolean;
}

export function SelectionTemplateSection({
  enabled,
  onToggleRequest,
  rules,
  onRulesChange,
  tone = "indigo",
  className,
  variant = "default",
  showHeader = true,
  showToggle = true,
  titleOverride,
  descriptionOverride,
  showAddButton = true,
}: SelectionTemplateSectionProps) {
  const { t } = useFormsTranslation();
  const palette =
    tone === "emerald"
      ? {
          border: "border-emerald-200",
          background: "bg-emerald-50/40",
          addButton:
            "border-emerald-300 text-emerald-700 bg-white hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800",
        }
      : {
          border: "border-indigo-200",
          background: "bg-indigo-50/40",
          addButton:
            "border-indigo-300 text-indigo-700 bg-white hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800",
        };

  const handleAddRule = () => {
    onRulesChange([...rules, createEmptyRule()]);
  };

  return (
    <div
      className={cn(
        "space-y-3",
        variant === "default" && "rounded-xl border p-4",
        variant === "default" && palette.border,
        variant === "default" && palette.background,
        className
      )}
    >
      {showHeader ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {titleOverride ?? t("service.selection_template.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {descriptionOverride ?? t("service.selection_template.description")}
            </p>
          </div>
          {onToggleRequest && showToggle ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {enabled
                  ? t("service.selection_template.toggle_on")
                  : t("service.selection_template.toggle_off")}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={onToggleRequest}
                aria-label={t("service.selection_template.toggle_label")}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {enabled ? (
        <div className="space-y-3 pt-1">
          {showAddButton ? (
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddRule}
                className={cn("gap-2", palette.addButton)}
              >
                <Plus className="h-4 w-4" />
                {t("service.selection_template.add_rule")}
              </Button>
            </div>
          ) : null}
          <SelectionTemplateEditor rules={rules} onChange={onRulesChange} />
        </div>
      ) : null}
    </div>
  );
}
