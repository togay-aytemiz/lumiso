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
        render: (row) => formatDate(row.date_paid || row.created_at),
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
              className="p-0 h-auto font-medium text-primary underline underline-offset-4 decoration-dashed"
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
              className="p-0 h-auto font-medium text-primary underline underline-offset-4 decoration-dashed"
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
        render: (row) => formatAmount(Number(row.amount)),
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
          const isPaid = (row.status || "").toLowerCase() === "paid";
          return (
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0.5 text-xs font-semibold",
                isPaid ? PAYMENT_COLORS.paid.badgeClass : PAYMENT_COLORS.due.badgeClass
              )}
            >
              {isPaid ? t("payments.status.paid") : t("payments.status.due")}
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
            {row.type === "base_price"
              ? t("payments.type.base")
              : row.type === "extra"
                ? t("payments.type.extra")
                : t("payments.type.manual")}
          </Badge>
        ),
      },
    ],
    [formatAmount, onNavigateToLead, onProjectSelect, t]
  );
}
