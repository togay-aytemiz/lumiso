import { useState, useCallback, useMemo, useEffect } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AdminUserAccount, MembershipStatus } from "../types";
import { MEMBERSHIP_DEFAULT_TRIAL_DAYS } from "@/lib/membershipStatus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const formatDateInputValue = (value?: string | null) => {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd");
  } catch {
    return "";
  }
};

const normalizeTrialTargetDate = (value: Date) => {
  const result = new Date(value);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

const parseDateInputValue = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface MembershipActionsProps {
  user: AdminUserAccount;
  onUserUpdated?: () => void;
  buttonRowClassName?: string;
}

const ADMIN_USERS_QUERY_KEY = "admin-users";

export function MembershipActions({ user, onUserUpdated, buttonRowClassName }: MembershipActionsProps) {
  const { t, i18n } = useTranslation("pages");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState(() => formatDateInputValue(user.trialEndsAt));
  const [trialReason, setTrialReason] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);

  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState("Premium");
  const [premiumExpiresAt, setPremiumExpiresAt] = useState("");
  const [premiumNote, setPremiumNote] = useState("");
  const [premiumLoading, setPremiumLoading] = useState(false);

  const [complimentaryOpen, setComplimentaryOpen] = useState(false);
  const [complimentaryPlan, setComplimentaryPlan] = useState("Complimentary");
  const [complimentaryExpiresAt, setComplimentaryExpiresAt] = useState("");
  const [complimentaryNote, setComplimentaryNote] = useState("");
  const [complimentaryLoading, setComplimentaryLoading] = useState(false);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendLoading, setSuspendLoading] = useState(false);

  useEffect(() => {
    setTrialEndDate(formatDateInputValue(user.trialEndsAt));
  }, [user.trialEndsAt]);

  const dateFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language ?? undefined, { dateStyle: "medium" });
    } catch {
      return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
    }
  }, [i18n.language]);

  const formatDisplayDate = useCallback(
    (value?: Date | null) => {
      if (!value) return "—";
      try {
        return dateFormatter.format(value);
      } catch {
        return value.toISOString().slice(0, 10);
      }
    },
    [dateFormatter]
  );

  const trialStartDate = useMemo(
    () => (user.membershipStartedAt ? new Date(user.membershipStartedAt) : null),
    [user.membershipStartedAt]
  );
  const currentTrialEnd = useMemo(
    () => (user.trialEndsAt ? new Date(user.trialEndsAt) : null),
    [user.trialEndsAt]
  );
  const trialStartLabel = formatDisplayDate(trialStartDate);
  const trialEndLabel = formatDisplayDate(currentTrialEnd);
  const trialMinDate = useMemo(
    () => (trialStartDate ? formatDateInputValue(trialStartDate.toISOString()) : undefined),
    [trialStartDate]
  );
  const trialDaysRemainingLabel =
    typeof user.trialDaysRemaining === "number" ? user.trialDaysRemaining : null;

  const invalidateUsers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [ADMIN_USERS_QUERY_KEY], exact: false });
    onUserUpdated?.();
  }, [onUserUpdated, queryClient]);

  const logMembershipEvent = useCallback(
    async (action: string, newStatus: MembershipStatus, metadata?: Record<string, unknown> | null) => {
      try {
        const {
          data: { user: adminUser },
        } = await supabase.auth.getUser();
        await supabase.from("membership_events").insert({
          organization_id: user.id,
          admin_id: adminUser?.id ?? null,
          action,
          previous_status: user.status,
          new_status: newStatus,
          metadata: metadata ?? null,
        });
      } catch (error) {
        console.warn("Failed to log membership event", error);
      }
    },
    [user.id, user.status]
  );

  const handleSupabaseUpdate = useCallback(
    async (
      payload: Record<string, unknown>,
      successMessage: string,
      logArgs?: { action: string; newStatus: MembershipStatus; metadata?: Record<string, unknown> | null }
    ) => {
      const { error } = await supabase.from("organizations").update(payload).eq("id", user.id);
      if (error) {
        throw error;
      }
      if (logArgs) {
        await logMembershipEvent(logArgs.action, logArgs.newStatus, logArgs.metadata ?? null);
      }
      await invalidateUsers();
      toast({
        title: successMessage,
        description: t("admin.users.detail.actions.membershipModals.saved"),
      });
    },
    [invalidateUsers, logMembershipEvent, toast, t, user.id]
  );

  const updateTrialEnd = useCallback(
    async (rawTarget: Date, immediateChange: boolean) => {
      if (!trialStartDate) {
        toast({
          variant: "destructive",
          title: t("admin.users.detail.actions.membershipModals.validationError"),
        });
        return;
      }
      setTrialLoading(true);
      try {
        const normalizedTarget = immediateChange
          ? new Date(rawTarget)
          : normalizeTrialTargetDate(rawTarget);
        const totalDays = Math.max(
          0,
          differenceInCalendarDays(normalizedTarget, trialStartDate)
        );
        const newExtension = Math.max(0, totalDays - MEMBERSHIP_DEFAULT_TRIAL_DAYS);
        const payload: Record<string, unknown> = {
          trial_expires_at: normalizedTarget.toISOString(),
          trial_extended_by_days: newExtension,
          trial_extension_reason: trialReason || null,
        };
        let nextStatus: MembershipStatus | undefined;
        if (["trial", "expired", "locked"].includes(user.status)) {
          nextStatus = normalizedTarget.getTime() >= Date.now() ? "trial" : "locked";
          payload.membership_status = nextStatus;
        }
        await handleSupabaseUpdate(
          payload,
          t("admin.users.detail.actions.membershipModals.manageTrial.success"),
          {
            action: "manage_trial",
            newStatus: nextStatus ?? user.status,
            metadata: {
              previousTrialEndsAt: user.trialEndsAt ?? null,
              newTrialEndsAt: normalizedTarget.toISOString(),
              changeDays:
                currentTrialEnd && trialStartDate
                  ? differenceInCalendarDays(normalizedTarget, currentTrialEnd)
                  : null,
              reason: trialReason || null,
              immediate: immediateChange,
            },
          }
        );
        setTrialModalOpen(false);
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: t("admin.users.detail.actions.membershipModals.manageTrial.error"),
        });
      } finally {
        setTrialLoading(false);
      }
    },
    [
      currentTrialEnd,
      handleSupabaseUpdate,
      t,
      toast,
      trialReason,
      trialStartDate,
      user.status,
      user.trialEndsAt,
    ]
  );

  const handleSaveTrialChanges = useCallback(async () => {
    const parsed = parseDateInputValue(trialEndDate);
    if (!parsed) {
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.validationError"),
      });
      return;
    }
    if (trialStartDate && parsed.getTime() < trialStartDate.getTime()) {
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.validationError"),
      });
      return;
    }
    await updateTrialEnd(parsed, false);
  }, [t, toast, trialEndDate, trialStartDate, updateTrialEnd]);

  const handleEndTrialNow = useCallback(async () => {
    await updateTrialEnd(new Date(), true);
  }, [updateTrialEnd]);

  const handleGrantPremium = async () => {
    setPremiumLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const expiresIso = premiumExpiresAt ? new Date(`${premiumExpiresAt}T00:00:00Z`).toISOString() : null;
      await handleSupabaseUpdate(
        {
          membership_status: "premium",
          premium_activated_at: nowIso,
          premium_plan: premiumPlan || "Premium",
          premium_expires_at: expiresIso,
          manual_flag: true,
          manual_flag_reason: premiumNote || null,
        },
        t("admin.users.detail.actions.membershipModals.grantPremium.success"),
        {
          action: "grant_premium",
          newStatus: "premium",
          metadata: {
            plan: premiumPlan || "Premium",
            expiresAt: expiresIso,
            note: premiumNote || null,
          },
        }
      );
      setPremiumOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.grantPremium.error"),
      });
    } finally {
      setPremiumLoading(false);
    }
  };

  const handleComplimentary = async () => {
    setComplimentaryLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const expiresIso = complimentaryExpiresAt
        ? new Date(`${complimentaryExpiresAt}T00:00:00Z`).toISOString()
        : null;
      await handleSupabaseUpdate(
        {
          membership_status: "complimentary",
          premium_activated_at: nowIso,
          premium_plan: complimentaryPlan || "Complimentary",
          premium_expires_at: expiresIso,
          manual_flag: true,
          manual_flag_reason: complimentaryNote || null,
        },
        t("admin.users.detail.actions.membershipModals.complimentary.success"),
        {
          action: "grant_complimentary",
          newStatus: "complimentary",
          metadata: {
            plan: complimentaryPlan || "Complimentary",
            expiresAt: expiresIso,
            note: complimentaryNote || null,
          },
        }
      );
      setComplimentaryOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.complimentary.error"),
      });
    } finally {
      setComplimentaryLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.validationError"),
      });
      return;
    }
    setSuspendLoading(true);
    try {
      await handleSupabaseUpdate(
        {
          membership_status: "suspended",
          manual_flag: true,
          manual_flag_reason: suspendReason.trim(),
        },
        t("admin.users.detail.actions.membershipModals.suspend.success"),
        {
          action: "suspend_account",
          newStatus: "suspended",
          metadata: {
            reason: suspendReason.trim(),
          },
        }
      );
      setSuspendOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.suspend.error"),
      });
    } finally {
      setSuspendLoading(false);
    }
  };

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", buttonRowClassName)}>
        <Button variant="surface" onClick={() => setTrialModalOpen(true)}>
          {t("admin.users.detail.actions.manageTrial")}
        </Button>
        <Button
          variant="surface"
          className="btn-surface-amber"
          onClick={() => setPremiumOpen(true)}
        >
          {t("admin.users.detail.actions.grantPremium")}
        </Button>
        <Button
          variant="surface"
          className="btn-surface-amber"
          onClick={() => setComplimentaryOpen(true)}
        >
          {t("admin.users.detail.actions.addComplimentary")}
        </Button>
        <Button
          variant="surface"
          className="btn-surface-destructive"
          onClick={() => setSuspendOpen(true)}
        >
          {t("admin.users.detail.actions.suspendAccount")}
        </Button>
      </div>

      <Dialog open={trialModalOpen} onOpenChange={setTrialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.users.detail.actions.membershipModals.manageTrial.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.users.detail.actions.membershipModals.manageTrial.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.users.detail.membership.startedAt")}
                </span>
                <span className="font-medium text-foreground">{trialStartLabel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.users.detail.membership.trialEnds")}
                </span>
                <span className="font-medium text-foreground">{trialEndLabel}</span>
              </div>
              {typeof trialDaysRemainingLabel === "number" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("admin.users.detail.membership.daysRemaining", {
                    days: Math.max(0, trialDaysRemainingLabel),
                  })}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial-end-date">
                {t("admin.users.detail.actions.membershipModals.manageTrial.dateLabel")}
              </Label>
              <Input
                id="trial-end-date"
                type="date"
                value={trialEndDate}
                min={trialMinDate}
                onChange={(event) => setTrialEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial-reason">
                {t("admin.users.detail.actions.membershipModals.manageTrial.reasonLabel")}
              </Label>
              <Textarea
                id="trial-reason"
                value={trialReason}
                onChange={(event) => setTrialReason(event.target.value)}
                placeholder={t("admin.users.detail.actions.membershipModals.manageTrial.reasonPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive sm:order-1"
              onClick={handleEndTrialNow}
              disabled={trialLoading}
            >
              {t("admin.users.detail.actions.membershipModals.manageTrial.endToday")}
            </Button>
            <div className="flex w-full flex-1 justify-end gap-2 sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setTrialModalOpen(false)}
                disabled={trialLoading}
              >
                {t("admin.users.detail.actions.membershipModals.cancel")}
              </Button>
              <Button onClick={handleSaveTrialChanges} disabled={trialLoading}>
                {trialLoading
                  ? t("admin.users.detail.actions.membershipModals.saving")
                  : t("admin.users.detail.actions.membershipModals.manageTrial.submit")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={premiumOpen} onOpenChange={setPremiumOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.users.detail.actions.membershipModals.grantPremium.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.users.detail.actions.membershipModals.grantPremium.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="premium-plan">
                {t("admin.users.detail.actions.membershipModals.grantPremium.planLabel")}
              </Label>
              <Input
                id="premium-plan"
                value={premiumPlan}
                onChange={(event) => setPremiumPlan(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-expires">
                {t("admin.users.detail.actions.membershipModals.grantPremium.expiresLabel")}
              </Label>
              <Input
                id="premium-expires"
                type="date"
                value={premiumExpiresAt}
                onChange={(event) => setPremiumExpiresAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-note">
                {t("admin.users.detail.actions.membershipModals.grantPremium.noteLabel")}
              </Label>
              <Textarea
                id="premium-note"
                value={premiumNote}
                onChange={(event) => setPremiumNote(event.target.value)}
                placeholder={t("admin.users.detail.actions.membershipModals.grantPremium.notePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPremiumOpen(false)}>
              {t("admin.users.detail.actions.membershipModals.cancel")}
            </Button>
            <Button onClick={handleGrantPremium} disabled={premiumLoading}>
              {premiumLoading
                ? t("admin.users.detail.actions.membershipModals.saving")
                : t("admin.users.detail.actions.membershipModals.grantPremium.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={complimentaryOpen} onOpenChange={setComplimentaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.users.detail.actions.membershipModals.complimentary.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.users.detail.actions.membershipModals.complimentary.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="complimentary-plan">
                {t("admin.users.detail.actions.membershipModals.complimentary.planLabel")}
              </Label>
              <Input
                id="complimentary-plan"
                value={complimentaryPlan}
                onChange={(event) => setComplimentaryPlan(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complimentary-expires">
                {t("admin.users.detail.actions.membershipModals.complimentary.expiresLabel")}
              </Label>
              <Input
                id="complimentary-expires"
                type="date"
                value={complimentaryExpiresAt}
                onChange={(event) => setComplimentaryExpiresAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complimentary-note">
                {t("admin.users.detail.actions.membershipModals.complimentary.noteLabel")}
              </Label>
              <Textarea
                id="complimentary-note"
                value={complimentaryNote}
                onChange={(event) => setComplimentaryNote(event.target.value)}
                placeholder={t("admin.users.detail.actions.membershipModals.complimentary.notePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplimentaryOpen(false)}>
              {t("admin.users.detail.actions.membershipModals.cancel")}
            </Button>
            <Button onClick={handleComplimentary} disabled={complimentaryLoading}>
              {complimentaryLoading
                ? t("admin.users.detail.actions.membershipModals.saving")
                : t("admin.users.detail.actions.membershipModals.complimentary.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.users.detail.actions.membershipModals.suspend.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.users.detail.actions.membershipModals.suspend.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="suspend-reason">
                {t("admin.users.detail.actions.membershipModals.suspend.reasonLabel")}
              </Label>
              <Textarea
                id="suspend-reason"
                value={suspendReason}
                onChange={(event) => setSuspendReason(event.target.value)}
                placeholder={t("admin.users.detail.actions.membershipModals.suspend.notePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              {t("admin.users.detail.actions.membershipModals.cancel")}
            </Button>
            <Button onClick={handleSuspend} disabled={suspendLoading}>
              {suspendLoading
                ? t("admin.users.detail.actions.membershipModals.saving")
                : t("admin.users.detail.actions.membershipModals.suspend.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
