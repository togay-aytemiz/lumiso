export type MembershipStatus =
  | "trial"
  | "premium"
  | "complimentary"
  | "expired"
  | "suspended"
  | "locked";

export const PREMIUM_STATUSES: MembershipStatus[] = ["premium", "complimentary"];

export const BLOCKED_STATUSES: MembershipStatus[] = ["locked", "suspended"];
