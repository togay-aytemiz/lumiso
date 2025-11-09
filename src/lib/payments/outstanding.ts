import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { fetchProjectServiceRecords } from "@/lib/services/projectServiceRecords";
import { computeServiceTotals } from "@/lib/payments/servicePricing";

const DEFAULT_SCHEDULE_DESCRIPTION = "Outstanding balance";

interface SyncOutstandingOptions {
  projectId: string;
  organizationId?: string | null;
  userId?: string | null;
  contractTotalOverride?: number;
  description?: string | null;
}

async function calculateProjectContractTotal(projectId: string, basePrice: number | null | undefined) {
  try {
    const serviceRecords = await fetchProjectServiceRecords(projectId);
    const extrasTotal = serviceRecords
      .filter((record) => record.billingType === "extra")
      .reduce((sum, record) => {
        const pricing = computeServiceTotals({
          unitPrice: record.overrides.unitPrice ?? record.service.selling_price ?? record.service.price ?? null,
          quantity: record.quantity,
          vatRate: record.overrides.vatRate ?? record.service.vat_rate ?? null,
          vatMode:
            record.overrides.vatMode ??
            (record.service.price_includes_vat === false ? "exclusive" : "inclusive"),
        });
        return sum + pricing.gross;
      }, 0);

    return Math.max(0, Number(basePrice ?? 0) + extrasTotal);
  } catch (error) {
    console.warn("Unable to compute service totals for project", projectId, error);
    return Math.max(0, Number(basePrice ?? 0));
  }
}

export async function syncProjectOutstandingPayment({
  projectId,
  organizationId,
  userId,
  contractTotalOverride,
  description,
}: SyncOutstandingOptions): Promise<void> {
  let resolvedOrganizationId = organizationId ?? null;
  let resolvedUserId = userId ?? null;
  let projectBasePrice: number | null | undefined;
  let projectName: string | null | undefined;

  if (!resolvedOrganizationId || !resolvedUserId || typeof contractTotalOverride !== "number") {
    const { data: projectRow } = await supabase
      .from("projects")
      .select("organization_id, user_id, base_price, name")
      .eq("id", projectId)
      .single();

    projectBasePrice = projectRow?.base_price ?? null;
    projectName = projectRow?.name ?? null;
    resolvedOrganizationId ??= projectRow?.organization_id ?? null;
    resolvedUserId ??= projectRow?.user_id ?? null;
  } else {
    projectBasePrice = contractTotalOverride;
  }

  if (!resolvedOrganizationId) {
    resolvedOrganizationId = await getUserOrganizationId();
  }

  if (!resolvedUserId) {
    const { data } = await supabase.auth.getUser();
    resolvedUserId = data.user?.id ?? null;
  }

  if (!resolvedOrganizationId) {
    return;
  }

  const contractTotal =
    typeof contractTotalOverride === "number"
      ? contractTotalOverride
      : await calculateProjectContractTotal(projectId, projectBasePrice);

  const normalizedAmount = Number(contractTotal ?? 0);
  if (!Number.isFinite(normalizedAmount)) {
    return;
  }

  const scheduleDescription =
    description?.trim() ||
    (projectName ? `Outstanding balance — ${projectName}` : DEFAULT_SCHEDULE_DESCRIPTION);

  if (normalizedAmount <= 0) {
    await supabase
      .from("payments")
      .delete()
      .eq("project_id", projectId)
      .eq("entry_kind", "scheduled");
    return;
  }

  const { data: existingSchedule } = await supabase
    .from("payments")
    .select("id")
    .eq("project_id", projectId)
    .eq("entry_kind", "scheduled")
    .maybeSingle();

  if (!existingSchedule) {
    if (!resolvedUserId) return;
    await supabase.from("payments").insert({
      project_id: projectId,
      organization_id: resolvedOrganizationId,
      user_id: resolvedUserId,
      amount: normalizedAmount,
      description: scheduleDescription,
      status: "due",
      type: "balance_due",
      entry_kind: "scheduled",
      scheduled_initial_amount: normalizedAmount,
      scheduled_remaining_amount: normalizedAmount,
    });
  } else {
    await supabase
      .from("payments")
      .update({
        amount: normalizedAmount,
        scheduled_initial_amount: normalizedAmount,
        description: scheduleDescription,
      })
      .eq("id", existingSchedule.id);
  }

  await recalculateProjectOutstanding(projectId);
}

export async function recalculateProjectOutstanding(projectId: string): Promise<void> {
  if (!projectId) return;

  const { data: schedules, error: scheduleError } = await supabase
    .from("payments")
    .select("id, scheduled_initial_amount, scheduled_remaining_amount, created_at")
    .eq("project_id", projectId)
    .eq("entry_kind", "scheduled")
    .order("created_at", { ascending: true });

  if (scheduleError || !schedules?.length) {
    return;
  }

  const { data: recorded, error: recordedError } = await supabase
    .from("payments")
    .select("amount")
    .eq("project_id", projectId)
    .eq("entry_kind", "recorded")
    .eq("status", "paid");

  if (recordedError) {
    return;
  }

  const totalCollected = recorded?.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;
  let remainingCollected = totalCollected;

  await Promise.all(
    schedules.map((schedule) => {
      const initial = Number(schedule.scheduled_initial_amount ?? schedule.scheduled_remaining_amount ?? 0);
      const applied = Math.min(initial, remainingCollected);
      const nextRemaining = Number((initial - applied).toFixed(2));
      remainingCollected = remainingCollected - applied;
      const nextStatus = nextRemaining > 0 ? "due" : "paid";
      return supabase
        .from("payments")
        .update({
          scheduled_remaining_amount: nextRemaining,
          status: nextStatus,
        })
        .eq("id", schedule.id);
    })
  );
}
