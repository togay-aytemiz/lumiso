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

const BYTES_PER_GB = 1024 ** 3;

const bytesToGb = (bytes: number) => bytes / BYTES_PER_GB;

const gbToBytes = (gb: number) => Math.round(gb * BYTES_PER_GB);

const DEFAULT_ORG_GALLERY_LIMIT_GB = bytesToGb(ORG_GALLERY_STORAGE_LIMIT_BYTES);

const parseGbInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const formatGbForInput = (bytes: number) => {
  const gb = bytesToGb(bytes);
  if (!Number.isFinite(gb) || gb <= 0) return "";
  const rounded = Number(gb.toFixed(2));
  return String(rounded);
};

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

  const [limitGbInput, setLimitGbInput] = useState(() => formatGbForInput(resolvedLimitBytes));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLimitGbInput(formatGbForInput(resolvedLimitBytes));
  }, [organizationId, resolvedLimitBytes]);

  const parsedGb = useMemo(() => parseGbInput(limitGbInput), [limitGbInput]);
  const parsedBytes = useMemo(
    () => (parsedGb !== null && parsedGb > 0 ? gbToBytes(parsedGb) : null),
    [parsedGb]
  );
  const normalizedCurrentInput = useMemo(
    () => formatGbForInput(resolvedLimitBytes),
    [resolvedLimitBytes]
  );
  const normalizedNextInput = useMemo(() => {
    if (parsedBytes !== null && parsedBytes > 0) {
      return formatGbForInput(parsedBytes);
    }
    return limitGbInput.trim();
  }, [limitGbInput, parsedBytes]);
  const isDirty = normalizedNextInput !== normalizedCurrentInput;

  const handleReset = useCallback(() => {
    setLimitGbInput(formatGbForInput(ORG_GALLERY_STORAGE_LIMIT_BYTES));
  }, []);

  const handleSave = useCallback(async () => {
    const gb = parseGbInput(limitGbInput);
    if (gb === null || gb <= 0) {
      i18nToast.error(t("admin.users.detail.gallery.toasts.invalidLimit"));
      return;
    }

    const nextBytes = gbToBytes(gb);
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
  }, [i18nToast, limitGbInput, onSaved, organizationId, queryClient, t]);

  const currentLimitLabel = useMemo(
    () => formatBytes(resolvedLimitBytes, locale),
    [locale, resolvedLimitBytes]
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
            <Label htmlFor="admin-gallery-limit-gb">
              {t("admin.users.detail.gallery.limitLabel")}
            </Label>
            <Input
              id="admin-gallery-limit-gb"
              type="number"
              min={0.1}
              step={0.1}
              value={limitGbInput}
              onChange={(event) => setLimitGbInput(event.target.value)}
              inputMode="decimal"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.users.detail.gallery.limitHint", { default: DEFAULT_ORG_GALLERY_LIMIT_GB })}
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
