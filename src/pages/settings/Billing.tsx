import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import {
  SettingsCollectionSection,
  SettingsFormSection,
} from "@/components/settings/SettingsSectionVariants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import {
  DEFAULT_ORGANIZATION_TAX_PROFILE,
  OrganizationTaxProfile,
} from "@/lib/organizationSettingsCache";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

const clampVatRate = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99.99, Math.max(0, value));
};

type TaxProfileFormState = {
  legalEntityType: "individual" | "company";
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  billingAddress: string;
  defaultVatRate: string;
  defaultVatMode: "inclusive" | "exclusive";
  pricesIncludeVat: boolean;
};

type TaxProfileFormErrors = Partial<Record<keyof TaxProfileFormState, string>>;

const profileToFormState = (
  profile: OrganizationTaxProfile
): TaxProfileFormState => ({
  legalEntityType: profile.legalEntityType ?? "individual",
  companyName: profile.companyName ?? "",
  taxOffice: profile.taxOffice ?? "",
  taxNumber: profile.taxNumber ?? "",
  billingAddress: profile.billingAddress ?? "",
  defaultVatRate:
    profile.defaultVatRate != null && Number.isFinite(profile.defaultVatRate)
      ? String(profile.defaultVatRate)
      : String(DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatRate),
  defaultVatMode: profile.defaultVatMode ?? "exclusive",
  pricesIncludeVat: profile.pricesIncludeVat ?? false,
});

const normalizeProfile = (profile: OrganizationTaxProfile): OrganizationTaxProfile => {
  const numericVatRate = Number(profile.defaultVatRate);

  return {
    ...DEFAULT_ORGANIZATION_TAX_PROFILE,
    ...profile,
    legalEntityType: profile.legalEntityType === "company" ? "company" : "individual",
    defaultVatMode: profile.defaultVatMode === "inclusive" ? "inclusive" : "exclusive",
    defaultVatRate: clampVatRate(Number.isFinite(numericVatRate) ? numericVatRate : DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatRate),
    pricesIncludeVat: Boolean(profile.pricesIncludeVat),
    companyName: typeof profile.companyName === "string" ? profile.companyName.trim() || null : null,
    taxOffice: typeof profile.taxOffice === "string" ? profile.taxOffice.trim() || null : null,
    taxNumber: typeof profile.taxNumber === "string" ? profile.taxNumber.trim() || null : null,
    billingAddress: typeof profile.billingAddress === "string" ? profile.billingAddress.trim() || null : null,
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
    defaultVatRate: Number.isFinite(parsedRate) ? parsedRate : DEFAULT_ORGANIZATION_TAX_PROFILE.defaultVatRate,
    defaultVatMode: form.defaultVatMode,
    pricesIncludeVat: form.pricesIncludeVat,
  });
};

const isEqualProfile = (a: OrganizationTaxProfile, b: OrganizationTaxProfile) =>
  JSON.stringify(normalizeProfile(a)) === JSON.stringify(normalizeProfile(b));

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

  const [formState, setFormState] = useState<TaxProfileFormState>(() => profileToFormState(normalizedProfile));
  const [errors, setErrors] = useState<TaxProfileFormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormState(profileToFormState(normalizedProfile));
    setErrors({});
  }, [normalizedProfile]);

  const handleChange = useCallback((updates: Partial<TaxProfileFormState>) => {
    setFormState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const validate = useCallback((): boolean => {
    const nextErrors: TaxProfileFormErrors = {};

    if (formState.legalEntityType === "company" && !formState.companyName.trim()) {
      nextErrors.companyName = t("taxBilling.validation.companyNameRequired", { ns: "forms" });
    }

    const vatRateValue = parseFloat(formState.defaultVatRate.replace(",", "."));
    if (formState.defaultVatRate.trim() === "" || Number.isNaN(vatRateValue)) {
      nextErrors.defaultVatRate = t("taxBilling.validation.vatRateInvalid", { ns: "forms" });
    } else if (vatRateValue < 0 || vatRateValue > 99.99) {
      nextErrors.defaultVatRate = t("taxBilling.validation.vatRateRange", { ns: "forms" });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [formState, t]);

  const draftProfile = useMemo(() => formToProfile(formState), [formState]);
  const isDirty = useMemo(() => !isEqualProfile(draftProfile, normalizedProfile), [draftProfile, normalizedProfile]);

  const handleReset = useCallback(() => {
    setFormState(profileToFormState(normalizedProfile));
    setErrors({});
  }, [normalizedProfile]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const result = await updateSettings({ taxProfile: draftProfile });
      if (result.success) {
        toast({
          title: t("toast.success", { ns: "common" }),
          description: t("taxBilling.notifications.saved", { ns: "forms" }),
        });
        setErrors({});
      } else {
        toast({
          title: t("toast.error", { ns: "common" }),
          description: t("taxBilling.notifications.saveFailed", { ns: "forms" }),
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error
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
  }, [draftProfile, toast, t, updateSettings, validate]);

  const taxSectionName = t("settings.billing.title");
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
      "tax-billing",
      taxSectionName,
      () => handlersRef.current.handleSave(),
      () => handlersRef.current.handleCancel()
    );
    return () => {
      unregisterSectionHandler(categoryPath, "tax-billing");
    };
  }, [categoryPath, registerSectionHandler, unregisterSectionHandler, taxSectionName]);

  useEffect(() => {
    setSectionDirty(categoryPath, "tax-billing", isDirty);
  }, [categoryPath, isDirty, setSectionDirty]);

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
                handleChange({
                  legalEntityType: value as TaxProfileFormState["legalEntityType"],
                })
              }
              disabled={loading || saving}
              className="grid gap-3 sm:grid-cols-2"
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
            </RadioGroup>
          </div>
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
                handleChange({ companyName: event.target.value })
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
                handleChange({ taxOffice: event.target.value })
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
                handleChange({ taxNumber: event.target.value })
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
                handleChange({ billingAddress: event.target.value })
              }
              placeholder={t("taxBilling.billingAddress.placeholder", {
                ns: "forms",
              })}
              rows={3}
              disabled={loading || saving}
            />
          </div>
        </SettingsFormSection>

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
                handleChange({ defaultVatRate: event.target.value })
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
                handleChange({
                  defaultVatMode: value as TaxProfileFormState["defaultVatMode"],
                })
              }
              disabled={loading || saving}
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
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-muted-foreground/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {t("taxBilling.pricesIncludeVat.label", { ns: "forms" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("taxBilling.pricesIncludeVat.helper", { ns: "forms" })}
                </p>
              </div>
              <Switch
                id="prices-include-vat"
                checked={formState.pricesIncludeVat}
                onCheckedChange={(checked) =>
                  handleChange({ pricesIncludeVat: checked })
                }
                disabled={loading || saving}
              />
            </div>
          </div>
        </SettingsFormSection>

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
