import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Archive, ArrowUpRight, Loader2, RotateCcw, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ORG_GALLERY_STORAGE_LIMIT_BYTES } from "@/lib/storageLimits";
import { formatBytes } from "@/lib/utils";
import { useI18nToast } from "@/lib/toastHelpers";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StorageWidget } from "@/components/ui/storage-widget";
import { DataTable, type Column } from "@/components/ui/data-table";
import { GalleryStatusChip, type GalleryStatus } from "@/components/galleries/GalleryStatusChip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContentDark, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

type AdminGalleryStorageRow = {
  id: string;
  title: string;
  status: string;
  type: string;
  lead_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  gallery_bytes: number | null;
};

type LooseSupabaseRpcError = { message?: string } | Error;

type LooseSupabaseRpcResult<T> = {
  data: T | null;
  error: LooseSupabaseRpcError | null;
};

type LooseSupabaseClient = {
  rpc: <T>(
    functionName: string,
    args?: Record<string, unknown>
  ) => Promise<LooseSupabaseRpcResult<T>>;
};

type AdminGalleryListItem = {
  id: string;
  title: string;
  status: GalleryStatus;
  leadName: string | null;
  galleryBytes: number;
  updatedAt: string | null;
};

const normalizeGalleryStatus = (value: unknown): GalleryStatus | null => {
  if (value === "draft" || value === "published" || value === "approved" || value === "archived") {
    return value;
  }
  return null;
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
  const navigate = useNavigate();

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

  const defaultLimitLabel = useMemo(
    () => formatBytes(ORG_GALLERY_STORAGE_LIMIT_BYTES, locale),
    [locale]
  );

  const galleriesQueryKey = useMemo(
    () => ["admin-users", organizationId, "galleries", "storage"] as const,
    [organizationId]
  );

  const galleriesQuery = useQuery({
    queryKey: galleriesQueryKey,
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<AdminGalleryListItem[]> => {
      const { data, error } = await (supabase as unknown as LooseSupabaseClient).rpc<AdminGalleryStorageRow[]>(
        "admin_list_galleries_with_storage",
        { org_uuid: organizationId }
      );
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as AdminGalleryStorageRow[]) : [];
      return rows
        .map((row) => {
          const status = normalizeGalleryStatus(row.status) ?? "draft";
          const galleryBytes = typeof row.gallery_bytes === "number" && Number.isFinite(row.gallery_bytes) ? row.gallery_bytes : 0;
          return {
            id: row.id,
            title: row.title,
            status,
            leadName: typeof row.lead_name === "string" ? row.lead_name : null,
            galleryBytes,
            updatedAt: row.updated_at,
          };
        })
        .filter((row) => Boolean(row.id));
    },
  });

  const galleries = galleriesQuery.data ?? [];
  const orgUsedBytes = useMemo(
    () => galleries.reduce((sum, row) => sum + (Number.isFinite(row.galleryBytes) ? row.galleryBytes : 0), 0),
    [galleries]
  );

  const [deleteGuardOpen, setDeleteGuardOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pendingDeleteGallery, setPendingDeleteGallery] = useState<AdminGalleryListItem | null>(null);

  const [archiveGuardOpen, setArchiveGuardOpen] = useState(false);
  const [pendingArchiveGallery, setPendingArchiveGallery] = useState<AdminGalleryListItem | null>(null);

  const expectedGalleryNameForDelete = useMemo(() => pendingDeleteGallery?.title.trim() ?? "", [pendingDeleteGallery?.title]);
  const canConfirmGalleryDelete =
    expectedGalleryNameForDelete.length > 0 && deleteConfirmText.trim() === expectedGalleryNameForDelete;

  const closeDeleteGuard = useCallback(() => {
    setDeleteGuardOpen(false);
    setDeleteConfirmText("");
    setPendingDeleteGallery(null);
  }, []);

  const openDeleteGuard = useCallback((gallery: AdminGalleryListItem) => {
    setPendingDeleteGallery(gallery);
    setDeleteConfirmText("");
    setDeleteGuardOpen(true);
  }, []);

  const closeArchiveGuard = useCallback(() => {
    setArchiveGuardOpen(false);
    setPendingArchiveGallery(null);
  }, []);

  const openArchiveGuard = useCallback((gallery: AdminGalleryListItem) => {
    setPendingArchiveGallery(gallery);
    setArchiveGuardOpen(true);
  }, []);

  const refreshGalleries = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: galleriesQueryKey });
  }, [galleriesQueryKey, queryClient]);

  const archiveMutation = useMutation({
    mutationFn: async ({ galleryId, archived }: { galleryId: string; archived: boolean }) => {
      const { error } = await (supabase as unknown as LooseSupabaseClient).rpc(
        "admin_set_gallery_archived",
        {
        gallery_uuid: galleryId,
        archived,
        }
      );
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      closeArchiveGuard();
      await refreshGalleries();
      i18nToast.success(
        variables.archived
          ? t("admin.users.detail.gallery.galleries.toasts.archiveSuccess")
          : t("admin.users.detail.gallery.galleries.toasts.restoreSuccess")
      );
    },
    onError: (error) => {
      console.error("Admin gallery archive action failed", error);
      i18nToast.error(t("admin.users.detail.gallery.galleries.toasts.actionError"));
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ galleryId }: { galleryId: string }) => {
      const { error } = await (supabase as unknown as LooseSupabaseClient).rpc(
        "admin_grant_gallery_access",
        { gallery_uuid: galleryId }
      );
      if (error) throw error;
    },
    onError: (error) => {
      console.error("Admin gallery preview grant failed", error);
      i18nToast.error(t("admin.users.detail.gallery.galleries.toasts.previewError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ galleryId, confirmTitle }: { galleryId: string; confirmTitle: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-gallery-delete", {
        body: { gallery_id: galleryId, confirm_title: confirmTitle },
      });
      if (error) throw error;
      const payload = data as { error?: { message?: string } } | null;
      if (payload?.error?.message) {
        throw new Error(payload.error.message);
      }
    },
    onSuccess: async () => {
      closeDeleteGuard();
      await refreshGalleries();
      i18nToast.success(t("admin.users.detail.gallery.galleries.toasts.deleteSuccess"));
    },
    onError: (error) => {
      console.error("Admin gallery delete failed", error);
      i18nToast.error(t("admin.users.detail.gallery.galleries.toasts.deleteError"));
    },
  });

  const isMutating = archiveMutation.isPending || previewMutation.isPending || deleteMutation.isPending;

  const handlePreview = useCallback(
    async (galleryId: string) => {
      const previewPath = `/galleries/${galleryId}/preview`;
      const previewWindow =
        typeof window !== "undefined"
          ? window.open("about:blank", "_blank", "noopener,noreferrer")
          : null;

      try {
        await previewMutation.mutateAsync({ galleryId });
      } catch {
        previewWindow?.close?.();
        return;
      }
      if (!previewWindow) {
        navigate(previewPath);
        return;
      }
      try {
        previewWindow.location.href = previewPath;
        previewWindow.focus?.();
      } catch {
        navigate(previewPath);
      }
    },
    [navigate, previewMutation]
  );

  const handleToggleArchive = useCallback(
    async (gallery: AdminGalleryListItem) => {
      try {
        await archiveMutation.mutateAsync({ galleryId: gallery.id, archived: gallery.status !== "archived" });
      } catch {
        return;
      }
    },
    [archiveMutation]
  );

  const handleConfirmDelete = useCallback(() => {
    const galleryId = pendingDeleteGallery?.id ?? "";
    if (!galleryId) return;
    deleteMutation.mutate({ galleryId, confirmTitle: deleteConfirmText.trim() });
  }, [deleteConfirmText, deleteMutation, pendingDeleteGallery?.id]);

  const handleConfirmArchive = useCallback(() => {
    const galleryId = pendingArchiveGallery?.id ?? "";
    if (!galleryId) return;
    archiveMutation.mutate({ galleryId, archived: true });
  }, [archiveMutation, pendingArchiveGallery?.id]);

  const galleryColumns = useMemo<Column<AdminGalleryListItem>[]>(
    () => {
      const previewLabel = t("sessionDetail.gallery.actions.preview");
      const archiveLabel = t("sessionDetail.gallery.actions.archive");
      const restoreLabel = t("sessionDetail.gallery.actions.restore");
      const deleteLabel = t("sessionDetail.gallery.actions.delete");

      return [
        {
          key: "title",
          header: t("admin.users.detail.gallery.galleries.columns.title"),
          sortable: true,
          render: (row) => row.title || "—",
        },
        {
          key: "status",
          header: t("admin.users.detail.gallery.galleries.columns.status"),
          sortable: true,
          render: (row) => <GalleryStatusChip status={row.status} />,
        },
        {
          key: "leadName",
          header: t("admin.users.detail.gallery.galleries.columns.lead"),
          sortable: true,
          render: (row) => row.leadName || "—",
        },
        {
          key: "galleryBytes",
          header: t("admin.users.detail.gallery.galleries.columns.size"),
          sortable: true,
          render: (row) => formatBytes(row.galleryBytes, locale),
        },
        {
          key: "actions",
          header: t("admin.users.detail.gallery.galleries.columns.actions"),
          render: (row) => {
            const disabled = isSaving || isMutating;
            const isArchived = row.status === "archived";

            return (
              <div className="flex items-center justify-end gap-1">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
	                    <Button
	                      type="button"
	                      variant="ghost"
	                      size="icon"
	                      aria-label={previewLabel}
	                      disabled={disabled}
	                      onClick={() => void handlePreview(row.id)}
	                    >
	                      <ArrowUpRight className="h-4 w-4" />
	                    </Button>
	                  </TooltipTrigger>
	                  <TooltipContentDark side="top">{previewLabel}</TooltipContentDark>
	                </Tooltip>

                {isArchived ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={restoreLabel}
                        disabled={disabled}
                        onClick={() => void handleToggleArchive(row)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContentDark side="top">{restoreLabel}</TooltipContentDark>
                  </Tooltip>
                ) : (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={archiveLabel}
                        disabled={disabled}
                        onClick={() => openArchiveGuard(row)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContentDark side="top">{archiveLabel}</TooltipContentDark>
                  </Tooltip>
                )}

                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={deleteLabel}
                      disabled={disabled}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openDeleteGuard(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContentDark side="top">{deleteLabel}</TooltipContentDark>
                </Tooltip>
              </div>
            );
          },
        },
      ];
    },
    [handlePreview, handleToggleArchive, isMutating, isSaving, locale, openArchiveGuard, openDeleteGuard, t]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.users.detail.gallery.title")}</CardTitle>
          <CardDescription>{t("admin.users.detail.gallery.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
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

            <StorageWidget
              usedBytes={galleriesQuery.isLoading ? null : orgUsedBytes}
              totalBytes={resolvedLimitBytes}
              isLoading={galleriesQuery.isLoading}
              className="h-full"
            />
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

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.users.detail.gallery.galleries.title")}</CardTitle>
          <CardDescription>{t("admin.users.detail.gallery.galleries.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {galleriesQuery.isError ? (
            <p className="text-sm text-destructive">
              {t("admin.users.detail.gallery.galleries.error")}
            </p>
          ) : (
            <TooltipProvider delayDuration={0}>
              <DataTable
                data={galleries}
                columns={galleryColumns}
                itemsPerPage={8}
                className="max-w-full overflow-x-auto"
                emptyState={
                  <span className="text-sm text-muted-foreground">
                    {t("admin.users.detail.gallery.galleries.empty")}
                  </span>
                }
              />
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteGuardOpen} onOpenChange={(open) => !open && closeDeleteGuard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sessionDetail.gallery.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sessionDetail.gallery.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="admin-gallery-delete-confirm">
              {t("sessionDetail.gallery.delete.confirmLabel")}
            </Label>
            <Input
              id="admin-gallery-delete-confirm"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={expectedGalleryNameForDelete}
              autoFocus
              disabled={deleteMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t("sessionDetail.gallery.delete.confirmHint", { name: expectedGalleryNameForDelete })}
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={closeDeleteGuard} disabled={deleteMutation.isPending}>
              {t("buttons.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={!canConfirmGalleryDelete || deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("sessionDetail.gallery.delete.deleting")}
                </>
              ) : (
                t("sessionDetail.gallery.delete.confirmButton")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveGuardOpen} onOpenChange={(open) => !open && closeArchiveGuard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.users.detail.gallery.galleries.archiveConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.users.detail.gallery.galleries.archiveConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={closeArchiveGuard} disabled={archiveMutation.isPending}>
              {t("buttons.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmArchive}
              disabled={!pendingArchiveGallery?.id || archiveMutation.isPending}
            >
              {archiveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("admin.users.detail.gallery.galleries.archiveConfirm.confirmLoading")}
                </>
              ) : (
                t("admin.users.detail.gallery.galleries.archiveConfirm.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
