import type { CSSProperties } from "react";

export interface BadgeColorTokens {
  color: string;
  background: string;
  hoverBackground: string;
  activeBackground: string;
  border: string;
  ring: string;
}

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

function normalizeHex(color: string): string {
  if (!color) return "#6B7280";

  if (HEX_COLOR_REGEX.test(color)) {
    const value = color.replace("#", "");
    if (value.length === 3) {
      const [r, g, b] = value;
      return `#${r}${r}${g}${g}${b}${b}`;
    }

    return `#${value}`;
  }

  // Already an 8-digit hex
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    return color;
  }

  // Fallback slate-500 if an unsupported format is provided
  return "#6B7280";
}

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = normalizeHex(hexColor);

  if (normalized.length === 9) {
    const base = `#${normalized.substring(1, 7)}`;
    return withAlpha(base, alpha);
  }

  const clamped = Math.min(Math.max(alpha, 0), 1);
  const alphaInt = Math.round(clamped * 255);
  const alphaHex = alphaInt.toString(16).padStart(2, "0");

  return `${normalized}${alphaHex}`;
}

export function getBadgeColorTokens(color: string): BadgeColorTokens {
  const base = normalizeHex(color);
  const textColor = base.length === 9 ? `#${base.substring(1, 7)}` : base;

  return {
    color: textColor,
    background: withAlpha(base, 0.12),
    hoverBackground: withAlpha(base, 0.18),
    activeBackground: withAlpha(base, 0.26),
    border: withAlpha(base, 0.38),
    ring: withAlpha(base, 0.45),
  };
}

export function getBadgeStyleProperties(color: string): {
  tokens: BadgeColorTokens;
  style: CSSProperties;
} {
  const tokens = getBadgeColorTokens(color);

  const style: CSSProperties = {
    "--badge-color": tokens.color,
    "--badge-hover-bg": tokens.hoverBackground,
    "--badge-active-bg": tokens.activeBackground,
    "--badge-ring": tokens.ring,
    backgroundColor: tokens.background,
    color: tokens.color,
    borderColor: tokens.border,
  };

  return { tokens, style };
}
