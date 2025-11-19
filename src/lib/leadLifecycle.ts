export interface LeadLifecycleLike {
  status?: string | null;
  lead_statuses?: {
    is_system_final?: boolean | null;
    name?: string | null;
  } | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const LOST_STATUS_KEYWORDS = ["lost", "canceled", "cancelled"];
export const CONVERTED_STATUS_KEYWORDS = ["booked", "completed", "won", "converted", "signed"];
export const CLOSED_STATUS_KEYWORDS = ["closed", "finished"];

const normalizeStatusName = (lead: LeadLifecycleLike) =>
  (lead.lead_statuses?.name ?? lead.status ?? "").toLowerCase();

export const isLeadClosedForLifecycle = (lead: LeadLifecycleLike) => {
  const statusName = normalizeStatusName(lead);
  const isLost = LOST_STATUS_KEYWORDS.some((keyword) => statusName.includes(keyword));
  const isCompleted = statusName.includes("completed");
  const isConverted = CONVERTED_STATUS_KEYWORDS.some((keyword) => statusName.includes(keyword));
  const isClosedKeyword = CLOSED_STATUS_KEYWORDS.some((keyword) => statusName.includes(keyword));

  return (
    Boolean(lead.lead_statuses?.is_system_final) ||
    isLost ||
    isCompleted ||
    isConverted ||
    isClosedKeyword
  );
};

export const getLeadLastActivityMs = (lead: LeadLifecycleLike) => {
  const reference = lead.updated_at || lead.created_at;
  if (!reference) return null;
  const ms = new Date(reference).getTime();
  return Number.isNaN(ms) ? null : ms;
};

export const countInactiveLeads = (leads: LeadLifecycleLike[], inactiveDays = 14) => {
  const threshold = Date.now() - inactiveDays * DAY_IN_MS;

  return leads.reduce((count, lead) => {
    if (isLeadClosedForLifecycle(lead)) {
      return count;
    }

    const updatedMs = getLeadLastActivityMs(lead);
    if (updatedMs == null) {
      return count;
    }

    return updatedMs <= threshold ? count + 1 : count;
  }, 0);
};
