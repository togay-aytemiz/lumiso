import { useMemo } from "react";
import type { AdvancedTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { PAYMENT_COLORS } from "@/lib/paymentColors";
import type { Payment } from "../types";
import { useTranslation } from "react-i18next";

interface UsePaymentsTableColumnsOptions {
  onProjectSelect: (payment: Payment) => void;
  onNavigateToLead: (leadId: string) => void;
  formatAmount: (value: number) => string;
}

export function usePaymentsTableColumns({
  onProjectSelect,
  onNavigateToLead,
  formatAmount,
}: UsePaymentsTableColumnsOptions): AdvancedTableColumn<Payment>[] {
  const { t } = useTranslation("pages");

  return useMemo<AdvancedTableColumn<Payment>[]>(
    () => [
      {
        id: "date_paid",
        label: t("payments.table.date"),
        sortable: true,
        sortId: "date_paid",
        hideable: false,
        minWidth: "140px",
        render: (row) => formatDate(row.log_timestamp ?? row.date_paid ?? row.created_at),
      },
      {
        id: "lead",
        label: t("payments.table.lead"),
        sortable: true,
        sortId: "lead_name",
        hideable: true,
        minWidth: "180px",
        render: (row) =>
          row.projects?.leads ? (
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.stopPropagation();
                if (row.projects?.leads?.id) {
                  onNavigateToLead(row.projects.leads.id);
                }
              }}
            >
              {row.projects.leads.name}
            </Button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "project",
        label: t("payments.table.project"),
        sortable: true,
        sortId: "project_name",
        hideable: true,
        minWidth: "200px",
        render: (row) =>
          row.projects ? (
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onProjectSelect(row);
              }}
            >
              {row.projects.name}
            </Button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "amount",
        label: t("payments.table.amount"),
        sortable: true,
        sortId: "amount",
        align: "right",
        minWidth: "140px",
        render: (row) => {
          const amountValue = Number(row.amount);
          const entryKind = row.entry_kind ?? "recorded";
          const scheduledRemaining = Number(
            row.scheduled_remaining_amount ?? row.amount ?? 0
          );
          if (entryKind === "scheduled") {
            return (
              <span className="tabular-nums font-semibold text-muted-foreground">
                {formatAmount(Math.max(scheduledRemaining, 0))}
              </span>
            );
          }
          const isRefund = Number.isFinite(amountValue) && amountValue < 0;
          if (isRefund) {
            return (
              <span className="tabular-nums font-semibold text-destructive">
                -{formatAmount(Math.abs(amountValue))}
              </span>
            );
          }
          return <span className="tabular-nums">{formatAmount(amountValue)}</span>;
        },
      },
      {
        id: "description",
        label: t("payments.table.description"),
        sortable: true,
        sortId: "description",
        hideable: true,
        minWidth: "180px",
        render: (row) => (row.description && row.description.trim() !== "" ? row.description : "-"),
      },
      {
        id: "status",
        label: t("payments.table.status"),
        sortable: true,
        sortId: "status",
        hideable: true,
        minWidth: "160px",
        render: (row) => {
          const amountValue = Number(row.amount);
          const entryKind = row.entry_kind ?? "recorded";
          const isRefund = entryKind === "recorded" && Number.isFinite(amountValue) && amountValue < 0;
          const isPaid = (row.status || "").toLowerCase() === "paid";
          const badgeConfig = isRefund
            ? PAYMENT_COLORS.refund
            : isPaid
              ? PAYMENT_COLORS.paid
              : PAYMENT_COLORS.due;
          const statusLabel = isRefund
            ? t("payments.refund.badge", { defaultValue: "İade" })
            : isPaid
              ? t("payments.status.paid")
              : t("payments.status.due");

          return (
            <Badge
              variant="outline"
              className={cn("px-2 py-0.5 text-xs font-semibold", badgeConfig.badgeClass)}
            >
              {statusLabel}
            </Badge>
          );
        },
      },
      {
        id: "type",
        label: t("payments.table.type"),
        sortable: true,
        sortId: "type",
        hideable: true,
        minWidth: "120px",
        render: (row) => (
          <Badge variant="outline">
            {row.entry_kind === "scheduled"
              ? t("payments.type.scheduled")
              : row.type === "deposit_payment"
                ? t("payments.type.deposit")
                : row.type === "balance_due"
                  ? t("payments.type.balance")
                  : t("payments.type.manual")}
          </Badge>
        ),
      },
    ],
    [formatAmount, onNavigateToLead, onProjectSelect, t]
  );
}
