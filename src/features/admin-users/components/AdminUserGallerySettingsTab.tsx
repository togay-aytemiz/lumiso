import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ORG_GALLERY_STORAGE_LIMIT_BYTES } from "@/lib/storageLimits";
import { formatBytes } from "@/lib/utils";
import { useI18nToast } from "@/lib/toastHelpers";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";

type StorageUnit = "gb" | "mb";

const BYTES_PER_MB = 1024 ** 2;
const BYTES_PER_GB = 1024 ** 3;

const bytesToMb = (bytes: number) => bytes / BYTES_PER_MB;
const bytesToGb = (bytes: number) => bytes / BYTES_PER_GB;

const mbToBytes = (mb: number) => Math.round(mb * BYTES_PER_MB);
const gbToBytes = (gb: number) => Math.round(gb * BYTES_PER_GB);

const parseNumberInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const formatValueForInput = (bytes: number, unit: StorageUnit) => {
  const value = unit === "gb" ? bytesToGb(bytes) : bytesToMb(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  const rounded = Number(value.toFixed(2));
  return String(rounded);
};

const resolveUnitForBytes = (bytes: number): StorageUnit => (bytes < BYTES_PER_GB ? "mb" : "gb");

const valueToBytes = (value: number, unit: StorageUnit) => (unit === "gb" ? gbToBytes(value) : mbToBytes(value));

interface AdminUserGallerySettingsTabProps {
  organizationId: string;
  limitBytes?: number | null;
  onSaved?: () => void;
}

export function AdminUserGallerySettingsTab({ organizationId, limitBytes, onSaved }: AdminUserGallerySettingsTabProps) {
  const { t, i18n } = useTranslation("pages");
  const locale = i18n.resolvedLanguage ?? i18n.language ?? undefined;
  const queryClient = useQueryClient();
  const i18nToast = useI18nToast();

  const resolvedLimitBytes = useMemo(() => {
    if (typeof limitBytes === "number" && Number.isFinite(limitBytes) && limitBytes > 0) {
      return limitBytes;
    }
    return ORG_GALLERY_STORAGE_LIMIT_BYTES;
  }, [limitBytes]);

  const [unit, setUnit] = useState<StorageUnit>(() => resolveUnitForBytes(resolvedLimitBytes));
  const [limitValueInput, setLimitValueInput] = useState(() =>
    formatValueForInput(resolvedLimitBytes, resolveUnitForBytes(resolvedLimitBytes))
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const nextUnit = resolveUnitForBytes(resolvedLimitBytes);
    setUnit(nextUnit);
    setLimitValueInput(formatValueForInput(resolvedLimitBytes, nextUnit));
  }, [organizationId, resolvedLimitBytes]);

  const parsedValue = useMemo(() => parseNumberInput(limitValueInput), [limitValueInput]);
  const parsedBytes = useMemo(() => {
    if (parsedValue === null || parsedValue <= 0) return null;
    return valueToBytes(parsedValue, unit);
  }, [parsedValue, unit]);

  const isDirty = useMemo(() => {
    if (parsedBytes !== null) {
      return parsedBytes !== resolvedLimitBytes;
    }
    return limitValueInput.trim() !== formatValueForInput(resolvedLimitBytes, unit);
  }, [limitValueInput, parsedBytes, resolvedLimitBytes, unit]);

  const handleUnitChange = useCallback(
    (next: string) => {
      const nextUnit = next === "mb" ? "mb" : "gb";
      if (nextUnit === unit) return;
      const value = parseNumberInput(limitValueInput);
      const bytes = value !== null && value > 0 ? valueToBytes(value, unit) : null;
      setUnit(nextUnit);
      if (bytes !== null) {
        setLimitValueInput(formatValueForInput(bytes, nextUnit));
      }
    },
    [limitValueInput, unit]
  );

  const handleReset = useCallback(() => {
    const nextUnit = resolveUnitForBytes(ORG_GALLERY_STORAGE_LIMIT_BYTES);
    setUnit(nextUnit);
    setLimitValueInput(formatValueForInput(ORG_GALLERY_STORAGE_LIMIT_BYTES, nextUnit));
  }, []);

  const handleSave = useCallback(async () => {
    const value = parseNumberInput(limitValueInput);
    if (value === null || value <= 0) {
      i18nToast.error(t("admin.users.detail.gallery.toasts.invalidLimit"));
      return;
    }

    const nextBytes = valueToBytes(value, unit);
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ gallery_storage_limit_bytes: nextBytes })
        .eq("id", organizationId);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["admin-users"], exact: false });
      i18nToast.success(t("admin.users.detail.gallery.toasts.saveSuccess"));
      onSaved?.();
    } catch (error) {
      console.error("Failed to update gallery storage limit", error);
      i18nToast.error(t("admin.users.detail.gallery.toasts.saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [i18nToast, limitValueInput, onSaved, organizationId, queryClient, t, unit]);

  const currentLimitLabel = useMemo(
    () => formatBytes(resolvedLimitBytes, locale),
    [locale, resolvedLimitBytes]
  );

  const defaultLimitLabel = useMemo(
    () => formatBytes(ORG_GALLERY_STORAGE_LIMIT_BYTES, locale),
    [locale]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.users.detail.gallery.title")}</CardTitle>
        <CardDescription>{t("admin.users.detail.gallery.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-gallery-limit-value">
              {t("admin.users.detail.gallery.limitLabel")}
            </Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                id="admin-gallery-limit-value"
                type="number"
                min={unit === "gb" ? 0.1 : 1}
                step={unit === "gb" ? 0.1 : 1}
                value={limitValueInput}
                onChange={(event) => setLimitValueInput(event.target.value)}
                inputMode="decimal"
                disabled={isSaving}
                className="sm:max-w-[180px]"
              />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("admin.users.detail.gallery.unitLabel")}
                </p>
                <SegmentedControl
                  value={unit}
                  onValueChange={handleUnitChange}
                  options={[
                    { value: "mb", label: t("admin.users.detail.gallery.unit.mb") },
                    { value: "gb", label: t("admin.users.detail.gallery.unit.gb") },
                  ]}
                  size="sm"
                  className="w-fit"
                  aria-label={t("admin.users.detail.gallery.unitLabel")}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.users.detail.gallery.limitHint", { default: defaultLimitLabel })}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("admin.users.detail.gallery.currentLimit")}
            </p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{currentLimitLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            {t("admin.users.detail.gallery.actions.reset")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? t("admin.users.detail.gallery.actions.saving") : t("admin.users.detail.gallery.actions.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
