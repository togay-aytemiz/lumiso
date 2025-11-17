import { useMemo, useState, useCallback, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { useTranslation } from "react-i18next";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationTrialStatus } from "@/hooks/useOrganizationTrialStatus";
import { Lock, ShieldAlert, Sparkles } from "lucide-react";
import { PREMIUM_STATUSES } from "@/types/membership";
import type { MembershipStatus } from "@/types/membership";
import { MEMBERSHIP_DEFAULT_TRIAL_DAYS } from "@/lib/membershipStatus";
import { Button } from "@/components/ui/button";
import { SettingsTwoColumnSection } from "@/components/settings/SettingsSections";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays, format } from "date-fns";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { Badge } from "@/components/ui/badge";

const formatDateInputValue = (value?: string | null) => {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd");
  } catch {
    return "";
  }
};

const parseDateInputValue = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeTrialTargetDate = (value: Date) => {
  const result = new Date(value);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

export default function BillingSubscription() {
  const { t, i18n } = useTranslation("pages");
  const { toast } = useToast();
  const { userRoles } = useAuth();
  const { activeOrganization, loading: organizationLoading, refreshOrganization } = useOrganization();
  const trialStatus = useOrganizationTrialStatus();
  const isAdminUser = userRoles.includes("admin");

  const membershipStatus = activeOrganization?.membership_status ?? null;
  const statusLabel = membershipStatus
    ? t(`settings.billingSubscription.statusLabels.${membershipStatus}`, {
        defaultValue: membershipStatus,
      })
    : t("settings.billingSubscription.statusLabels.unknown");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language ?? undefined, {
        dateStyle: "medium",
      }),
    [i18n.language]
  );

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—";
    try {
      const date = value instanceof Date ? value : new Date(value);
      return dateFormatter.format(date);
    } catch {
      return "—";
    }
  };

  const premiumExpiresAt = activeOrganization?.premium_expires_at ?? null;
  const premiumActivatedAt = activeOrganization?.premium_activated_at ?? null;
  const premiumPlan = activeOrganization?.premium_plan ?? null;
  const trialDaysLeft = trialStatus.daysLeft ?? 0;
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState(() =>
    formatDateInputValue(activeOrganization?.trial_expires_at ?? null)
  );
  const [trialReason, setTrialReason] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);

  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumPlanLabel, setPremiumPlanLabel] = useState("Premium");
  const [premiumExpiresInput, setPremiumExpiresInput] = useState("");
  const [premiumNote, setPremiumNote] = useState("");
  const [premiumLoading, setPremiumLoading] = useState(false);

  useEffect(() => {
    setTrialEndDate(formatDateInputValue(activeOrganization?.trial_expires_at ?? null));
  }, [activeOrganization?.trial_expires_at]);

  const trialStartDate = useMemo(() => {
    if (activeOrganization?.trial_started_at) {
      return new Date(activeOrganization.trial_started_at);
    }
    if (activeOrganization?.created_at) {
      return new Date(activeOrganization.created_at);
    }
    return null;
  }, [activeOrganization?.trial_started_at, activeOrganization?.created_at]);

  const currentTrialEnd = useMemo(
    () => (activeOrganization?.trial_expires_at ? new Date(activeOrganization.trial_expires_at) : null),
    [activeOrganization?.trial_expires_at]
  );

  const statusMessageKey = membershipStatus
    ? `settings.billingSubscription.statusMessages.${membershipStatus}`
    : "settings.billingSubscription.statusMessages.generic";
  const statusMessage = t(statusMessageKey, {
    defaultValue: t("settings.billingSubscription.statusMessages.generic"),
    days: trialDaysLeft ?? 0,
    date: premiumExpiresAt
      ? formatDate(premiumExpiresAt)
      : t("settings.billingSubscription.premiumSection.noExpiration"),
  });

  const isLocked = membershipStatus === "locked";
  const isSuspended = membershipStatus === "suspended";
  const StatusIcon = isLocked || isSuspended ? (isLocked ? Lock : ShieldAlert) : Sparkles;
  const statusIconClasses = isSuspended
    ? "bg-destructive/10 text-destructive"
    : isLocked
      ? "bg-amber-100 text-amber-900"
      : "bg-primary/10 text-primary";

  const trialStartLabel = trialStatus.trialStartedAt
    ? formatDate(trialStatus.trialStartedAt)
    : t("settings.billingSubscription.trialSection.notStarted");
  const trialEndLabel = trialStatus.trialExpiresAt
    ? formatDate(trialStatus.trialExpiresAt)
    : t("settings.billingSubscription.trialSection.notAvailable");
  const usageProgress = Math.min(Math.max(trialStatus.progress ?? 0, 0), 1);
  const remainingProgress = Math.max(0, Math.min(1, 1 - usageProgress));
  const trialProgressPercent = Math.round(remainingProgress * 100);
  const trialProgressWidth = `${(remainingProgress * 100).toFixed(2)}%`;
  const trialDaysText = t("settings.billingSubscription.trialSection.daysLeft", { count: trialDaysLeft });
  const trialMinDate = trialStartDate ? formatDateInputValue(trialStartDate.toISOString()) : undefined;
  const trialSummaryStart = trialStartDate
    ? formatDate(trialStartDate)
    : t("settings.billingSubscription.trialSection.notStarted");
  const trialSummaryEnd = currentTrialEnd
    ? formatDate(currentTrialEnd)
    : t("settings.billingSubscription.trialSection.notAvailable");

  const premiumActive = membershipStatus ? PREMIUM_STATUSES.includes(membershipStatus) : false;
  const isTrialActive = trialStatus.isTrial;
  const showTrialSection = isTrialActive;
  const showPremiumSection = !isTrialActive;
  const premiumCardRows = [
    {
      label: t("settings.billingSubscription.premiumSection.activated"),
      value: premiumActivatedAt
        ? formatDate(premiumActivatedAt)
        : t("settings.billingSubscription.premiumSection.noActivation"),
    },
    {
      label: t("settings.billingSubscription.premiumSection.expires"),
      value: premiumExpiresAt
        ? formatDate(premiumExpiresAt)
        : t("settings.billingSubscription.premiumSection.noExpiration"),
    },
  ];

  const isLoadingState = organizationLoading || !activeOrganization;
  const organizationId = activeOrganization?.id ?? null;

  const logMembershipEvent = useCallback(
    async (action: string, newStatus: MembershipStatus, metadata?: Record<string, unknown> | null) => {
      if (!organizationId) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await supabase.from("membership_events").insert({
          organization_id: organizationId,
          admin_id: user?.id ?? null,
          action,
          previous_status: activeOrganization?.membership_status ?? null,
          new_status: newStatus,
          metadata: metadata ?? null,
        });
      } catch (error) {
        console.warn("Failed to log membership event", error);
      }
    },
    [activeOrganization?.membership_status, organizationId]
  );

  const handleMembershipUpdate = useCallback(
    async (
      payload: Record<string, unknown>,
      successMessage: string,
      logArgs?: { action: string; newStatus: MembershipStatus; metadata?: Record<string, unknown> | null }
    ) => {
      if (!organizationId) return;
      const { error } = await supabase.from("organizations").update(payload).eq("id", organizationId);
      if (error) {
        throw error;
      }
      if (logArgs) {
        await logMembershipEvent(logArgs.action, logArgs.newStatus, logArgs.metadata ?? null);
      }
      await refreshOrganization();
      toast({
        title: successMessage,
        description: t("settings.billingSubscription.adminActions.saved"),
      });
    },
    [organizationId, logMembershipEvent, refreshOrganization, toast, t]
  );

  const updateTrialEnd = useCallback(
    async (rawTarget: Date, immediate: boolean) => {
      if (!activeOrganization || !trialStartDate) {
        toast({
          variant: "destructive",
          title: t("settings.billingSubscription.adminActions.manageTrial.error"),
        });
        return;
      }
      setTrialLoading(true);
      try {
        const fallbackStatus = (activeOrganization.membership_status as MembershipStatus | null) ?? "trial";
        const normalizedTarget = immediate
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
        if (
          ["trial", "expired", "locked"].includes(
            (activeOrganization.membership_status as MembershipStatus | null) ?? "trial"
          )
        ) {
          nextStatus = normalizedTarget.getTime() >= Date.now() ? "trial" : "locked";
          payload.membership_status = nextStatus;
        }
        await handleMembershipUpdate(
          payload,
          t("settings.billingSubscription.adminActions.manageTrial.success"),
          {
            action: "manage_trial",
            newStatus: nextStatus ?? fallbackStatus,
            metadata: {
              previousTrialEndsAt: activeOrganization.trial_expires_at ?? null,
              newTrialEndsAt: normalizedTarget.toISOString(),
              changeDays:
                currentTrialEnd && trialStartDate
                  ? differenceInCalendarDays(normalizedTarget, currentTrialEnd)
                  : null,
              reason: trialReason || null,
              immediate,
            },
          }
        );
        setTrialModalOpen(false);
        setTrialReason("");
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: t("settings.billingSubscription.adminActions.manageTrial.error"),
        });
      } finally {
        setTrialLoading(false);
      }
    },
    [
      activeOrganization,
      currentTrialEnd,
      handleMembershipUpdate,
      t,
      toast,
      trialReason,
      trialStartDate,
    ]
  );

  const handleSaveTrialChanges = useCallback(async () => {
    const parsed = parseDateInputValue(trialEndDate);
    if (!parsed || (trialStartDate && parsed.getTime() < trialStartDate.getTime())) {
      toast({
        variant: "destructive",
        title: t("settings.billingSubscription.adminActions.manageTrial.validationError"),
      });
      return;
    }
    await updateTrialEnd(parsed, false);
  }, [t, toast, trialEndDate, trialStartDate, updateTrialEnd]);

  const handleEndTrialNow = useCallback(async () => {
    await updateTrialEnd(new Date(), true);
  }, [updateTrialEnd]);

  const handleGrantPremium = useCallback(async () => {
    if (!activeOrganization) return;
    setPremiumLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const expiresIso = premiumExpiresInput
        ? new Date(`${premiumExpiresInput}T00:00:00Z`).toISOString()
        : null;
      await handleMembershipUpdate(
        {
          membership_status: "premium",
          premium_activated_at: nowIso,
          premium_plan: premiumPlanLabel || "Premium",
          premium_expires_at: expiresIso,
          manual_flag: true,
          manual_flag_reason: premiumNote || null,
        },
        t("settings.billingSubscription.adminActions.grantPremium.success"),
        {
          action: "grant_premium",
          newStatus: "premium",
          metadata: {
            plan: premiumPlanLabel || "Premium",
            expiresAt: expiresIso,
            note: premiumNote || null,
          },
        }
      );
      setPremiumOpen(false);
      setPremiumNote("");
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: t("settings.billingSubscription.adminActions.grantPremium.error"),
      });
    } finally {
      setPremiumLoading(false);
    }
  }, [
    activeOrganization,
    handleMembershipUpdate,
    premiumExpiresInput,
    premiumNote,
    premiumPlanLabel,
    t,
    toast,
  ]);

  return (
    <SettingsPageWrapper>
      {isLoadingState ? (
        <SettingsLoadingSkeleton rows={4} />
      ) : (
        <div className="flex flex-col gap-8">
          <SettingsTwoColumnSection
            sectionId="membership-status"
            title={t("settings.billingSubscription.statusHeading")}
            description={t("settings.billingSubscription.statusMessages.generic")}
          >
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${statusIconClasses}`}>
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-foreground">{statusLabel}</h2>
                    <Badge
                      variant={
                        isSuspended ? "destructive" : isLocked ? "warning" : premiumActive ? "success" : "secondary"
                      }
                      className="text-xs"
                    >
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{statusMessage}</p>
                </div>
              </div>
              {(isLocked || isSuspended) && (
                <div
                  className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                    isSuspended
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {isLocked
                    ? t("settings.billingSubscription.lockedWarning")
                    : t("settings.billingSubscription.statusMessages.suspended")}
                </div>
              )}
            </div>
          </SettingsTwoColumnSection>

          {showTrialSection ? (
            <SettingsTwoColumnSection
              sectionId="trial-timeline"
              title={t("settings.billingSubscription.trialSection.title")}
              description={t("settings.billingSubscription.trialSection.subtitle")}
            >
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("settings.billingSubscription.trialSection.title")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.billingSubscription.trialSection.progressLabel")}
                    </p>
                  </div>
                  <Badge variant={trialStatus.trialExpiresAt ? "info" : "secondary"}>
                    {trialStatus.trialExpiresAt
                      ? trialDaysText
                      : t("settings.billingSubscription.trialSection.notAvailable")}
                  </Badge>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("settings.billingSubscription.trialSection.starts")}
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">{trialStartLabel}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("settings.billingSubscription.trialSection.ends")}
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">{trialEndLabel}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("settings.billingSubscription.trialSection.progressLabel")}</span>
                    <span>{trialProgressPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: trialProgressWidth }}
                    />
                  </div>
                </div>
              </div>
            </SettingsTwoColumnSection>
          ) : null}

          {showPremiumSection ? (
            <SettingsTwoColumnSection
              sectionId="premium-access"
              title={t("settings.billingSubscription.premiumSection.title")}
              description={t("settings.billingSubscription.premiumSection.subtitle")}
            >
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("settings.billingSubscription.premiumSection.planLabel")}
                    </p>
                    <p className="text-xl font-semibold text-foreground">
                      {premiumPlan ?? t("settings.billingSubscription.premiumSection.planPlaceholder")}
                    </p>
                  </div>
                  <Badge variant={premiumActive ? "success" : "secondary"}>
                    {premiumActive
                      ? statusLabel
                      : t("settings.billingSubscription.premiumSection.inactive")}
                  </Badge>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {premiumCardRows.map((row) => (
                    <div key={row.label} className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                      <p className="mt-2 text-base font-semibold text-foreground">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SettingsTwoColumnSection>
          ) : null}

          {isAdminUser ? (
            <SettingsTwoColumnSection
              sectionId="admin-controls"
              title={t("settings.billingSubscription.adminActions.title")}
              description={t("settings.billingSubscription.adminActions.description")}
            >
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{t("settings.billingSubscription.statusHeading")}:</span>
                  <Badge
                    variant={
                      isSuspended ? "destructive" : isLocked ? "warning" : premiumActive ? "success" : "secondary"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => setTrialModalOpen(true)}>
                    {t("settings.billingSubscription.adminActions.manageTrial.button")}
                  </Button>
                  <Button variant="secondary" onClick={() => setPremiumOpen(true)}>
                    {t("settings.billingSubscription.adminActions.grantPremium.button")}
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("settings.billingSubscription.adminActions.saved")}
                </p>
              </div>
            </SettingsTwoColumnSection>
          ) : null}
        </div>
      )}

      <Dialog open={trialModalOpen} onOpenChange={setTrialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("settings.billingSubscription.adminActions.manageTrial.title")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.billingSubscription.adminActions.manageTrial.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("settings.billingSubscription.adminActions.manageTrial.startLabel")}
                </span>
                <span className="font-medium text-foreground">{trialSummaryStart}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-muted-foreground">
                  {t("settings.billingSubscription.adminActions.manageTrial.endLabel")}
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{trialSummaryEnd}</p>
                  {trialStatus.trialExpiresAt ? (
                    <p className="text-xs text-muted-foreground">
                      {t("settings.billingSubscription.trialSection.daysLeft", {
                        count: trialDaysLeft,
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial-end-date">
                {t("settings.billingSubscription.adminActions.manageTrial.dateLabel")}
              </Label>
              <Input
                id="trial-end-date"
                type="date"
                min={trialMinDate}
                value={trialEndDate}
                onChange={(event) => setTrialEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial-reason">
                {t("settings.billingSubscription.adminActions.manageTrial.reasonLabel")}
              </Label>
              <Textarea
                id="trial-reason"
                value={trialReason}
                onChange={(event) => setTrialReason(event.target.value)}
                placeholder={t("settings.billingSubscription.adminActions.manageTrial.reasonPlaceholder")}
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
              {t("settings.billingSubscription.adminActions.manageTrial.endToday")}
            </Button>
            <div className="flex w-full flex-1 justify-end gap-2 sm:w-auto">
              <Button variant="outline" onClick={() => setTrialModalOpen(false)} disabled={trialLoading}>
                {t("settings.billingSubscription.adminActions.cancel")}
              </Button>
              <Button onClick={handleSaveTrialChanges} disabled={trialLoading}>
                {trialLoading
                  ? t("settings.billingSubscription.adminActions.saving")
                  : t("settings.billingSubscription.adminActions.manageTrial.submit")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={premiumOpen} onOpenChange={setPremiumOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("settings.billingSubscription.adminActions.grantPremium.title")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.billingSubscription.adminActions.grantPremium.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="premium-plan">
                {t("settings.billingSubscription.adminActions.grantPremium.planLabel")}
              </Label>
              <Input
                id="premium-plan"
                value={premiumPlanLabel}
                onChange={(event) => setPremiumPlanLabel(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-expires">
                {t("settings.billingSubscription.adminActions.grantPremium.expiresLabel")}
              </Label>
              <Input
                id="premium-expires"
                type="date"
                value={premiumExpiresInput}
                onChange={(event) => setPremiumExpiresInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-note">
                {t("settings.billingSubscription.adminActions.grantPremium.noteLabel")}
              </Label>
              <Textarea
                id="premium-note"
                value={premiumNote}
                onChange={(event) => setPremiumNote(event.target.value)}
                placeholder={t("settings.billingSubscription.adminActions.grantPremium.notePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPremiumOpen(false)} disabled={premiumLoading}>
              {t("settings.billingSubscription.adminActions.cancel")}
            </Button>
            <Button onClick={handleGrantPremium} disabled={premiumLoading}>
              {premiumLoading
                ? t("settings.billingSubscription.adminActions.saving")
                : t("settings.billingSubscription.adminActions.grantPremium.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPageWrapper>
  );
}
