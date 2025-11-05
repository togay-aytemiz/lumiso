import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
  depositDue:
    | {
        id: string;
        amount: number;
        status: "paid" | "due";
        date_paid: string | null;
        description: string | null;
      }
    | null;
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
  const [label, setLabel] = useState<string>(parsedConfig.due_label ?? DEFAULT_LABEL);
  const [description, setDescription] = useState<string>(parsedConfig.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastEnabledMode, setLastEnabledMode] = useState<Exclude<DepositMode, "none">>(
    parsedConfig.mode === "none"
      ? "percent_total"
      : parsedConfig.mode === "fixed"
      ? "fixed"
      : parsedConfig.mode
  );

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
    setLabel(parsedConfig.due_label ?? DEFAULT_LABEL);
    setDescription(parsedConfig.description ?? "");
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
      description,
      due_label: label
    };
    return computeDepositAmount(config, context);
  }, [context, description, label, mode, numericValue]);

  const hasChanges = useMemo(() => {
    const normalizedInitial = {
      mode: parsedConfig.mode,
      value:
        parsedConfig.mode === "none"
          ? null
          : parsedConfig.value != null
          ? Number(parsedConfig.value)
          : null,
      label: parsedConfig.due_label ?? DEFAULT_LABEL,
      description: parsedConfig.description ?? ""
    };
    const normalizedCurrent = {
      mode,
      value: mode === "none" ? null : numericValue ?? null,
      label,
      description
    };
    return (
      normalizedInitial.mode !== normalizedCurrent.mode ||
      normalizedInitial.value !== normalizedCurrent.value ||
      normalizedInitial.label !== normalizedCurrent.label ||
      normalizedInitial.description !== normalizedCurrent.description
    );
  }, [parsedConfig, mode, numericValue, label, description]);

  const navigation = useModalNavigation({
    isDirty: hasChanges,
    onDiscard: () => {
      setMode(parsedConfig.mode);
      setValue(parsedConfig.value != null ? String(parsedConfig.value) : "");
      setLabel(parsedConfig.due_label ?? DEFAULT_LABEL);
      setDescription(parsedConfig.description ?? "");
      onOpenChange(false);
    }
  });

  const handleSave = async () => {
    const trimmedLabel = label.trim() || DEFAULT_LABEL;
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

    const payload: ProjectDepositConfig =
      mode === "none"
        ? { ...DEFAULT_DEPOSIT_CONFIG, mode: "none", value: null, due_label: trimmedLabel }
        : {
            mode,
            value: numericValue ?? 0,
            due_label: trimmedLabel,
            description: description.trim() || undefined
          };

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ deposit_config: payload })
        .eq("id", projectId);

      if (error) throw error;

      await onConfigSaved(payload);
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

  const previewLabel = useMemo(() => {
    if (mode === "none") {
      return t("payments.deposit.preview.none", {
        defaultValue: "Deposit disabled for this project."
      });
    }
    if (!computedAmount) {
      return t("payments.deposit.preview.zero", {
        defaultValue: "Deposit will be calculated when totals are available."
      });
    }
    return t("payments.deposit.preview.amount", {
      amount: formatCurrency(computedAmount),
      defaultValue: "Calculated deposit: {{amount}}"
    });
  }, [computedAmount, mode, t]);

  return (
    <>
      <AppSheetModal
        title={t("payments.deposit.setup_title", { defaultValue: "Configure deposit" })}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="lg"
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
              <div className="space-y-2">
                <Label>{t("payments.deposit.mode_label", { defaultValue: "Deposit type" })}</Label>
                <SegmentedControl
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
                      label: t("payments.deposit.mode_percent_button", { defaultValue: "Percentage" })
                    },
                    {
                      value: "fixed",
                      label: t("payments.deposit.mode.fixed", { defaultValue: "Fixed amount" })
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

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {t("payments.deposit.percent_target_label", {
                        defaultValue: "Apply percentage to"
                      })}
                    </Label>
                    <SegmentedControl
                      value={percentTarget}
                      onValueChange={(next) => {
                        const targetMode = next === "base" ? "percent_base" : "percent_total";
                        setMode(targetMode);
                        setLastEnabledMode(targetMode);
                      }}
                      options={[
                        {
                          value: "total",
                          label: t("payments.deposit.percent_target_total", {
                            defaultValue: "Package + services total"
                          })
                        },
                        {
                          value: "base",
                          label: t("payments.deposit.percent_target_base", {
                            defaultValue: "Base package only"
                          })
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

              <div className="space-y-2">
                <Label>{t("payments.deposit.label", { defaultValue: "Deposit label" })}</Label>
                <Input value={label} onChange={(event) => setLabel(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>
                  {t("payments.deposit.description_label", {
                    defaultValue: "Internal note (optional)"
                  })}
                </Label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("payments.deposit.description_placeholder", {
                    defaultValue: "Add context that will appear on the scheduled deposit."
                  })}
                />
              </div>
            </>
          )}

          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            {previewLabel}
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

export function ProjectDepositPaymentDialog({
  projectId,
  open,
  onOpenChange,
  depositDue,
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

  useEffect(() => {
    if (!open) return;
    const remaining = Math.max(depositAmount - depositPaid, 0);
    setAmount(remaining > 0 ? remaining.toFixed(2) : depositAmount.toFixed(2));
    setDescription("");
    setDatePaid(new Date());
  }, [open, depositAmount, depositPaid]);

  const remainingAmount = Math.max(depositAmount - depositPaid, 0);

  const isDirty =
    Boolean(amount.trim() || description.trim()) ||
    (datePaid && !Number.isNaN(datePaid.getTime()));

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
        type: "deposit_payment"
      });

      if (insertError) throw insertError;

      if (depositDue) {
        const newRemaining = Math.max(depositAmount - (depositPaid + parsedAmount), 0);
        const updatePayload: Record<string, unknown> = {
          status: newRemaining <= 0 ? "paid" : "due",
          type: "deposit_due"
        };
        if (newRemaining <= 0) {
          updatePayload.date_paid = paymentDate;
        }
        const { error: updateError } = await supabase
          .from("payments")
          .update(updatePayload)
          .eq("id", depositDue.id);
        if (updateError) throw updateError;
      }

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
            <Label htmlFor="deposit-payment-amount">
              {t("payments.amount_try", { defaultValue: "Amount (TRY)" })} *
            </Label>
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
