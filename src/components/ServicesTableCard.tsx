import { cn } from "@/lib/utils";

export interface ServicesTableRow {
  id: string;
  name: string;
  vendor?: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  isCustom?: boolean;
}

export interface ServicesTableTotals {
  cost?: number | null;
  price?: number | null;
  margin?: number | null;
}

export interface ServicesTableLabels {
  columns: {
    name: string;
    vendor: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  };
  totals?: {
    cost: string;
    price: string;
    margin: string;
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

  const costLabel = totals?.cost ?? null;
  const priceLabel = totals?.price ?? null;
  const marginValue = totals?.margin ?? null;

  const marginTone =
    marginValue === null ? "text-slate-900" : marginValue >= 0 ? "text-emerald-600" : "text-destructive";

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
              <th className="px-4 py-3 text-left font-semibold">{labels.columns.vendor}</th>
              <th className="px-4 py-3 text-right font-semibold">{labels.columns.quantity}</th>
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
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-slate-900">{row.name}</div>
                  {row.isCustom && labels.customTag ? (
                    <div className="text-xs text-muted-foreground">{labels.customTag}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                  {row.vendor ?? labels.customVendorFallback}
                </td>
                <td className="px-4 py-3 align-top text-right font-medium text-slate-900">
                  {row.quantity}
                </td>
                <td className="px-4 py-3 align-top text-right text-sm text-slate-700">
                  {row.unitPrice === null ? "—" : formatCurrency(row.unitPrice)}
                </td>
                <td className="px-4 py-3 align-top text-right font-semibold text-slate-900">
                  {row.lineTotal === null ? "—" : formatCurrency(row.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totals ? (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/80 p-4 text-sm sm:grid-cols-3">
          {typeof costLabel === "number" ? (
            <div className="font-medium text-slate-900">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                {labels.totals?.cost}
              </span>
              <span>{formatCurrency(costLabel)}</span>
            </div>
          ) : null}
          {typeof priceLabel === "number" ? (
            <div className="font-medium text-slate-900">
              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                {labels.totals?.price}
              </span>
              <span>{formatCurrency(priceLabel)}</span>
            </div>
          ) : null}
          {marginValue !== null ? (
            <div className={cn("font-semibold", marginTone)}>
              <span className="block text-xs uppercase tracking-wide text-muted-foreground text-slate-600">
                {labels.totals?.margin}
              </span>
              <span>{formatCurrency(marginValue)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
