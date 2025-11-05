import { useMemo } from "react";
import {
  computeLeadInitials,
  DEFAULT_FALLBACK,
  DEFAULT_MAX_INITIALS,
} from "./leadInitialsUtils";

export interface LeadInitialsProps {
  name?: string | null;
  fallback?: string;
  maxInitials?: number;
}

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
