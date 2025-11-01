export type VatMode = "inclusive" | "exclusive";

const clampRate = (rate: number): number => {
  if (!Number.isFinite(rate) || Number.isNaN(rate)) {
    return 0;
  }
  if (rate <= 0) return 0;
  if (rate >= 100) return 99.99;
  return Number(rate);
};

export const normalizeVatInput = (
  rate: number | null | undefined,
  mode: VatMode | null | undefined
): { rate: number; mode: VatMode } => {
  const normalizedRate = rate == null ? 0 : clampRate(rate);
  const normalizedMode: VatMode =
    mode === "inclusive" || mode === "exclusive" ? mode : "exclusive";
  return { rate: normalizedRate, mode: normalizedMode };
};

export const calculateVatPortion = (
  amount: number,
  rate: number | null | undefined,
  mode: VatMode | null | undefined
): number => {
  const { rate: normalizedRate, mode: normalizedMode } = normalizeVatInput(rate, mode);
  if (!Number.isFinite(amount) || normalizedRate <= 0) {
    return 0;
  }

  const fraction = normalizedRate / 100;
  if (normalizedMode === "inclusive") {
    return amount - amount / (1 + fraction);
  }

  return amount * fraction;
};

export const applyVat = (
  amount: number,
  rate: number | null | undefined,
  mode: VatMode | null | undefined
): { total: number; vatPortion: number } => {
  if (!Number.isFinite(amount)) {
    return { total: 0, vatPortion: 0 };
  }

  const vatPortion = calculateVatPortion(amount, rate, mode);
  const normalizedMode: VatMode =
    mode === "inclusive" || mode === "exclusive" ? mode : "exclusive";

  if (normalizedMode === "inclusive") {
    return { total: amount, vatPortion };
  }

  return { total: amount + vatPortion, vatPortion };
};
