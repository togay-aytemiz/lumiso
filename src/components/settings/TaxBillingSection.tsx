import { ChangeEvent } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export type TaxProfileFormState = {
  legalEntityType: "individual" | "company";
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  billingAddress: string;
  defaultVatRate: string;
  defaultVatMode: "inclusive" | "exclusive";
  pricesIncludeVat: boolean;
};

export type TaxProfileFormErrors = Partial<Record<keyof TaxProfileFormState, string>>;

interface TaxBillingSectionProps {
  profile: TaxProfileFormState;
  errors: TaxProfileFormErrors;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  onChange: (updates: Partial<TaxProfileFormState>) => void;
  onSave: () => void;
  onReset: () => void;
}

export function TaxBillingSection({
  profile,
  errors,
  loading,
  saving,
  dirty,
  onChange,
  onSave,
  onReset,
}: TaxBillingSectionProps) {
  const { t } = useTranslation("forms");

  const handleInput =
    (field: keyof TaxProfileFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({ [field]: event.target.value });
    };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">
            {t("taxBilling.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("taxBilling.description")}
          </p>
        </div>
        {dirty ? (
          <Badge variant="secondary">{t("taxBilling.unsaved")}</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("taxBilling.legalEntity.label")}</Label>
            <RadioGroup
              value={profile.legalEntityType}
              onValueChange={(value) => onChange({ legalEntityType: value as TaxProfileFormState["legalEntityType"] })}
              className="grid gap-2"
              disabled={loading || saving}
            >
              <Label
                htmlFor="entity-individual"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  profile.legalEntityType === "individual"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem id="entity-individual" value="individual" className="mt-1" />
                <div>
                  <p className="font-medium">{t("taxBilling.legalEntity.individual")}</p>
                  <p className="text-xs text-muted-foreground">{t("taxBilling.legalEntity.individualHint")}</p>
                </div>
              </Label>
              <Label
                htmlFor="entity-company"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  profile.legalEntityType === "company"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem id="entity-company" value="company" className="mt-1" />
                <div>
                  <p className="font-medium">{t("taxBilling.legalEntity.company")}</p>
                  <p className="text-xs text-muted-foreground">{t("taxBilling.legalEntity.companyHint")}</p>
                </div>
              </Label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">
              {t("taxBilling.companyName.label")}
              {profile.legalEntityType === "company" ? <span className="text-rose-500"> *</span> : null}
            </Label>
            <Input
              id="companyName"
              value={profile.companyName}
              onChange={handleInput("companyName")}
              placeholder={t("taxBilling.companyName.placeholder")}
              disabled={loading || saving}
            />
            {errors.companyName ? (
              <p className="text-xs text-destructive">{errors.companyName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("taxBilling.companyName.helper")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxOffice">{t("taxBilling.taxOffice.label")}</Label>
            <Input
              id="taxOffice"
              value={profile.taxOffice}
              onChange={handleInput("taxOffice")}
              placeholder={t("taxBilling.taxOffice.placeholder")}
              disabled={loading || saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxNumber">{t("taxBilling.taxNumber.label")}</Label>
            <Input
              id="taxNumber"
              value={profile.taxNumber}
              onChange={handleInput("taxNumber")}
              placeholder={t("taxBilling.taxNumber.placeholder")}
              disabled={loading || saving}
            />
            <p className="text-xs text-muted-foreground">
              {t("taxBilling.taxNumber.helper")}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingAddress">{t("taxBilling.billingAddress.label")}</Label>
          <Textarea
            id="billingAddress"
            value={profile.billingAddress}
            onChange={handleInput("billingAddress")}
            placeholder={t("taxBilling.billingAddress.placeholder")}
            rows={3}
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vatRate">
              {t("taxBilling.defaultVatRate.label")}
              <span className="text-muted-foreground"> (%)</span>
            </Label>
            <Input
              id="vatRate"
              type="number"
              min={0}
              max={99.99}
              step="0.01"
              inputMode="decimal"
              value={profile.defaultVatRate}
              onChange={handleInput("defaultVatRate")}
              disabled={loading || saving}
            />
            {errors.defaultVatRate ? (
              <p className="text-xs text-destructive">{errors.defaultVatRate}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("taxBilling.defaultVatRate.helper")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("taxBilling.defaultVatMode.label")}</Label>
            <RadioGroup
              value={profile.defaultVatMode}
              onValueChange={(value) => onChange({ defaultVatMode: value as TaxProfileFormState["defaultVatMode"] })}
              className="grid gap-2"
              disabled={loading || saving}
            >
              <Label
                htmlFor="vat-mode-inclusive"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  profile.defaultVatMode === "inclusive"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem id="vat-mode-inclusive" value="inclusive" className="mt-1" />
                <div>
                  <p className="font-medium">{t("taxBilling.defaultVatMode.inclusive")}</p>
                  <p className="text-xs text-muted-foreground">{t("taxBilling.defaultVatMode.inclusiveHint")}</p>
                </div>
              </Label>
              <Label
                htmlFor="vat-mode-exclusive"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  profile.defaultVatMode === "exclusive"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border hover:border-emerald-300"
                )}
              >
                <RadioGroupItem id="vat-mode-exclusive" value="exclusive" className="mt-1" />
                <div>
                  <p className="font-medium">{t("taxBilling.defaultVatMode.exclusive")}</p>
                  <p className="text-xs text-muted-foreground">{t("taxBilling.defaultVatMode.exclusiveHint")}</p>
                </div>
              </Label>
            </RadioGroup>
          </div>
        </div>

        <div className="flex items-start justify-between rounded-lg border border-border/70 p-4">
          <div>
            <p className="font-medium text-sm">{t("taxBilling.pricesIncludeVat.label")}</p>
            <p className="text-xs text-muted-foreground">{t("taxBilling.pricesIncludeVat.helper")}</p>
          </div>
          <Switch
            checked={profile.pricesIncludeVat}
            onCheckedChange={(checked) => onChange({ pricesIncludeVat: checked })}
            disabled={loading || saving}
            aria-label={t("taxBilling.pricesIncludeVat.label")}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={onReset} disabled={!dirty || saving || loading}>
          {t("taxBilling.reset")}
        </Button>
        <Button type="button" onClick={onSave} disabled={!dirty || saving || loading}>
          {saving ? t("taxBilling.saving") : t("taxBilling.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
