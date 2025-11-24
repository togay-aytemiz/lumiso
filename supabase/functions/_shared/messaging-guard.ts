import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type GenericSupabaseClient = SupabaseClient<any, any, any>;

type OrganizationRow = {
  id: string;
  membership_status: string | null;
  trial_expires_at: string | null;
  premium_expires_at: string | null;
};

type MembershipEventRow = {
  new_status: string | null;
  created_at: string | null;
};

export const BLOCKED_STATUSES = ["locked", "expired", "suspended"] as const;
export const GRACE_PERIOD_HOURS = 48;
const GRACE_PERIOD_MS = GRACE_PERIOD_HOURS * 60 * 60 * 1000;

export type MessagingGuardResult = {
  status: string | null;
  blockStart: Date | null;
  graceEndsAt: Date | null;
  inGrace: boolean;
  hardBlocked: boolean;
  shouldSendExisting: boolean;
  shouldScheduleNew: boolean;
  reason?: string;
};

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pickLatest = (dates: Array<Date | null>): Date | null => {
  return dates.reduce<Date | null>((latest, current) => {
    if (!current) return latest;
    if (!latest) return current;
    return current.getTime() > latest.getTime() ? current : latest;
  }, null);
};

export async function getMessagingGuard(
  supabase: GenericSupabaseClient,
  organizationId: string,
  now: Date = new Date()
): Promise<MessagingGuardResult | null> {
  if (!organizationId) return null;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, membership_status, trial_expires_at, premium_expires_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError || !org) {
    console.warn("Messaging guard: org not found", { organizationId, error: orgError?.message });
    return null;
  }

  const status = (org as OrganizationRow).membership_status ?? null;
  const isBlocked = status ? (BLOCKED_STATUSES as readonly string[]).includes(status) : false;

  if (!isBlocked) {
    return {
      status,
      blockStart: null,
      graceEndsAt: null,
      inGrace: false,
      hardBlocked: false,
      shouldSendExisting: true,
      shouldScheduleNew: true,
    };
  }

  const latestDate = pickLatest([
    toDate((org as OrganizationRow).trial_expires_at),
    toDate((org as OrganizationRow).premium_expires_at),
  ]);

  const { data: event } = await supabase
    .from("membership_events")
    .select("new_status, created_at")
    .eq("organization_id", organizationId)
    .in("new_status", BLOCKED_STATUSES as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const eventDate = toDate((event as MembershipEventRow | null)?.created_at ?? null);
  const blockStart = pickLatest([eventDate, latestDate]) ?? now;
  const graceEndsAt = new Date(blockStart.getTime() + GRACE_PERIOD_MS);
  const inGrace = now.getTime() <= graceEndsAt.getTime();
  const hardBlocked = !inGrace;

  const reason = hardBlocked
    ? "Messaging blocked: grace period ended"
    : "Messaging allowed during 48h grace window";

  return {
    status,
    blockStart,
    graceEndsAt,
    inGrace,
    hardBlocked,
    shouldSendExisting: !hardBlocked,
    shouldScheduleNew: !hardBlocked,
    reason,
  };
}
