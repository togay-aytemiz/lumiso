import type { Database } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

type PaymentSummarySource = Partial<
  Pick<
    PaymentRow,
    "amount" | "status" | "entry_kind" | "scheduled_initial_amount" | "scheduled_remaining_amount"
  >
>;

export interface PaymentSummaryMetrics {
  totalPaid: number;
  totalInvoiced: number;
  totalRefunded: number;
  remainingBalance: number;
  collectionRate: number;
  netCollected: number;
}

const normalizeAmount = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isScheduledEntry = (payment: PaymentSummarySource): boolean =>
  (payment.entry_kind ?? "recorded") === "scheduled";

export function computePaymentSummaryMetrics<T extends PaymentSummarySource>(
  payments: T[]
): PaymentSummaryMetrics {
  const recordedEntries = payments.filter((payment) => !isScheduledEntry(payment));
  const scheduledEntries = payments.filter(isScheduledEntry);

  const totalPaid = recordedEntries
    .filter(
      (payment) =>
        (payment.status || "").toLowerCase() === "paid" && normalizeAmount(payment.amount) > 0
    )
    .reduce((sum, payment) => sum + normalizeAmount(payment.amount), 0);

  const totalRefunded = recordedEntries
    .filter((payment) => normalizeAmount(payment.amount) < 0)
    .reduce((sum, payment) => sum + Math.abs(normalizeAmount(payment.amount)), 0);

  const manualDueTotal = recordedEntries
    .filter((payment) => (payment.status || "").toLowerCase() !== "paid")
    .reduce((sum, payment) => sum + normalizeAmount(payment.amount), 0);

  const scheduledInitialTotal = scheduledEntries.reduce(
    (sum, payment) =>
      sum + normalizeAmount(payment.scheduled_initial_amount ?? payment.amount ?? 0),
    0
  );

  const totalInvoiced = scheduledInitialTotal + manualDueTotal;
  const netCollected = Math.max(totalPaid - totalRefunded, 0);
  const remainingBalance = Math.max(totalInvoiced - netCollected, 0);
  const collectionRate = totalInvoiced > 0 ? netCollected / totalInvoiced : 0;

  return {
    totalPaid,
    totalInvoiced,
    totalRefunded,
    remainingBalance,
    collectionRate,
    netCollected,
  };
}
