export const PAYMENT_COLORS = {
  paid: {
    hex: "#16a34a", // tailwind emerald-600
    textClass: "text-emerald-600",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50",
  },
  due: {
    hex: "#ea580c", // tailwind orange-600
    textClass: "text-orange-600",
    badgeClass:
      "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-50",
  },
} as const;

export type PaymentStatusColorKey = keyof typeof PAYMENT_COLORS;
