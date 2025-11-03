export type ServiceUnit = "item" | "session" | "hour" | "day";

export const DEFAULT_SERVICE_UNIT: ServiceUnit = "item";

export const SERVICE_UNIT_OPTIONS: { value: ServiceUnit; translationKey: string }[] = [
  { value: "item", translationKey: "steps.services.units.options.item" },
  { value: "session", translationKey: "steps.services.units.options.session" },
  { value: "hour", translationKey: "steps.services.units.options.hour" },
  { value: "day", translationKey: "steps.services.units.options.day" },
];

export const normalizeServiceUnit = (unit?: string | null): ServiceUnit => {
  if (!unit) return DEFAULT_SERVICE_UNIT;
  const normalized = unit.trim().toLowerCase();
  const match = SERVICE_UNIT_OPTIONS.find((option) => option.value === normalized);
  return match ? match.value : DEFAULT_SERVICE_UNIT;
};
