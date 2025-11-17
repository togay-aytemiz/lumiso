import { useMemo } from "react";
import { differenceInCalendarDays, isBefore } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";

interface TrialStatus {
  isTrial: boolean;
  membershipStatus: string | null;
  trialExpiresAt: Date | null;
  trialStartedAt: Date | null;
  daysLeft: number | null;
  totalDays: number | null;
  progress: number;
}

export function useOrganizationTrialStatus(): TrialStatus {
  const { activeOrganization } = useOrganization();

  return useMemo(() => {
    if (!activeOrganization) {
      return {
        isTrial: false,
        membershipStatus: null,
        trialExpiresAt: null,
        trialStartedAt: null,
        daysLeft: null,
        totalDays: null,
        progress: 0,
      };
    }

    const membershipStatus = activeOrganization.membership_status ?? null;
    const trialExpiresSource =
      activeOrganization.computed_trial_ends_at ?? activeOrganization.trial_expires_at;
    const trialStartedSource =
      activeOrganization.computed_trial_started_at ?? activeOrganization.trial_started_at;
    const trialExpiresAt = trialExpiresSource ? new Date(trialExpiresSource) : null;
    const trialStartedAt = trialStartedSource ? new Date(trialStartedSource) : null;

    let daysLeft: number | null = null;
    if (trialExpiresAt) {
      const now = new Date();
      const diff = differenceInCalendarDays(trialExpiresAt, now);
      daysLeft = Math.max(0, diff);
    }

    let totalDays: number | null = null;
    if (trialExpiresAt && trialStartedAt) {
      const diff = differenceInCalendarDays(trialExpiresAt, trialStartedAt);
      totalDays = Math.max(1, diff);
    }

    let progress = 0;
    if (totalDays != null && daysLeft != null) {
      const usedDays = Math.min(totalDays, Math.max(0, totalDays - daysLeft));
      progress = totalDays > 0 ? usedDays / totalDays : 0;
    } else if (trialExpiresAt && trialStartedAt) {
      const now = new Date();
      const hasStarted = !isBefore(now, trialStartedAt);
      progress = hasStarted ? 1 : 0;
    }

    return {
      isTrial: membershipStatus === "trial",
      membershipStatus,
      trialExpiresAt,
      trialStartedAt,
      daysLeft,
      totalDays,
      progress: Math.min(1, Math.max(0, progress)),
    };
  }, [activeOrganization]);
}
