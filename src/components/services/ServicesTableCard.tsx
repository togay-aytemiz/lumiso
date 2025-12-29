import { cn } from "@/lib/utils";

export interface ServicesTableRow {
  id: string;
  name: string;
  vendor?: string | null;
  quantity: number;
  unitLabel?: string | null;
  lineCost?: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  isCustom?: boolean;
}

export interface ServicesTableTotals {
  cost?: number | null;
  price?: number | null;
  vat?: number | null;
  total?: number | null;
  margin?: number | null;
}

export interface ServicesTableLabels {
  columns: {
    name: string;
    quantity: string;
    cost?: string;
    unitPrice: string;
    lineTotal: string;
  };
  totals?: {
    cost?: string;
    price?: string;
    vat?: string;
    total?: string;
    margin?: string;
  };
  customTag?: string;
  customVendorFallback: string;
}

interface ServicesTableCardProps {
  rows: ServicesTableRow[];
  totals?: ServicesTableTotals;
  labels: ServicesTableLabels;
  emptyMessage: string;
  formatCurrency(value: number): string;
  className?: string;
}

export function ServicesTableCard({
  rows,
  totals,
  labels,
  emptyMessage,
  formatCurrency,
  className,
}: ServicesTableCardProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const showCostColumn = Boolean(labels.columns.cost);
  const costLabel = totals?.cost ?? null;
  const priceLabel = totals?.price ?? null;
  const vatLabel = totals?.vat ?? null;
  const totalLabel = totals?.total ?? null;
  const marginValue = totals?.margin ?? null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm transition-all duration-200 hover:shadow-md",
        className
      )}
    >
      <div className="overflow-x-auto transition-[max-height] duration-300 ease-out">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">{labels.columns.name}</th>
              <th className="px-4 py-3 text-right font-semibold">{labels.columns.quantity}</th>
              {showCostColumn ? (
                <th className="px-4 py-3 text-right font-semibold">{labels.columns.cost}</th>
              ) : null}
              <th className="px-4 py-3 text-right font-semibold">{labels.columns.unitPrice}</th>
              <th className="px-4 py-3 text-right font-semibold">{labels.columns.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-slate-100 transition-colors duration-200",
                  index % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                )}
              >
                <td className="px-4 py-3 align-middle">
                  <div className="font-medium text-slate-900">{row.name}</div>
                  {row.vendor || row.isCustom ? (
                    <div className="text-xs text-muted-foreground">
                      {row.vendor ? row.vendor : labels.customVendorFallback}
                    </div>
                  ) : null}
                  {row.isCustom && labels.customTag ? (
                    <div className="text-xs text-muted-foreground">{labels.customTag}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-middle text-right font-medium text-slate-900">
                  {row.quantity}
                </td>
                {showCostColumn ? (
                  <td className="px-4 py-3 align-middle text-right text-sm text-slate-700">
                    {row.lineCost === null || row.lineCost === undefined
                      ? "—"
                      : formatCurrency(row.lineCost)}
                  </td>
                ) : null}
                <td className="px-4 py-3 align-middle text-right text-sm text-slate-700">
                  {row.unitPrice === null ? "—" : formatCurrency(row.unitPrice)}
                </td>
                <td className="px-4 py-3 align-middle text-right font-semibold text-slate-900">
                  {row.lineTotal === null ? "—" : formatCurrency(row.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totals ? (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/80 p-4 text-sm sm:grid-cols-2 md:grid-cols-4">
          {typeof costLabel === "number" && labels.totals?.cost ? (
            <div className="font-medium text-slate-900">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                {labels.totals.cost}
              </span>
              <span>{formatCurrency(costLabel)}</span>
            </div>
          ) : null}
          {typeof priceLabel === "number" && labels.totals?.price ? (
            <div className="font-medium text-slate-900">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                {labels.totals.price}
              </span>
              <span>{formatCurrency(priceLabel)}</span>
            </div>
          ) : null}
          {typeof vatLabel === "number" && labels.totals?.vat ? (
            <div className="font-medium text-slate-900">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                {labels.totals.vat}
              </span>
              <span>{formatCurrency(vatLabel)}</span>
            </div>
          ) : null}
          {typeof totalLabel === "number" && labels.totals?.total ? (
            <div className="font-medium text-slate-900">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                {labels.totals.total}
              </span>
              <span>{formatCurrency(totalLabel)}</span>
            </div>
          ) : null}
          {marginValue !== null && labels.totals?.margin ? (
            <div
              className={cn(
                "font-semibold",
                marginValue >= 0 ? "text-emerald-600" : "text-destructive"
              )}
            >
              <span className="block text-xs uppercase tracking-wide text-muted-foreground text-slate-600">
                {labels.totals.margin}
              </span>
              <span>{formatCurrency(marginValue)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
