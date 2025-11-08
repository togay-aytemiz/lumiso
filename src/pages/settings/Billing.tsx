import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import {
  SettingsCollectionSection,
  SettingsFormSection,
} from "@/components/settings/SettingsSectionVariants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import {
  DEFAULT_ORGANIZATION_TAX_PROFILE,
  OrganizationTaxProfile,
} from "@/lib/organizationSettingsCache";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";

const clampVatRate = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99.99, Math.max(0, value));
};

type TaxProfileFormState = {
  legalEntityType: "individual" | "company" | "freelance";
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  billingAddress: string;
  defaultVatRate: string;
  defaultVatMode: "inclusive" | "exclusive";
  vatExempt: boolean;
};

type TaxProfileFormErrors = Partial<Record<keyof TaxProfileFormState, string>>;

const profileToFormState = (
  profile: OrganizationTaxProfile
): TaxProfileFormState => ({
  legalEntityType:
    profile.legalEntityType ?? DEFAULT_ORGANIZATION_TAX_PROFILE.legalEntityType,
  companyName: profile.companyName ?? "",
  taxOffice: profile.taxOffice ?? "",
  taxNumber: profile.taxNumber ?? "",
  billingAddress: profile.billingAddress ?? "",
  defaultVatRate:
    profile.defaultVatRate != null && Number.isFinite(profile.defaultVatRate)
      ? String(profile.defaultVatRate)
      : String(DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatRate),
  defaultVatMode:
    profile.defaultVatMode ?? DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatMode,
  vatExempt: Boolean(profile.vatExempt),
});

const normalizeProfile = (
  profile: OrganizationTaxProfile
): OrganizationTaxProfile => {
  const normalizedEntity: OrganizationTaxProfile["legalEntityType"] =
    profile.legalEntityType === "company"
      ? "company"
      : profile.legalEntityType === "freelance"
      ? "freelance"
      : "individual";
  const vatExempt = Boolean(
    profile.vatExempt || normalizedEntity === "freelance"
  );
  const numericVatRate = Number(profile.defaultVatRate);

  return {
    ...DEFAULT_ORGANIZATION_TAX_PROFILE,
    ...profile,
    legalEntityType: normalizedEntity,
    vatExempt,
    defaultVatMode: vatExempt
      ? "exclusive"
      : profile.defaultVatMode === "inclusive"
      ? "inclusive"
      : "exclusive",
    defaultVatRate: vatExempt
      ? 0
      : clampVatRate(
          Number.isFinite(numericVatRate)
            ? numericVatRate
            : DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatRate
        ),
    pricesIncludeVat: vatExempt
      ? false
      : Boolean(profile.pricesIncludeVat),
    companyName:
      typeof profile.companyName === "string"
        ? profile.companyName.trim() || null
        : null,
    taxOffice:
      typeof profile.taxOffice === "string"
        ? profile.taxOffice.trim() || null
        : null,
    taxNumber:
      typeof profile.taxNumber === "string"
        ? profile.taxNumber.trim() || null
        : null,
    billingAddress:
      typeof profile.billingAddress === "string"
        ? profile.billingAddress.trim() || null
        : null,
  };
};

const formToProfile = (form: TaxProfileFormState): OrganizationTaxProfile => {
  const parsedRate = parseFloat(form.defaultVatRate.replace(",", "."));
  return normalizeProfile({
    legalEntityType: form.legalEntityType,
    companyName: form.companyName.trim() || null,
    taxOffice: form.taxOffice.trim() || null,
    taxNumber: form.taxNumber.trim() || null,
    billingAddress: form.billingAddress.trim() || null,
    defaultVatRate: Number.isFinite(parsedRate)
      ? parsedRate
      : DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatRate,
    defaultVatMode: form.defaultVatMode,
    pricesIncludeVat: form.defaultVatMode === "inclusive",
    vatExempt: form.vatExempt,
  });
};

export default function Billing() {
  const { t } = useTranslation(["pages", "forms", "common"]);
  const { toast } = useToast();
  const { settings, loading, updateSettings } = useOrganizationSettings();
  const location = useLocation();
  const categoryPath = location.pathname;
  const { registerSectionHandler, unregisterSectionHandler, setSectionDirty } = useSettingsContext();

  const normalizedProfile = useMemo(() => {
    const source = settings?.taxProfile as OrganizationTaxProfile | null;
    const merged = normalizeProfile({
      ...DEFAULT_ORGANIZATION_TAX_PROFILE,
      ...(source ?? {}),
      companyName: (source?.companyName ?? settings?.photography_business_name ?? null) || null,
    });
    return merged;
  }, [settings]);

  const savedFormState = useMemo(
    () => profileToFormState(normalizedProfile),
    [normalizedProfile]
  );

  const [formState, setFormState] = useState<TaxProfileFormState>(() => savedFormState);
  const [errors, setErrors] = useState<TaxProfileFormErrors>({});
  const [saving, setSaving] = useState(false);
  const dirtyFieldsRef = useRef<Set<keyof TaxProfileFormState>>(new Set());
  const [dirtyFieldsVersion, setDirtyFieldsVersion] = useState(0);
  const [autoSavingField, setAutoSavingField] = useState<"legalEntityType" | "defaultVatMode" | null>(null);
  const [showVatReminder, setShowVatReminder] = useState(false);

  const NON_FREELANCE_DEFAULT_VAT_RATE = "20";
  const NON_FREELANCE_DEFAULT_VAT_MODE: TaxProfileFormState["defaultVatMode"] = "inclusive";

  const markFieldDirty = useCallback((field?: keyof TaxProfileFormState) => {
    if (!field) return;
    if (!dirtyFieldsRef.current.has(field)) {
      dirtyFieldsRef.current.add(field);
      setDirtyFieldsVersion((version) => version + 1);
    }
  }, []);

  const clearFieldDirty = useCallback((field: keyof TaxProfileFormState) => {
    if (dirtyFieldsRef.current.delete(field)) {
      setDirtyFieldsVersion((version) => version + 1);
    }
  }, []);

  const clearAllDirtyFields = useCallback(() => {
    if (dirtyFieldsRef.current.size > 0) {
      dirtyFieldsRef.current.clear();
      setDirtyFieldsVersion((version) => version + 1);
    }
  }, []);

  useEffect(() => {
    setFormState((prev) => {
      const next = { ...prev };
      (Object.keys(savedFormState) as (keyof TaxProfileFormState)[]).forEach((key) => {
        if (!dirtyFieldsRef.current.has(key)) {
          next[key] = savedFormState[key];
        }
      });
      return next;
    });

    setErrors((prev) => {
      if (!prev || Object.keys(prev).length === 0) {
        return prev;
      }
      const nextErrors = { ...prev };
      (Object.keys(nextErrors) as (keyof TaxProfileFormState)[]).forEach((key) => {
        if (!dirtyFieldsRef.current.has(key)) {
          delete nextErrors[key];
        }
      });
      return nextErrors;
    });
  }, [savedFormState]);

  const handleChange = useCallback(
    (updates: Partial<TaxProfileFormState>, dirtyField?: keyof TaxProfileFormState) => {
      setFormState((prev) => ({
        ...prev,
        ...updates,
      }));
      if (dirtyField) {
        markFieldDirty(dirtyField);
      }
    },
    [markFieldDirty]
  );

  const preserveScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const { scrollX, scrollY } = window;
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }, []);

  const validate = useCallback(
    (state: TaxProfileFormState = formState): boolean => {
      const nextErrors: TaxProfileFormErrors = {};

      if (state.legalEntityType === "company" && !state.companyName.trim()) {
        nextErrors.companyName = t("taxBilling.validation.companyNameRequired", { ns: "forms" });
      }

      const vatRateValue = parseFloat(state.defaultVatRate.replace(",", "."));
      if (state.defaultVatRate.trim() === "" || Number.isNaN(vatRateValue)) {
        nextErrors.defaultVatRate = t("taxBilling.validation.vatRateInvalid", { ns: "forms" });
      } else if (vatRateValue < 0 || vatRateValue > 99.99) {
        nextErrors.defaultVatRate = t("taxBilling.validation.vatRateRange", { ns: "forms" });
      }

      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [formState, t]
  );

  const persistTaxProfile = useCallback(
    async (state: TaxProfileFormState, options?: { skipValidation?: boolean }) => {
      if (!options?.skipValidation) {
        const isValid = validate(state);
        if (!isValid) {
          return false;
        }
      }

      const result = await updateSettings({ taxProfile: formToProfile(state) });
      if (result.error || !result.success) {
        throw new Error(
          result.error?.message ??
            t("taxBilling.notifications.saveFailed", { ns: "forms" })
        );
      }

      return true;
    },
    [t, updateSettings, validate]
  );

  const handleAutoSaveField = useCallback(
    async (
      updates: Partial<TaxProfileFormState>,
      field: "legalEntityType" | "defaultVatMode"
    ) => {
      setFormState((prev) => ({
        ...prev,
        ...updates,
      }));
      if (updates.legalEntityType !== undefined) {
        clearFieldDirty("legalEntityType");
      }
      if (updates.vatExempt !== undefined) {
        clearFieldDirty("vatExempt");
      }
      if (updates.defaultVatRate !== undefined) {
        clearFieldDirty("defaultVatRate");
      }
      if (updates.defaultVatMode !== undefined) {
        clearFieldDirty("defaultVatMode");
      }
      setAutoSavingField(field);
      try {
        const baseState = savedFormState;
        const nextState = {
          ...baseState,
          ...updates,
        };
        await persistTaxProfile(nextState, { skipValidation: true });
        setErrors((prev) => {
          if (!prev || Object.keys(prev).length === 0) {
            return prev;
          }
          const nextErrors = { ...prev };
          if (updates.legalEntityType !== undefined) {
            delete nextErrors.companyName;
            delete nextErrors.defaultVatRate;
          }
          if (updates.defaultVatMode !== undefined) {
            delete nextErrors.defaultVatRate;
          }
          return nextErrors;
        });
        toast({
          title: t("toast.settingsAutoSavedTitle", { ns: "common" }),
          description: t("toast.settingsAutoSavedSection", {
            ns: "common",
            section: t("settings.billing.taxSectionTitle"),
          }),
          duration: 2500,
        });
      } catch (error) {
        const fallback = savedFormState;
        setFormState((prev) => ({
          ...prev,
          ...(field === "legalEntityType"
            ? {
                legalEntityType: fallback.legalEntityType,
                vatExempt: fallback.vatExempt,
                defaultVatRate: fallback.defaultVatRate,
              }
            : {
                defaultVatMode: fallback.defaultVatMode,
              }),
        }));
        toast({
          title: t("toast.error", { ns: "common" }),
          description:
            error instanceof Error
              ? error.message
              : t("taxBilling.notifications.saveFailed", { ns: "forms" }),
          variant: "destructive",
        });
      } finally {
        setAutoSavingField(null);
      }
    },
    [clearFieldDirty, persistTaxProfile, savedFormState, t, toast]
  );

  const handleEntityTypeChange = useCallback(
    (value: TaxProfileFormState["legalEntityType"]) => {
      const vatFree = value === "freelance";
      const updates: Partial<TaxProfileFormState> = {
        legalEntityType: value,
        vatExempt: vatFree,
      };
      if (vatFree) {
        updates.defaultVatRate = "0";
        setShowVatReminder(false);
      } else {
        updates.defaultVatRate = NON_FREELANCE_DEFAULT_VAT_RATE;
        updates.defaultVatMode = NON_FREELANCE_DEFAULT_VAT_MODE;
        if (formState.legalEntityType === "freelance") {
          setShowVatReminder(true);
        }
      }
      handleAutoSaveField(updates, "legalEntityType");
    },
    [formState.defaultVatRate, formState.legalEntityType, handleAutoSaveField]
  );

  const handleVatModeChange = useCallback(
    (value: "inclusive" | "exclusive") => {
      preserveScrollPosition();
      handleAutoSaveField({ defaultVatMode: value }, "defaultVatMode");
    },
    [handleAutoSaveField, preserveScrollPosition]
  );

  const handleReset = useCallback(() => {
    clearAllDirtyFields();
    setFormState(savedFormState);
    setErrors({});
  }, [clearAllDirtyFields, savedFormState]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const success = await persistTaxProfile(formState);
      if (!success) {
        return;
      }
      clearAllDirtyFields();
      toast({
        title: t("toast.success", { ns: "common" }),
        description: t("taxBilling.notifications.saved", { ns: "forms" }),
      });
      setErrors({});
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("taxBilling.notifications.saveFailed", { ns: "forms" });
      toast({
        title: t("toast.error", { ns: "common" }),
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [clearAllDirtyFields, formState, persistTaxProfile, t, toast]);

  const taxSectionId = "client-billing-company";
  const taxSectionName = t("settings.billing.companySectionTitle");
  const handlersRef = useRef({
    handleSave: async () => {
      /* noop */
    },
    handleCancel: () => {
      /* noop */
    },
  });

  useEffect(() => {
    handlersRef.current = {
      handleSave: async () => {
        await handleSave();
      },
      handleCancel: () => {
        handleReset();
      },
    };
  }, [handleReset, handleSave]);

  useEffect(() => {
    registerSectionHandler(
      categoryPath,
      taxSectionId,
      taxSectionName,
      () => handlersRef.current.handleSave(),
      () => handlersRef.current.handleCancel()
    );
    return () => {
      unregisterSectionHandler(categoryPath, taxSectionId);
    };
  }, [categoryPath, registerSectionHandler, unregisterSectionHandler, taxSectionId, taxSectionName]);

  useEffect(() => {
    setSectionDirty(categoryPath, taxSectionId, dirtyFieldsRef.current.size > 0);
  }, [categoryPath, dirtyFieldsVersion, setSectionDirty, taxSectionId]);

  const showVatFields = !formState.vatExempt;
  const isFreelance = formState.legalEntityType === "freelance";

  return (
    <SettingsPageWrapper>
      <div className="space-y-8">
        <SettingsFormSection
          sectionId="client-billing-company"
          title={t("settings.billing.companySectionTitle")}
          description={t("settings.billing.companySectionDescription")}
          fieldColumns={2}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm font-medium">
              {t("taxBilling.legalEntity.label", { ns: "forms" })}
            </Label>
            <RadioGroup
              value={formState.legalEntityType}
              onValueChange={(value) =>
                handleEntityTypeChange(
                  value as TaxProfileFormState["legalEntityType"]
                )
              }
              disabled={loading || saving || autoSavingField === "legalEntityType"}
              className="grid gap-3 sm:grid-cols-3"
            >
              <label
                htmlFor="entity-individual"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  formState.legalEntityType === "individual"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem
                  id="entity-individual"
                  value="individual"
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    {t("taxBilling.legalEntity.individual", { ns: "forms" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("taxBilling.legalEntity.individualHint", { ns: "forms" })}
                  </p>
                </div>
              </label>
              <label
                htmlFor="entity-company"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  formState.legalEntityType === "company"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem
                  id="entity-company"
                  value="company"
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    {t("taxBilling.legalEntity.company", { ns: "forms" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("taxBilling.legalEntity.companyHint", { ns: "forms" })}
                  </p>
                </div>
              </label>
              <label
                htmlFor="entity-freelance"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  formState.legalEntityType === "freelance"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem
                  id="entity-freelance"
                  value="freelance"
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    {t("taxBilling.legalEntity.freelance", { ns: "forms" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("taxBilling.legalEntity.freelanceHint", { ns: "forms" })}
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
          {!isFreelance && showVatReminder && (
            <div className="sm:col-span-2">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {t("taxBilling.freelanceWarning.title", { ns: "forms" })}
                  </p>
                  <p>{t("taxBilling.freelanceWarning.description", { ns: "forms" })}</p>
                </div>
                <Button
                  type="button"
                  variant="tinted"
                  colorScheme="amber"
                  size="icon"
                  className="ml-auto shrink-0"
                  onClick={() => setShowVatReminder(false)}
                  aria-label={t("taxBilling.freelanceWarning.dismiss", { ns: "forms" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {!isFreelance && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  {t("taxBilling.companyName.label", { ns: "forms" })}
                  {formState.legalEntityType === "company" && (
                    <span className="text-rose-500"> *</span>
                  )}
                </Label>
                <Input
                  id="companyName"
                  value={formState.companyName}
                  onChange={(event) =>
                    handleChange({ companyName: event.target.value }, "companyName")
                  }
                  placeholder={t("taxBilling.companyName.placeholder", {
                    ns: "forms",
                  })}
                  disabled={loading || saving}
                />
                {errors.companyName ? (
                  <p className="text-xs text-destructive">{errors.companyName}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("taxBilling.companyName.helper", { ns: "forms" })}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxOffice">
                  {t("taxBilling.taxOffice.label", { ns: "forms" })}
                </Label>
                <Input
                  id="taxOffice"
                  value={formState.taxOffice}
                  onChange={(event) =>
                    handleChange({ taxOffice: event.target.value }, "taxOffice")
                  }
                  placeholder={t("taxBilling.taxOffice.placeholder", {
                    ns: "forms",
                  })}
                  disabled={loading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxNumber">
                  {t("taxBilling.taxNumber.label", { ns: "forms" })}
                </Label>
                <Input
                  id="taxNumber"
                  value={formState.taxNumber}
                  onChange={(event) =>
                    handleChange({ taxNumber: event.target.value }, "taxNumber")
                  }
                  placeholder={t("taxBilling.taxNumber.placeholder", {
                    ns: "forms",
                  })}
                  disabled={loading || saving}
                />
                <p className="text-xs text-muted-foreground">
                  {t("taxBilling.taxNumber.helper", { ns: "forms" })}
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billingAddress">
                  {t("taxBilling.billingAddress.label", { ns: "forms" })}
                </Label>
                <Textarea
                  id="billingAddress"
                  value={formState.billingAddress}
                  onChange={(event) =>
                    handleChange({ billingAddress: event.target.value }, "billingAddress")
                  }
                  placeholder={t("taxBilling.billingAddress.placeholder", {
                    ns: "forms",
                  })}
                  rows={3}
                  disabled={loading || saving}
                />
              </div>
            </>
          )}
        </SettingsFormSection>

        {showVatFields && (
          <SettingsFormSection
            sectionId="client-billing-tax"
            title={t("settings.billing.taxSectionTitle")}
            description={t("settings.billing.taxSectionDescription")}
            fieldColumns={2}
          >
          <div className="space-y-2">
            <Label htmlFor="vatRate">
              {t("taxBilling.defaultVatRate.label", { ns: "forms" })}
            </Label>
            <Input
              id="vatRate"
              type="number"
              min={0}
              max={99.99}
              step="0.01"
              inputMode="decimal"
              value={formState.defaultVatRate}
              onChange={(event) =>
                handleChange({ defaultVatRate: event.target.value }, "defaultVatRate")
              }
              disabled={loading || saving}
            />
            {errors.defaultVatRate ? (
              <p className="text-xs text-destructive">{errors.defaultVatRate}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("taxBilling.defaultVatRate.helper", { ns: "forms" })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("taxBilling.defaultVatMode.label", { ns: "forms" })}</Label>
            <RadioGroup
              value={formState.defaultVatMode}
              onValueChange={(value) =>
                handleVatModeChange(
                  value as TaxProfileFormState["defaultVatMode"]
                )
              }
              disabled={loading || saving || autoSavingField === "defaultVatMode"}
              className="grid gap-3"
            >
              <label
                htmlFor="vat-mode-inclusive"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  formState.defaultVatMode === "inclusive"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem
                  id="vat-mode-inclusive"
                  value="inclusive"
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    {t("taxBilling.defaultVatMode.inclusive", { ns: "forms" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("taxBilling.defaultVatMode.inclusiveHint", {
                      ns: "forms",
                    })}
                  </p>
                </div>
              </label>
              <label
                htmlFor="vat-mode-exclusive"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                  formState.defaultVatMode === "exclusive"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem
                  id="vat-mode-exclusive"
                  value="exclusive"
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">
                    {t("taxBilling.defaultVatMode.exclusive", { ns: "forms" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("taxBilling.defaultVatMode.exclusiveHint", {
                      ns: "forms",
                    })}
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </SettingsFormSection>
        )}

        <SettingsCollectionSection
          sectionId="client-billing-payment-methods"
          title={t("settings.billing.paymentMethodsTitle")}
          description={t("settings.billing.paymentMethodsDescription")}
          bodyClassName="p-0"
        >
          <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/10 p-6 text-sm text-muted-foreground">
            {t("settings.billing.paymentMethodsPlaceholder")}
          </div>
        </SettingsCollectionSection>
      </div>
    </SettingsPageWrapper>
  );
}
