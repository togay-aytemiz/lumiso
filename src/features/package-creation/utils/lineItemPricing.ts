import { applyVat, normalizeVatInput } from "@/lib/accounting/vat";
import type { PackageCreationLineItem } from "../types";

export interface LineItemPricing {
  net: number;
  vat: number;
  gross: number;
}

export const calculateLineItemPricing = (item: PackageCreationLineItem): LineItemPricing => {
  const quantity = Math.max(1, item.quantity ?? 1);
  const unitPrice = Number(item.unitPrice ?? 0);
  const amount = unitPrice * quantity;

  const { rate, mode } = normalizeVatInput(item.vatRate ?? null, item.vatMode ?? "exclusive");

  if (!Number.isFinite(amount) || amount <= 0 || rate === 0) {
    return {
      net: Math.max(0, amount),
      vat: 0,
      gross: Math.max(0, amount),
    };
  }

  const { total, vatPortion } = applyVat(amount, rate, mode);
  const net = mode === "inclusive" ? total - vatPortion : amount;

  return {
    net: Math.max(0, net),
    vat: Math.max(0, vatPortion),
    gross: Math.max(0, total),
  };
};
