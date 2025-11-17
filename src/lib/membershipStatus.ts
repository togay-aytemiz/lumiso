import { addDays } from "date-fns";
import type { MembershipStatus } from "@/types/membership";

const DEFAULT_TRIAL_DAYS = 14;

type MembershipAwareEntity = {
  membership_status?: string | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  trial_extended_by_days?: number | null;
  premium_expires_at?: string | null;
  premium_activated_at?: string | null;
  created_at?: string | null;
};

export interface MembershipResolutionResult {
  status: MembershipStatus;
  previousStatus: string | null;
  trialEndsAt: string | null;
  trialStartedAt: string | null;
  premiumEndsAt: string | null;
  premiumActivatedAt: string | null;
  premiumIsActive: boolean;
  premiumExpired: boolean;
  shouldBlockAccess: boolean;
}

const normalizeDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function resolveMembershipStatus(
  entity: MembershipAwareEntity,
  now: Date = new Date()
): MembershipResolutionResult {
  const normalizedStatus = (entity.membership_status as MembershipStatus | null) ?? "trial";
  const trialStartDate = normalizeDate(entity.trial_started_at ?? entity.created_at ?? null);
  const trialEndDate = normalizeDate(
    entity.trial_expires_at ??
      (trialStartDate
        ? addDays(
            trialStartDate,
            Math.max(0, DEFAULT_TRIAL_DAYS + (entity.trial_extended_by_days ?? 0))
          ).toISOString()
        : null)
  );
  const premiumEndDate = normalizeDate(entity.premium_expires_at);
  const nowTime = now.getTime();

  const suspended = normalizedStatus === "suspended";
  const premiumActive =
    (normalizedStatus === "premium" || normalizedStatus === "complimentary") &&
    (!premiumEndDate || premiumEndDate.getTime() >= nowTime);

  let status: MembershipStatus;

  if (suspended) {
    status = "suspended";
  } else if (premiumActive) {
    status = normalizedStatus === "complimentary" ? "complimentary" : "premium";
  } else if (trialEndDate && trialEndDate.getTime() >= nowTime) {
    status = "trial";
  } else {
    status = "locked";
  }

  const premiumExpired =
    (normalizedStatus === "premium" || normalizedStatus === "complimentary") &&
    Boolean(premiumEndDate) &&
    premiumEndDate.getTime() < nowTime;

  return {
    status,
    previousStatus: entity.membership_status ?? null,
    trialEndsAt: trialEndDate ? trialEndDate.toISOString() : null,
    trialStartedAt: trialStartDate ? trialStartDate.toISOString() : null,
    premiumEndsAt: premiumEndDate ? premiumEndDate.toISOString() : null,
    premiumActivatedAt: entity.premium_activated_at ?? null,
    premiumIsActive: premiumActive,
    premiumExpired,
    shouldBlockAccess: status === "locked" || status === "suspended",
  };
}

export function shouldPersistMembershipStatus(
  entity: MembershipAwareEntity,
  resolution: MembershipResolutionResult
) {
  return (
    (entity.membership_status ?? null) !== resolution.status &&
    !(entity.membership_status === "suspended" && resolution.status !== "suspended")
  );
}

export { DEFAULT_TRIAL_DAYS as MEMBERSHIP_DEFAULT_TRIAL_DAYS };
