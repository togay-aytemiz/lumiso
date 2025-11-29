import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import ReactCalendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "@/components/react-calendar.css";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon } from "lucide-react";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useI18nToast } from "@/lib/toastHelpers";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { cn, getDateFnsLocale, getUserLocale } from "@/lib/utils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import {
  DEFAULT_DEPOSIT_CONFIG,
  computeDepositAmount,
  type DepositMode,
  type ProjectDepositConfig
} from "@/lib/payments/depositUtils";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { recalculateProjectOutstanding } from "@/lib/payments/outstanding";

interface DepositSetupDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ProjectDepositConfig | null;
  basePrice: number;
  extrasTotal: number;
  contractTotal: number;
  onConfigSaved: (config: ProjectDepositConfig) => Promise<void> | void;
}

interface DepositPaymentDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: number;
  depositPaid: number;
  onCompleted: () => Promise<void> | void;
}

const DEFAULT_LABEL = "Kapora";
const DEPOSIT_PERCENT_PRESETS = [5, 10, 25, 50];

const formatCurrency = (amount: number) => {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Math.round(amount)} TRY`;
  }
};

export function ProjectDepositSetupDialog({
  projectId,
  open,
  onOpenChange,
  config,
  basePrice,
  extrasTotal,
  contractTotal,
  onConfigSaved
}: DepositSetupDialogProps) {
  const { t } = useFormsTranslation();
  const toast = useI18nToast();

  const parsedConfig = config ?? DEFAULT_DEPOSIT_CONFIG;

  const [mode, setMode] = useState<DepositMode>(parsedConfig.mode);
  const [value, setValue] = useState<string>(
    parsedConfig.value != null ? String(parsedConfig.value) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastEnabledMode, setLastEnabledMode] = useState<Exclude<DepositMode, "none">>(
    parsedConfig.mode === "none"
      ? "percent_total"
      : parsedConfig.mode === "fixed"
      ? "fixed"
      : parsedConfig.mode
  );
  const preservedLabel = parsedConfig.due_label?.trim() || DEFAULT_LABEL;
  const preservedDescription =
    parsedConfig.description != null && parsedConfig.description.trim().length > 0
      ? parsedConfig.description.trim()
      : undefined;

  useEffect(() => {
    if (!open) return;
    setMode(parsedConfig.mode);
    setValue(
      parsedConfig.mode === "none"
        ? ""
        : parsedConfig.value != null
        ? String(parsedConfig.value)
        : parsedConfig.mode === "fixed"
        ? ""
        : "25"
    );
    setLastEnabledMode(
      parsedConfig.mode === "none"
        ? "percent_total"
        : parsedConfig.mode === "fixed"
        ? "fixed"
        : parsedConfig.mode
    );
  }, [open, parsedConfig]);

  const context = useMemo(
    () => ({
      basePrice,
      extrasTotal,
      contractTotal
    }),
    [basePrice, extrasTotal, contractTotal]
  );

  const numericValue = useMemo(() => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  }, [value]);

  const isEnabled = mode !== "none";
  const isPercentMode = mode === "percent_base" || mode === "percent_total" || mode === "none";
  const uiMode = isEnabled ? (mode === "fixed" ? "fixed" : "percent") : "percent";
  const percentTarget = mode === "percent_base" ? "base" : "total";
  const activePreset = useMemo(() => {
    if (!isPercentMode) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return DEPOSIT_PERCENT_PRESETS.includes(numeric) ? numeric : null;
  }, [isPercentMode, value]);

  const computedAmount = useMemo(() => {
    const config: ProjectDepositConfig = {
      mode,
      value: numericValue,
      due_label: preservedLabel,
      ...(preservedDescription ? { description: preservedDescription } : {})
    };
    return computeDepositAmount(config, context);
  }, [context, mode, numericValue, preservedDescription, preservedLabel]);

  const hasChanges = useMemo(() => {
    const initialValue =
      parsedConfig.mode === "none"
        ? null
        : parsedConfig.value != null
        ? Number(parsedConfig.value)
        : null;
    const currentValue = mode === "none" ? null : numericValue ?? null;
    return parsedConfig.mode !== mode || initialValue !== currentValue;
  }, [parsedConfig, mode, numericValue]);

  const navigation = useModalNavigation({
    isDirty: hasChanges,
    onDiscard: () => {
      setMode(parsedConfig.mode);
      setValue(
        parsedConfig.mode === "none"
          ? ""
          : parsedConfig.value != null
          ? String(parsedConfig.value)
          : parsedConfig.mode === "fixed"
          ? ""
          : "25"
      );
      onOpenChange(false);
    }
  });

  const handleSave = async () => {
    if (mode !== "none") {
      if (numericValue == null) {
        toast.error(
          mode === "fixed"
            ? t("payments.deposit.validation.amount_required", {
                defaultValue: "Enter a valid deposit amount."
              })
            : t("payments.deposit.validation.percent_required", {
                defaultValue: "Enter a valid deposit percentage."
              })
        );
        return;
      }
      if ((mode === "percent_base" || mode === "percent_total") && numericValue > 100) {
        toast.error(
          t("payments.deposit.validation.percent_range", {
            defaultValue: "Percentage must be 0-100."
          })
        );
        return;
      }
    }

    const basePayload: ProjectDepositConfig = {
      mode: mode === "none" ? "none" : mode,
      value: mode === "none" ? null : numericValue ?? 0,
      due_label: preservedLabel
    };
    const payload =
      preservedDescription != null
        ? { ...basePayload, description: preservedDescription }
        : basePayload;

    const shouldSnapshot = mode !== "none" && computedAmount > 0;
    const snapshotTimestamp = new Date().toISOString();
    const payloadWithSnapshot: ProjectDepositConfig = {
      ...payload,
      snapshot_amount: shouldSnapshot ? computedAmount : null,
      snapshot_total: shouldSnapshot ? contractTotal : null,
      snapshot_locked_at: shouldSnapshot ? snapshotTimestamp : null,
      snapshot_acknowledged_amount: shouldSnapshot ? computedAmount : null
    };

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ deposit_config: payloadWithSnapshot })
        .eq("id", projectId);

      if (error) throw error;

      await onConfigSaved(payloadWithSnapshot);
      toast.success(
        t("payments.deposit.setup_success", {
          defaultValue: "Deposit details updated."
        })
      );
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("payments.error_loading", {
              defaultValue: "An unexpected error occurred."
            });
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const footerActions = [
    {
      label: t("buttons.cancel", { defaultValue: "Cancel" }),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: isSaving
    },
    {
      label: isSaving
        ? t("payments.updating", { defaultValue: "Updating..." })
        : t("payments.deposit.setup_action", { defaultValue: "Save deposit" }),
      onClick: () => void handleSave(),
      disabled: isSaving,
      loading: isSaving
    }
  ];

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  const previewDetails = useMemo(() => {
    if (!isEnabled) {
      return {
        state: "disabled" as const,
        message: t("payments.deposit.preview.none", {
          defaultValue: "Deposit disabled for this project."
        })
      };
    }
    if (!(computedAmount > 0)) {
      return {
        state: "pending" as const,
        message: t("payments.deposit.preview.zero", {
          defaultValue: "Deposit will be calculated when totals are available."
        })
      };
    }
    const formatted = formatCurrency(computedAmount);
    const messageTemplate = t("payments.deposit.preview.amount", {
      amount: formatted,
      defaultValue: "Calculated deposit: {{amount}}"
    });
    const labelText = messageTemplate.replace(formatted, "").replace(/\s+/g, " ").trim();
    const fallbackLabel = t("payments.deposit.preview.amount", {
      amount: "",
      defaultValue: "Calculated deposit"
    })
      .replace(/\s+/g, " ")
      .trim();
    return {
      state: "ready" as const,
      formatted,
      label: labelText || fallbackLabel
    };
  }, [computedAmount, isEnabled, t]);

  return (
    <>
      <AppSheetModal
        title={t("payments.deposit.setup_title", { defaultValue: "Configure deposit" })}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="md"
        dirty={hasChanges}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {t("payments.deposit.enable_label", {
                    defaultValue: "Request a deposit to secure the booking."
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("payments.deposit.enable_helper", {
                    defaultValue: "Ask for a prepayment to confirm the reservation."
                  })}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    if (mode !== "none") {
                      setLastEnabledMode(mode === "none" ? lastEnabledMode : mode);
                    }
                    setMode("none");
                    return;
                  }
                  const restored =
                    lastEnabledMode === "fixed"
                      ? "fixed"
                      : lastEnabledMode === "percent_base"
                      ? "percent_base"
                      : "percent_total";
                  setMode(restored);
                  setLastEnabledMode(restored);
                  setValue((prev) => {
                    if (prev.trim()) return prev;
                    return restored === "fixed" ? "" : "25";
                  });
                }}
              />
            </div>
          </div>

          {isEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="block text-sm font-semibold text-slate-900">
                  {t("payments.deposit.mode_label", { defaultValue: "Deposit type" })}
                </Label>
                <SegmentedControl
                  className="mt-1"
                  value={uiMode}
                  onValueChange={(next) => {
                    if (next === "percent") {
                      const restored =
                        mode === "percent_base" || mode === "percent_total"
                          ? mode
                          : lastEnabledMode === "percent_base"
                          ? "percent_base"
                          : "percent_total";
                      setMode(restored);
                      setLastEnabledMode(restored);
                      setValue((prev) => {
                        if (prev.trim()) return prev;
                        return "25";
                      });
                    } else {
                      setMode("fixed");
                      setLastEnabledMode("fixed");
                      setValue((prev) => {
                        if (mode === "fixed" && prev.trim()) {
                          return prev;
                        }
                        return "";
                      });
                    }
                  }}
                  options={[
                    {
                      value: "percent",
                      label: (
                        <span className="whitespace-nowrap">
                          {t("payments.deposit.mode_percent_button", { defaultValue: "Percentage" })}
                        </span>
                      )
                    },
                    {
                      value: "fixed",
                      label: (
                        <span className="whitespace-nowrap">
                          {t("payments.deposit.mode.fixed", { defaultValue: "Fixed amount" })}
                        </span>
                      )
                    }
                  ]}
                />
              </div>

              {uiMode === "percent" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {t("payments.deposit.percent_helper", {
                      defaultValue:
                        "When services are included in the package, the deposit is calculated from the package price."
                    })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {DEPOSIT_PERCENT_PRESETS.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={activePreset === preset ? "default" : "outline"}
                        onClick={() => setValue(String(preset))}
                      >
                        {preset}%
                      </Button>
                    ))}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {t("payments.deposit.custom_percent_label", { defaultValue: "Custom %" })}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        className="h-8 w-24"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="block text-sm font-semibold text-slate-900">
                      {t("payments.deposit.percent_target_label", {
                        defaultValue: "Apply percentage to"
                      })}
                    </Label>
                    <SegmentedControl
                      className="mt-1"
                      value={percentTarget}
                      onValueChange={(next) => {
                        const targetMode = next === "base" ? "percent_base" : "percent_total";
                        setMode(targetMode);
                        setLastEnabledMode(targetMode);
                      }}
                      options={[
                        {
                          value: "total",
                          label: (
                            <span className="whitespace-nowrap">
                              {t("payments.deposit.percent_target_total", {
                                defaultValue: "Package + services total"
                              })}
                            </span>
                          )
                        },
                        {
                          value: "base",
                          label: (
                            <span className="whitespace-nowrap">
                              {t("payments.deposit.percent_target_base", {
                                defaultValue: "Base package only"
                              })}
                            </span>
                          )
                        }
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("payments.amount_try", { defaultValue: "Amount (TRY)" })}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </>
          )}

          {previewDetails.state === "ready" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <span className="font-medium">{previewDetails.label}</span>
              <Badge
                variant="outline"
                className="ml-auto border-emerald-200 bg-white/80 text-base font-semibold text-emerald-700"
              >
                {previewDetails.formatted}
              </Badge>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {previewDetails.message}
            </div>
          )}
        </div>
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}

export function ProjectDepositPaymentDialog({
  projectId,
  open,
  onOpenChange,
  depositAmount,
  depositPaid,
  onCompleted
}: DepositPaymentDialogProps) {
  const { t } = useFormsTranslation();
  const toast = useI18nToast();
  const browserLocale = getUserLocale();

  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [datePaid, setDatePaid] = useState<Date | undefined>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const initialDateRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    initialDateRef.current = now;
    setAmount("");
    setDescription("");
    setDatePaid(now);
  }, [open, depositAmount, depositPaid]);

  const remainingAmount = Math.max(depositAmount - depositPaid, 0);

  const dateChanged =
    Boolean(datePaid && initialDateRef.current && !Number.isNaN(datePaid.getTime())) &&
    !isSameDay(datePaid as Date, initialDateRef.current as Date);

  const isDirty = Boolean(amount.trim() || description.trim() || dateChanged);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      onOpenChange(false);
    }
  });

  const handleSave = async () => {
    if (!amount.trim()) {
      toast.error(t("payments.amount_required", { defaultValue: "Amount is required" }));
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(
        t("payments.deposit.amount_invalid", {
          defaultValue: "Enter a valid deposit amount greater than zero."
        })
      );
      return;
    }

    if (remainingAmount > 0 && parsedAmount - remainingAmount > 0.01) {
      toast.error(
        t("payments.deposit.amount_exceeds_remaining", {
          remaining: remainingAmount.toFixed(2),
          defaultValue: "The amount exceeds the remaining deposit ({{remaining}})."
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(
          t("payments.user_not_authenticated", { defaultValue: "User not authenticated" })
        );
      }
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error(
          t("payments.organization_required", { defaultValue: "Organization required" })
        );
      }

      const paymentDate =
        datePaid?.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0];

      const { error: insertError } = await supabase.from("payments").insert({
        project_id: projectId,
        user_id: user.id,
        organization_id: organizationId,
        amount: parsedAmount,
        description: description.trim() || null,
        status: "paid",
        date_paid: paymentDate,
        type: "deposit_payment",
        deposit_allocation: parsedAmount
      });

      if (insertError) throw insertError;

      await recalculateProjectOutstanding(projectId);
      toast.success(
        t("payments.deposit.payment_success", {
          defaultValue: "Deposit payment recorded."
        })
      );
      await onCompleted();
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("payments.error_loading", { defaultValue: "An unexpected error occurred." });
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const footerActions = [
    {
      label: t("buttons.cancel", { defaultValue: "Cancel" }),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: isSaving
    },
    {
      label: isSaving
        ? t("payments.adding", { defaultValue: "Adding..." })
        : t("payments.deposit.payment_action", { defaultValue: "Record payment" }),
      onClick: () => void handleSave(),
      disabled: isSaving,
      loading: isSaving
    }
  ];

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <AppSheetModal
        title={t("payments.deposit.payment_title", { defaultValue: "Record deposit payment" })}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="content"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("payments.deposit.remaining_info", {
              remaining: remainingAmount.toFixed(2),
              defaultValue: "Remaining deposit: {{remaining}} TRY"
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deposit-payment-amount">
                {t("payments.amount_try", { defaultValue: "Amount (TRY)" })} *
              </Label>
              {(remainingAmount > 0 || depositAmount > 0) && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs font-semibold"
                  onClick={() => {
                    const target = remainingAmount > 0 ? remainingAmount : depositAmount;
                    setAmount(target > 0 ? target.toFixed(2) : "");
                  }}
                >
                  {remainingAmount > 0
                    ? t("payments.deposit.fill_remaining", {
                        defaultValue: "Use remaining amount"
                      })
                    : t("payments.deposit.fill_full", {
                        defaultValue: "Use full deposit"
                      })}
                </Button>
              )}
            </div>
            <Input
              id="deposit-payment-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit-payment-description">
              {t("payments.description", { defaultValue: "Description" })}
            </Label>
            <Textarea
              id="deposit-payment-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("payments.deposit.payment_description_placeholder", {
                defaultValue: "Optional note for the payment"
              })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("payments.date_paid", { defaultValue: "Payment Date" })}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !datePaid && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {datePaid
                    ? format(datePaid, "PPP", { locale: getDateFnsLocale() })
                    : t("payments.pick_date", { defaultValue: "Select a date" })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto min-w-[18rem] p-0 rounded-xl border border-border shadow-md">
                <div className="p-2">
                  <ReactCalendar
                    className="react-calendar w-full p-2 pointer-events-auto"
                    locale={browserLocale}
                    view="month"
                    minDetail="month"
                    next2Label={null}
                    prev2Label={null}
                    onChange={(value) => {
                      const picked = Array.isArray(value) ? value[0] : value;
                      setDatePaid(picked ?? undefined);
                    }}
                    value={datePaid ?? null}
                    formatShortWeekday={(_, date) =>
                      new Intl.DateTimeFormat(browserLocale, { weekday: "short" }).format(date)
                    }
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}
