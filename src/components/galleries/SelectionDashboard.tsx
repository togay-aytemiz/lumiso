import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, CheckCircle2, Heart, LayoutGrid, ListChecks } from "lucide-react";

export interface SelectionRule {
  id: string;
  title: string;
  minCount: number;
  maxCount: number | null;
  currentCount: number;
  serviceName?: string | null;
}

export const FAVORITES_FILTER_ID = "favorites";

interface SelectionDashboardProps {
  rules: SelectionRule[];
  favoritesCount: number;
  totalPhotos: number;
  totalSelected: number;
  activeRuleId: string | null;
  onSelectRuleFilter: (id: string | null) => void;
  onEditRules?: () => void;
}

export function SelectionDashboard({
  rules,
  favoritesCount,
  totalPhotos,
  totalSelected,
  activeRuleId,
  onSelectRuleFilter,
  onEditRules,
}: SelectionDashboardProps) {
  const resolvedRules = rules ?? [];

  const getRuleStatus = (rule: SelectionRule) => {
    if (rule.minCount <= 0) {
      return { text: "Seçim uygun", tone: "success" as const };
    }
    if (rule.currentCount >= rule.minCount) {
      return { text: "Seçim uygun", tone: "success" as const };
    }
    return { text: `${rule.minCount - rule.currentCount} tane daha`, tone: "warning" as const };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
          Seçim Özeti
        </h2>
        {onEditRules ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-medium text-primary hover:text-primary"
            onClick={onEditRules}
          >
            Seçim Kurallarını Düzenle
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
          type="button"
          onClick={() => onSelectRuleFilter(null)}
          className={cn(
            "group relative flex min-h-[96px] flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
            activeRuleId === null
              ? "border-slate-900 bg-slate-900 text-white shadow-md"
              : "border-border/70 bg-white hover:border-border hover:shadow-sm"
          )}
        >
          <div className="mb-2 flex items-start gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                activeRuleId === null ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"
              )}
            >
              <LayoutGrid size={16} />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-xs font-semibold",
                  activeRuleId === null ? "text-slate-100" : "text-slate-900"
                )}
              >
                Genel Bakış
              </p>
              <p
                className={cn(
                  "truncate text-[10px] font-medium",
                  activeRuleId === null ? "text-slate-400" : "text-slate-500"
                )}
              >
                Tüm Galeri
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-xl font-bold leading-none",
                  activeRuleId === null ? "text-white" : "text-slate-900"
                )}
              >
                {totalPhotos}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  activeRuleId === null ? "text-slate-400" : "text-slate-500"
                )}
              >
                fotoğraf
              </span>
            </div>
            <span
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold",
                activeRuleId === null ? "bg-slate-800 text-emerald-400" : "bg-emerald-50 text-emerald-700"
              )}
            >
              <Check size={12} strokeWidth={3} />
              {totalSelected} Seçili
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectRuleFilter(FAVORITES_FILTER_ID)}
          className={cn(
            "flex min-h-[96px] flex-col justify-between rounded-xl border bg-rose-50/60 p-3 text-left transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2",
            activeRuleId === FAVORITES_FILTER_ID
              ? "border-rose-300 ring-1 ring-rose-300"
              : "border-rose-100 hover:border-rose-200"
          )}
        >
          <div className="mb-2 flex items-start gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 text-rose-600">
              <Heart size={16} fill="currentColor" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">Favoriler</p>
              <p className="truncate text-[10px] font-medium text-slate-500">Müşteri beğenileri</p>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold leading-none text-rose-600">{favoritesCount}</span>
              <span className="text-[11px] font-medium text-slate-400">adet</span>
            </div>
          </div>
        </button>

        {resolvedRules.map((rule) => {
          const ruleStatus = getRuleStatus(rule);
          const effectiveMax = rule.maxCount ?? rule.minCount;
          const progressPercent =
            rule.minCount > 0 ? Math.min(100, (rule.currentCount / rule.minCount) * 100) : 100;

          return (
            <button
              key={rule.id}
              type="button"
              onClick={() => onSelectRuleFilter(rule.id)}
              className={cn(
                "group relative flex min-h-[96px] flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                activeRuleId === rule.id
                  ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500"
                  : "border-border/70 bg-white hover:border-border hover:shadow-sm"
              )}
            >
              <div className="mb-2 flex items-start gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md",
                    ruleStatus.tone === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <ListChecks size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900" title={rule.title}>
                    {rule.title}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[10px] font-medium",
                      ruleStatus.tone === "success" ? "text-emerald-600" : "text-amber-700"
                    )}
                  >
                    {ruleStatus.text}
                  </p>
                  {rule.serviceName ? (
                    <p className="truncate text-[10px] text-slate-400">{rule.serviceName}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-end justify-between">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={cn(
                        "text-xl font-bold leading-none",
                        ruleStatus.tone === "success" ? "text-emerald-700" : "text-slate-900"
                      )}
                    >
                      {rule.currentCount}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {effectiveMax === rule.minCount
                        ? `/${rule.minCount}`
                        : `/${rule.minCount}-${effectiveMax}`}
                    </span>
                  </div>
                  {ruleStatus.tone === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : null}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      ruleStatus.tone === "success" ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {resolvedRules.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          Bu galeride henüz seçim kuralı yok. Seçim Kurallarını Düzenle butonuyla ekleyin.
        </p>
      ) : null}
    </div>
  );
}
