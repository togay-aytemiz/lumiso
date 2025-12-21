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

export const deserializeSelectionTemplate = (
  template: unknown
): SelectionTemplateRuleForm[] => {
  if (!Array.isArray(template)) return [];

  return template
    .map((item, index) => {
      if (item && typeof item === "object") {
        const typed = item as Record<string, unknown>;
        const part = typeof typed.part === "string" ? typed.part : "";
        const storedId = typeof typed.id === "string" ? typed.id.trim() : "";
        const legacyId = part.trim() ? part.trim().toLowerCase() : "";

        return {
          id: storedId || legacyId || createRuleId() || `rule-${index}`,
          part,
          min: typed.min != null ? String(typed.min) : "",
          max: typed.max != null ? String(typed.max) : "",
          required: typeof typed.required === "boolean" ? typed.required : true,
        };
      }
      return null;
    })
    .filter(Boolean) as SelectionTemplateRuleForm[];
};

export const normalizeSelectionTemplate = (
  rules: SelectionTemplateRuleForm[]
) => {
  const clampNumber = (value: string) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const cleaned = rules
    .map((rule) => {
      const part = rule.part.trim();
      const id = rule.id.trim().toLowerCase() || createRuleId();
      const min = clampNumber(rule.min);
      const max = clampNumber(rule.max);
      const normalizedMax = max != null && min != null && max < min ? min : max;
      return {
        id,
        part,
        min,
        max: normalizedMax,
        required: Boolean(rule.required),
      };
    })
    .filter((rule) => rule.part || rule.min !== null || rule.max !== null);

  return cleaned.length > 0 ? cleaned : null;
};
