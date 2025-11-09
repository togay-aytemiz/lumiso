export const PAYMENT_COLORS = {
  paid: {
    hex: "#16a34a", // tailwind emerald-600
    textClass: "text-emerald-600",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50",
  },
  due: {
    hex: "#475569", // tailwind slate-600
    textClass: "text-slate-600",
    badgeClass:
      "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-50",
  },
  refund: {
    hex: "#dc2626", // tailwind red-600
    textClass: "text-destructive",
    badgeClass:
      "bg-destructive/5 text-destructive border border-destructive/40 hover:bg-destructive/10",
  },
} as const;

export type PaymentStatusColorKey = keyof typeof PAYMENT_COLORS;
