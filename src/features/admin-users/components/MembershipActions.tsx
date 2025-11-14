import { useState, useCallback } from "react";
import { addDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AdminUserAccount, MembershipStatus } from "../types";
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

interface MembershipActionsProps {
  user: AdminUserAccount;
  onUserUpdated?: () => void;
  buttonRowClassName?: string;
}

const ADMIN_USERS_QUERY_KEY = "admin-users";

export function MembershipActions({ user, onUserUpdated, buttonRowClassName }: MembershipActionsProps) {
  const { t } = useTranslation("pages");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [extendReason, setExtendReason] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);

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

  const handleExtendTrial = async () => {
    if (!extendDays || extendDays < 1) {
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.validationError"),
      });
      return;
    }
    setExtendLoading(true);
    try {
      const baseTrialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : new Date();
      const startDate = baseTrialEnd.getTime() < Date.now() ? new Date() : baseTrialEnd;
      const newTrialEnd = addDays(startDate, extendDays);
      const nextStatus: MembershipStatus = user.status === "expired" ? "trial" : user.status;
      await handleSupabaseUpdate(
        {
          trial_expires_at: newTrialEnd.toISOString(),
          trial_extended_by_days: (user.trialExtendedByDays ?? 0) + extendDays,
          trial_extension_reason: extendReason || null,
          membership_status: nextStatus,
        },
        t("admin.users.detail.actions.membershipModals.extendTrial.success"),
        {
          action: "extend_trial",
          newStatus: nextStatus,
          metadata: {
            daysAdded: extendDays,
            reason: extendReason || null,
            newTrialEndsAt: newTrialEnd.toISOString(),
          },
        }
      );
      setExtendOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: t("admin.users.detail.actions.membershipModals.extendTrial.error"),
      });
    } finally {
      setExtendLoading(false);
    }
  };

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
        <Button variant="default" onClick={() => setExtendOpen(true)}>
          {t("admin.users.detail.actions.extendTrial")}
        </Button>
        <Button variant="secondary" onClick={() => setPremiumOpen(true)}>
          {t("admin.users.detail.actions.grantPremium")}
        </Button>
        <Button variant="outline" onClick={() => setComplimentaryOpen(true)}>
          {t("admin.users.detail.actions.addComplimentary")}
        </Button>
        <Button variant="outline" onClick={() => setSuspendOpen(true)}>
          {t("admin.users.detail.actions.suspendAccount")}
        </Button>
      </div>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.users.detail.actions.membershipModals.extendTrial.title")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.users.detail.actions.membershipModals.extendTrial.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="extend-days">
                {t("admin.users.detail.actions.membershipModals.extendTrial.daysLabel")}
              </Label>
              <Input
                id="extend-days"
                type="number"
                min={1}
                value={extendDays}
                onChange={(event) => setExtendDays(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extend-reason">
                {t("admin.users.detail.actions.membershipModals.extendTrial.reasonLabel")}
              </Label>
              <Textarea
                id="extend-reason"
                value={extendReason}
                onChange={(event) => setExtendReason(event.target.value)}
                placeholder={t("admin.users.detail.actions.membershipModals.extendTrial.reasonPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>
              {t("admin.users.detail.actions.membershipModals.cancel")}
            </Button>
            <Button onClick={handleExtendTrial} disabled={extendLoading}>
              {extendLoading
                ? t("admin.users.detail.actions.membershipModals.saving")
                : t("admin.users.detail.actions.membershipModals.extendTrial.submit")}
            </Button>
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
