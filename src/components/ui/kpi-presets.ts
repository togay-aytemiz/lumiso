// Reusable styling presets for KPI cards and their gradient icon pills.
// Centralizes consistent proportions, glow, and contrast for use across pages.

export type KpiIconPreset =
  | "indigo"
  | "sky"
  | "emerald"
  | "blue"
  | "violet"
  | "fuchsia"
  | "pink"
  | "rose"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "teal"
  | "cyan"
  | "slate";

// Base classes applied to the icon wrapper and SVG for consistent sizing and legibility
export const KPI_ICON_BASE_CLASS =
  "inline-flex h-12 w-12 items-center justify-center rounded-full p-0 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/15 transition-all duration-300";

export const KPI_ICON_SVG_CLASS =
  "h-7 w-7 drop-shadow-[0_3px_8px_rgba(15,23,42,0.2)]";

// Subtle, rounded outline action used within KPI cards
export const KPI_ACTION_BUTTON_CLASS =
  "h-8 rounded-full border border-border/60 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";

// Color system for the gradient + glow. Each preset includes a light and dark gradient
// and a matching soft glow to reinforce the hue while keeping glyphs legible.
export const KPI_ICON_PRESETS: Record<
  KpiIconPreset,
  { iconBackground: string; glow: string; iconForeground?: string }
> = {
  indigo: {
    iconBackground:
      "bg-[linear-gradient(135deg,#c084fc,#6366f1)] dark:bg-[linear-gradient(135deg,#8b5cf6,#4338ca)]",
    glow:
      "shadow-[0_18px_35px_rgba(99,102,241,0.28)] dark:shadow-[0_18px_35px_rgba(99,102,241,0.45)]",
    iconForeground: "text-white",
  },
  blue: {
    iconBackground:
      "bg-[linear-gradient(135deg,#93c5fd,#3b82f6)] dark:bg-[linear-gradient(135deg,#2563eb,#1d4ed8)]",
    glow:
      "shadow-[0_18px_35px_rgba(59,130,246,0.28)] dark:shadow-[0_18px_35px_rgba(37,99,235,0.5)]",
    iconForeground: "text-white",
  },
  sky: {
    iconBackground:
      "bg-[linear-gradient(135deg,#60a5fa,#38bdf8)] dark:bg-[linear-gradient(135deg,#3b82f6,#0ea5e9)]",
    glow:
      "shadow-[0_18px_35px_rgba(56,189,248,0.28)] dark:shadow-[0_18px_35px_rgba(56,189,248,0.5)]",
    iconForeground: "text-white",
  },
  cyan: {
    iconBackground:
      "bg-[linear-gradient(135deg,#67e8f9,#06b6d4)] dark:bg-[linear-gradient(135deg,#0891b2,#164e63)]",
    glow:
      "shadow-[0_18px_35px_rgba(6,182,212,0.28)] dark:shadow-[0_18px_35px_rgba(8,145,178,0.5)]",
    iconForeground: "text-white",
  },
  emerald: {
    iconBackground:
      "bg-[linear-gradient(135deg,#6ee7b7,#34d399)] dark:bg-[linear-gradient(135deg,#34d399,#059669)]",
    glow:
      "shadow-[0_18px_35px_rgba(52,211,153,0.28)] dark:shadow-[0_18px_35px_rgba(16,185,129,0.5)]",
    iconForeground: "text-white",
  },
  teal: {
    iconBackground:
      "bg-[linear-gradient(135deg,#5eead4,#14b8a6)] dark:bg-[linear-gradient(135deg,#0d9488,#115e59)]",
    glow:
      "shadow-[0_18px_35px_rgba(20,184,166,0.28)] dark:shadow-[0_18px_35px_rgba(13,148,136,0.5)]",
    iconForeground: "text-white",
  },
  lime: {
    iconBackground:
      "bg-[linear-gradient(135deg,#a3e635,#84cc16)] dark:bg-[linear-gradient(135deg,#65a30d,#3f6212)]",
    glow:
      "shadow-[0_18px_35px_rgba(132,204,22,0.30)] dark:shadow-[0_18px_35px_rgba(101,163,13,0.5)]",
    iconForeground: "text-white",
  },
  yellow: {
    iconBackground:
      "bg-[linear-gradient(135deg,#fde047,#facc15)] dark:bg-[linear-gradient(135deg,#ca8a04,#854d0e)]",
    glow:
      "shadow-[0_18px_35px_rgba(250,204,21,0.32)] dark:shadow-[0_18px_35px_rgba(202,138,4,0.5)]",
    iconForeground: "text-slate-900 dark:text-slate-50",
  },
  amber: {
    iconBackground:
      "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] dark:bg-[linear-gradient(135deg,#d97706,#92400e)]",
    glow:
      "shadow-[0_18px_35px_rgba(245,158,11,0.32)] dark:shadow-[0_18px_35px_rgba(217,119,6,0.5)]",
    iconForeground: "text-white",
  },
  orange: {
    iconBackground:
      "bg-[linear-gradient(135deg,#fdba74,#f97316)] dark:bg-[linear-gradient(135deg,#ea580c,#9a3412)]",
    glow:
      "shadow-[0_18px_35px_rgba(249,115,22,0.30)] dark:shadow-[0_18px_35px_rgba(234,88,12,0.5)]",
    iconForeground: "text-white",
  },
  red: {
    iconBackground:
      "bg-[linear-gradient(135deg,#f87171,#ef4444)] dark:bg-[linear-gradient(135deg,#dc2626,#991b1b)]",
    glow:
      "shadow-[0_18px_35px_rgba(239,68,68,0.30)] dark:shadow-[0_18px_35px_rgba(220,38,38,0.5)]",
    iconForeground: "text-white",
  },
  rose: {
    iconBackground:
      "bg-[linear-gradient(135deg,#fda4af,#fb7185)] dark:bg-[linear-gradient(135deg,#e11d48,#9f1239)]",
    glow:
      "shadow-[0_18px_35px_rgba(251,113,133,0.30)] dark:shadow-[0_18px_35px_rgba(225,29,72,0.5)]",
    iconForeground: "text-white",
  },
  pink: {
    iconBackground:
      "bg-[linear-gradient(135deg,#f9a8d4,#f472b6)] dark:bg-[linear-gradient(135deg,#db2777,#9d174d)]",
    glow:
      "shadow-[0_18px_35px_rgba(244,114,182,0.30)] dark:shadow-[0_18px_35px_rgba(219,39,119,0.5)]",
    iconForeground: "text-white",
  },
  fuchsia: {
    iconBackground:
      "bg-[linear-gradient(135deg,#f0abfc,#e879f9)] dark:bg-[linear-gradient(135deg,#d946ef,#a21caf)]",
    glow:
      "shadow-[0_18px_35px_rgba(232,121,249,0.30)] dark:shadow-[0_18px_35px_rgba(217,70,239,0.5)]",
    iconForeground: "text-white",
  },
  violet: {
    iconBackground:
      "bg-[linear-gradient(135deg,#a78bfa,#8b5cf6)] dark:bg-[linear-gradient(135deg,#7c3aed,#5b21b6)]",
    glow:
      "shadow-[0_18px_35px_rgba(139,92,246,0.30)] dark:shadow-[0_18px_35px_rgba(124,58,237,0.5)]",
    iconForeground: "text-white",
  },
  slate: {
    iconBackground:
      "bg-[linear-gradient(135deg,#94a3b8,#64748b)] dark:bg-[linear-gradient(135deg,#334155,#0f172a)]",
    glow:
      "shadow-[0_18px_35px_rgba(100,116,139,0.28)] dark:shadow-[0_18px_35px_rgba(51,65,85,0.45)]",
    iconForeground: "text-white",
  },
};

// Convenience helper to compose icon props for <KpiCard />
export function getKpiIconPreset(preset: KpiIconPreset) {
  const p = KPI_ICON_PRESETS[preset];
  return {
    iconBackground: p.iconBackground,
    iconForeground: p.iconForeground ?? "text-white",
    iconClassName: `${KPI_ICON_BASE_CLASS} ${p.glow}`,
    iconSvgClassName: KPI_ICON_SVG_CLASS,
  } as const;
}
