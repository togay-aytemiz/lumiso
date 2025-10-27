import { useMemo } from "react";

const CONNECTOR_WORDS = new Set([
  "and",
  "ve",
  "ile",
  "with",
  "und",
  "the",
  "of",
  "for",
  "da",
  "de",
  "del",
  "della",
  "van",
  "von",
  "bin",
  "al",
  "el",
  "&"
]);

const DEFAULT_MAX_INITIALS = 3;
const DEFAULT_FALLBACK = "??";

export interface LeadInitialsProps {
  name?: string | null;
  fallback?: string;
  maxInitials?: number;
}

export const computeLeadInitials = (
  name?: string | null,
  fallback: string = DEFAULT_FALLBACK,
  maxInitials: number = DEFAULT_MAX_INITIALS
) => {
  if (maxInitials <= 0) {
    return fallback;
  }

  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    return fallback;
  }

  const tokens = trimmed.match(/\p{L}+/gu) ?? [];
  const meaningfulTokens = tokens.filter(
    (token) => !CONNECTOR_WORDS.has(token.toLowerCase())
  );
  const candidates =
    meaningfulTokens.length > 0 ? meaningfulTokens : tokens;

  if (candidates.length === 0) {
    return fallback;
  }

  const initials: string[] = [];
  for (const token of candidates) {
    const chars = Array.from(token);
    const initial = chars[0]?.toUpperCase();
    if (initial) {
      initials.push(initial);
    }
    if (initials.length >= maxInitials) {
      break;
    }
  }

  if (initials.length === 0) {
    const fallbackToken = candidates[0];
    const fallbackChars = Array.from(fallbackToken)
      .slice(0, maxInitials)
      .join("")
      .toUpperCase();
    return fallbackChars || fallback;
  }

  const combined = initials.join("");
  return combined || fallback;
};

export function LeadInitials({
  name,
  fallback = DEFAULT_FALLBACK,
  maxInitials = DEFAULT_MAX_INITIALS
}: LeadInitialsProps) {
  const initials = useMemo(
    () => computeLeadInitials(name, fallback, maxInitials),
    [name, fallback, maxInitials]
  );

  return <>{initials}</>;
}
