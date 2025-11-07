import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { TaxBillingSection, TaxProfileFormState, TaxProfileFormErrors } from "@/components/settings/TaxBillingSection";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { DEFAULT_ORGANIZATION_TAX_PROFILE, OrganizationTaxProfile } from "@/lib/organizationSettingsCache";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "@/contexts/SettingsContext";

const clampVatRate = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99.99, Math.max(0, value));
};

const profileToFormState = (profile: OrganizationTaxProfile): TaxProfileFormState => ({
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

  const taxSectionName = t("taxBilling.title", { ns: "forms" });
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
      <div className="space-y-6">
        <TaxBillingSection
          profile={formState}
          errors={errors}
          loading={loading}
          saving={saving}
          onChange={handleChange}
        />
      </div>
    </SettingsPageWrapper>
  );
}
