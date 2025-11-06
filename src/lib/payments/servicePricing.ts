export type VatMode = "inclusive" | "exclusive";

export interface VatTotals {
  net: number;
  vat: number;
  gross: number;
}

export interface ServicePricingInput {
  unitPrice?: number | null;
  quantity?: number | null;
  vatRate?: number | null;
  vatMode?: VatMode | null;
}

export const DEFAULT_VAT_TOTALS: VatTotals = { net: 0, vat: 0, gross: 0 };

export const computeServiceTotals = ({
  unitPrice,
  quantity = 1,
  vatRate = 0,
  vatMode = "inclusive",
}: ServicePricingInput): VatTotals => {
  const priceValue = Number(unitPrice ?? 0);
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    return DEFAULT_VAT_TOTALS;
  }

  const count = Number(quantity ?? 1);
  if (!Number.isFinite(count) || count <= 0) {
    return DEFAULT_VAT_TOTALS;
  }

  const sanitizedVatRate = Number(vatRate ?? 0);
  if (!Number.isFinite(sanitizedVatRate) || sanitizedVatRate <= 0) {
    const gross = priceValue * count;
    return {
      net: gross,
      vat: 0,
      gross,
    };
  }

  const fraction = sanitizedVatRate / 100;
  if (vatMode === "exclusive") {
    const gross = priceValue * (1 + fraction);
    return {
      net: priceValue * count,
      vat: (gross - priceValue) * count,
      gross: gross * count,
    };
  }

  const vatPortion = priceValue - priceValue / (1 + fraction);
  const net = priceValue - vatPortion;
  return {
    net: net * count,
    vat: vatPortion * count,
    gross: priceValue * count,
  };
};
