import React from "react";
import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Timeframe = "month" | "year";
type ChipTone = "positive" | "neutral" | "negative";

interface StatCardChip {
  label: string;
  icon?: React.ReactNode;
  tone?: ChipTone;
}

interface StatCardProps {
  context: string;
  label: string;
  value: string;
  icon: LucideIcon;
  color?: "indigo" | "amber" | "violet" | "rose" | "blue";
  info?: string;
  chip?: StatCardChip;
  timeframe?: Timeframe;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  timeframeLabels?: {
    month: string;
    year: string;
    monthAria?: string;
    yearAria?: string;
  };
}

const COLOR_STYLES: Record<
  NonNullable<StatCardProps["color"]>,
  { bg: string; glow: string }
> = {
  indigo: { bg: "from-[#6283F5] via-[#4E6CF4] to-[#4D5FF0]", glow: "shadow-indigo-200/40" },
  blue: { bg: "from-[#4BA1FB] via-[#2D8CF6] to-[#2477EE]", glow: "shadow-sky-200/40" },
  amber: { bg: "from-[#FFBA42] via-[#FFA325] to-[#F18B00]", glow: "shadow-amber-200/40" },
  violet: { bg: "from-[#9F7BFF] via-[#8863F7] to-[#704FF0]", glow: "shadow-violet-200/40" },
  rose: { bg: "from-[#FF5E72] via-[#F94D64] to-[#E6384D]", glow: "shadow-rose-200/40" }
};

const CHIP_TONES: Record<ChipTone, string> = {
  positive: "bg-emerald-50/80 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-rose-50 text-rose-600"
};

const StatCard: React.FC<StatCardProps> = ({
  context,
  label,
  value,
  icon: Icon,
  color = "indigo",
  info,
  chip,
  timeframe,
  onTimeframeChange,
  timeframeLabels
}) => {
  const iconTheme = COLOR_STYLES[color] ?? COLOR_STYLES.indigo;
  const labels = timeframeLabels ?? {
    month: "M",
    year: "Y",
    monthAria: "Show month view",
    yearAria: "Show year view"
  };

  const renderToggleButton = (key: Timeframe, display: string) => {
    const isActive = timeframe === key;
    return (
      <button
        type="button"
        onClick={() => onTimeframeChange?.(key)}
        className={`h-[26px] w-[26px] rounded-full text-[11px] font-semibold transition-colors ${
          isActive
            ? "bg-white text-[#6F6FFB] shadow-sm"
            : "text-slate-400 hover:text-slate-600"
        }`}
        aria-pressed={isActive}
        aria-label={`Show ${display === "M" ? "month" : "year"} view`}
      >
        {display}
      </button>
    );
  };

  return (
    <div className="flex items-start gap-4 rounded-[24px] border border-white/75 bg-gradient-to-b from-white via-white to-[#F3F6FB] p-5 shadow-[0_20px_45px_rgba(20,35,70,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(20,35,70,0.16)]">
      <div
        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${iconTheme.bg} text-white shadow-lg ${iconTheme.glow}`}
      >
        <Icon className="h-7 w-7" strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {context}
          </span>
          {timeframe && onTimeframeChange && (
            <ToggleGroup
              type="single"
              value={timeframe}
              onValueChange={(next) => {
                if (!next) return;
                onTimeframeChange(next as Timeframe);
              }}
              className="inline-flex rounded-full bg-slate-100 p-0.5 text-slate-500 shadow-inner"
            >
              <ToggleGroupItem
                value="month"
                aria-label={labels.monthAria || "Show month view"}
                className={cn(
                  "h-6 min-w-[26px] rounded-full px-0 text-[11px] font-semibold",
                  "data-[state=on]:bg-white data-[state=on]:text-[#6F6FFB] data-[state=on]:shadow-sm",
                  "text-slate-500"
                )}
              >
                {labels.month}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="year"
                aria-label={labels.yearAria || "Show year view"}
                className={cn(
                  "h-6 min-w-[26px] rounded-full px-0 text-[11px] font-semibold",
                  "data-[state=on]:bg-white data-[state=on]:text-[#6F6FFB] data-[state=on]:shadow-sm",
                  "text-slate-500"
                )}
              >
                {labels.year}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        <div className="mb-1 flex items-center gap-1.5">
          <h3 className="text-[15px] font-semibold text-slate-800">{label}</h3>
          {info && (
            <HelpCircle
              className="h-3.5 w-3.5 text-slate-300"
              aria-label={info}
              title={info}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[34px] font-black leading-none tracking-tight text-slate-900">
            {value}
          </span>
          {chip && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                CHIP_TONES[chip.tone ?? "neutral"]
              }`}
            >
              {chip.icon}
              {chip.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
