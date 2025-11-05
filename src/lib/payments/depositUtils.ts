import type { Json } from "@/integrations/supabase/types";

export type DepositMode = "none" | "fixed" | "percent_base" | "percent_total";

export interface ProjectDepositConfig {
  mode: DepositMode;
  value: number | null;
  description?: string | null;
  due_label?: string | null;
}

export interface DepositComputationContext {
  basePrice: number;
  extrasTotal: number;
  contractTotal?: number;
}

const ROUND_FACTOR = 100;

const roundCurrency = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * ROUND_FACTOR) / ROUND_FACTOR;

export const DEFAULT_DEPOSIT_CONFIG: ProjectDepositConfig = {
  mode: "none",
  value: null,
};

export const parseDepositConfig = (raw: Json | null | undefined): ProjectDepositConfig => {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_DEPOSIT_CONFIG;
  }

  const record = raw as Record<string, unknown>;
  const rawMode = record.mode;
  const mode: DepositMode =
    rawMode === "fixed" || rawMode === "percent_base" || rawMode === "percent_total"
      ? rawMode
      : "none";

  const rawValue = record.value;
  const value =
    typeof rawValue === "number"
      ? rawValue
      : Number.isFinite(Number(rawValue))
      ? Number(rawValue)
      : null;

  const description =
    typeof record.description === "string" ? record.description : undefined;
  const dueLabel =
    typeof record.due_label === "string" ? record.due_label : undefined;

  if (mode === "none") {
    return { ...DEFAULT_DEPOSIT_CONFIG, description, due_label: dueLabel };
  }

  return {
    mode,
    value: value ?? 0,
    description,
    due_label: dueLabel,
  };
};

export const computeDepositAmount = (
  config: ProjectDepositConfig,
  context: DepositComputationContext
): number => {
  const { basePrice, extrasTotal, contractTotal } = context;
  if (!config || config.mode === "none") {
    return 0;
  }

  const normalizedValue = Number.isFinite(config.value ?? NaN)
    ? Number(config.value)
    : 0;

  const safeBase = Math.max(0, Number(basePrice) || 0);
  const safeExtras = Math.max(0, Number(extrasTotal) || 0);
  const safeTotal =
    contractTotal != null
      ? Math.max(0, Number(contractTotal) || 0)
      : safeBase + safeExtras;

  if (config.mode === "fixed") {
    return roundCurrency(Math.min(normalizedValue, safeTotal));
  }

  if (!(normalizedValue > 0)) {
    return 0;
  }

  const fraction = normalizedValue / 100;

  if (config.mode === "percent_base") {
    if (safeBase <= 0) {
      return 0;
    }
    return roundCurrency(Math.min(safeBase * fraction, safeTotal));
  }

  if (safeTotal <= 0) {
    return 0;
  }

  return roundCurrency(Math.min(safeTotal * fraction, safeTotal));
};

