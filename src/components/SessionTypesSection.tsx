import { useMemo, useState } from "react";
import SettingsSection from "./SettingsSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";
import { Plus, Edit, Trash2, Star } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useSessionTypes } from "@/hooks/useOrganizationData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AddSessionTypeDialog, EditSessionTypeDialog, SessionType } from "./settings/SessionTypeDialogs";
import { cn } from "@/lib/utils";

const formatDuration = (
  minutes: number,
  translate: (key: string, options?: Record<string, unknown>) => string
) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    const unitKey =
      hours === 1 ? "sessionTypes.units.hour" : "sessionTypes.units.hours";
    parts.push(`${hours} ${translate(unitKey)}`);
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    const unitKey =
      remainingMinutes === 1
        ? "sessionTypes.units.minute"
        : "sessionTypes.units.minutes";
    parts.push(`${remainingMinutes} ${translate(unitKey)}`);
  }

  return parts.join(" ");
};

const SessionTypesSection = () => {
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganization();
  const { settings, updateSettings } = useOrganizationSettings();
  const { data: sessionTypes = [], isLoading } = useSessionTypes();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSessionType, setEditingSessionType] = useState<SessionType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sessionTypeToDelete, setSessionTypeToDelete] = useState<SessionType | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const defaultSessionTypeId = settings?.default_session_type_id ?? null;

  const nextSortOrder = useMemo(() => {
    if (sessionTypes.length === 0) return 1;
    const maxSort = Math.max(...sessionTypes.map((type) => type.sort_order ?? 0));
    return maxSort + 1;
  }, [sessionTypes]);

  const invalidateSessionTypeQueries = () => {
    if (!activeOrganizationId) return;
    queryClient.invalidateQueries({ queryKey: ["session_types", activeOrganizationId] });
    queryClient.invalidateQueries({ queryKey: ["organization_settings", activeOrganizationId] });
  };

  const handleSetDefault = async (sessionType: SessionType) => {
    if (defaultSessionTypeId === sessionType.id) return;

    try {
      setSettingDefaultId(sessionType.id);
      const result = await updateSettings({ default_session_type_id: sessionType.id });
      if (result.success) {
        toast({
          title: tCommon("toast.success"),
          description: tForms("sessionTypes.success.default_updated"),
        });
        invalidateSessionTypeQueries();
      }
    } catch (error: any) {
      console.error("Failed to set default session type:", error);
      toast({
        title: tCommon("toast.error"),
        description: error.message || tForms("sessionTypes.errors.default_failed"),
        variant: "destructive",
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleClearDefault = async (sessionType: SessionType) => {
    try {
      setSettingDefaultId(sessionType.id);
      const result = await updateSettings({ default_session_type_id: null });
      if (result.success) {
        toast({
          title: tCommon("toast.success"),
          description: tForms("sessionTypes.success.default_cleared"),
        });
        invalidateSessionTypeQueries();
      }
    } catch (error: any) {
      console.error("Failed to clear default session type:", error);
      toast({
        title: tCommon("toast.error"),
        description: error.message || tForms("sessionTypes.errors.default_failed"),
        variant: "destructive",
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  const toggleSessionTypeActive = async (sessionType: SessionType, nextActive: boolean) => {
    if (sessionType.id === defaultSessionTypeId && !nextActive) {
      toast({
        title: tForms("sessionTypes.errors.cannot_deactivate_default_title"),
        description: tForms("sessionTypes.errors.cannot_deactivate_default_desc"),
        variant: "destructive",
      });
      return;
    }

    try {
      setTogglingId(sessionType.id);
      const { error } = await supabase
        .from("session_types")
        .update({ is_active: nextActive })
        .eq("id", sessionType.id);

      if (error) throw error;

      toast({
        title: tCommon("toast.success"),
        description: nextActive
          ? tForms("sessionTypes.success.activated")
          : tForms("sessionTypes.success.deactivated"),
      });

      invalidateSessionTypeQueries();
    } catch (error: any) {
      console.error("Failed to toggle session type:", error);
      toast({
        title: tCommon("toast.error"),
        description: error.message || tForms("sessionTypes.errors.toggle_failed"),
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteSessionType = async () => {
    if (!sessionTypeToDelete) return;

    try {
      setDeletingId(sessionTypeToDelete.id);
      const { error } = await supabase
        .from("session_types")
        .delete()
        .eq("id", sessionTypeToDelete.id);

      if (error) throw error;

      toast({
        title: tCommon("toast.success"),
        description: tForms("sessionTypes.success.deleted"),
      });

      invalidateSessionTypeQueries();
    } catch (error: any) {
      console.error("Failed to delete session type:", error);
      toast({
        title: tCommon("toast.error"),
        description: error.message || tForms("sessionTypes.errors.delete_failed"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setDeleteConfirmOpen(false);
      setSessionTypeToDelete(null);
    }
  };

  const handleOpenEdit = (sessionType: SessionType) => {
    setEditingSessionType(sessionType);
    setShowEditDialog(true);
  };

  const handleAddComplete = (payload?: { sessionType: SessionType; setAsDefault: boolean }) => {
    invalidateSessionTypeQueries();
    if (payload?.setAsDefault) {
      handleSetDefault(payload.sessionType);
    }
  };

  const handleEditComplete = (
    payload?: { sessionType: SessionType; setAsDefault: boolean; wasDefault: boolean }
  ) => {
    invalidateSessionTypeQueries();
    if (!payload) return;

    const { sessionType, setAsDefault, wasDefault } = payload;

    if (setAsDefault && !wasDefault) {
      handleSetDefault(sessionType);
    } else if (!setAsDefault && wasDefault && defaultSessionTypeId === sessionType.id) {
      handleClearDefault(sessionType);
    }
  };

  const canManageSessionTypes = true; // Single-photographer mode permits full access

  const emptyState = !isLoading && sessionTypes.length === 0;

  return (
    <>
      <SettingsSection
        title={tForms("sessionTypes.title")}
        description={tForms("sessionTypes.description")}
        action={
          canManageSessionTypes
            ? {
                label: tForms("sessionTypes.add_session_type"),
                onClick: () => setShowAddDialog(true),
                icon: <Plus className="h-4 w-4" />,
              }
            : undefined
        }
      >
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-md bg-muted" />
            <div className="h-12 animate-pulse rounded-md bg-muted" />
          </div>
        ) : emptyState ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <p className="text-muted-foreground">
              {tForms("sessionTypes.no_session_types")}
            </p>
            {canManageSessionTypes && (
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {tForms("sessionTypes.add_first_session_type")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/60 text-left">
                      <th className="px-4 py-3 font-medium">{tForms("sessionTypes.table.name")}</th>
                      <th className="px-4 py-3 font-medium">{tForms("sessionTypes.table.duration")}</th>
                      <th className="px-4 py-3 font-medium">{tForms("sessionTypes.table.category")}</th>
                      <th className="px-4 py-3 font-medium">{tForms("sessionTypes.table.status")}</th>
                      <th className="px-4 py-3 font-medium">{tForms("sessionTypes.table.default")}</th>
                      <th className="px-4 py-3 font-medium text-right">
                        {tForms("sessionTypes.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTypes.map((sessionType) => {
                      const isDefault = sessionType.id === defaultSessionTypeId;
                      return (
                        <tr
                          key={sessionType.id}
                          className={cn(
                            "border-b transition-colors hover:bg-muted/40",
                            !sessionType.is_active && "opacity-70"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{sessionType.name}</span>
                                {isDefault && (
                                  <Badge variant="secondary">
                                    {tForms("sessionTypes.default_badge")}
                                  </Badge>
                                )}
                              </div>
                              {sessionType.description && (
                                <p className="text-xs text-muted-foreground">
                                  {sessionType.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {formatDuration(sessionType.duration_minutes, tForms)}
                          </td>
                          <td className="px-4 py-3">
                            {sessionType.category ? (
                              <Badge variant="outline">{sessionType.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                {tForms("sessionTypes.table.category_none")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {canManageSessionTypes ? (
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={sessionType.is_active}
                                  onCheckedChange={(value) =>
                                    toggleSessionTypeActive(sessionType, value)
                                  }
                                  disabled={togglingId === sessionType.id}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {sessionType.is_active
                                    ? tCommon("status.active")
                                    : tCommon("status.inactive")}
                                </span>
                              </div>
                            ) : (
                              <Badge variant={sessionType.is_active ? "default" : "secondary"}>
                                {sessionType.is_active
                                  ? tCommon("status.active")
                                  : tCommon("status.inactive")}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isDefault ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Star className="h-4 w-4 text-amber-500" />
                                {tForms("sessionTypes.table.default_active")}
                              </div>
                            ) : canManageSessionTypes ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetDefault(sessionType)}
                                disabled={settingDefaultId === sessionType.id}
                              >
                                <Star className="mr-2 h-4 w-4" />
                                {tForms("sessionTypes.set_default")}
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {tForms("sessionTypes.table.default_inactive")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canManageSessionTypes && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEdit(sessionType)}
                                  aria-label={tForms("sessionTypes.actions.edit")}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSessionTypeToDelete(sessionType);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  aria-label={tForms("sessionTypes.actions.delete")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile layout */}
            <div className="space-y-3 md:hidden">
              {sessionTypes.map((sessionType) => {
                const isDefault = sessionType.id === defaultSessionTypeId;
                return (
                  <div
                    key={sessionType.id}
                    className={cn(
                      "rounded-lg border p-4 shadow-sm transition-colors",
                      !sessionType.is_active && "opacity-70"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{sessionType.name}</h3>
                        {isDefault && (
                          <Badge variant="secondary">
                            {tForms("sessionTypes.default_badge")}
                          </Badge>
                        )}
                      </div>
                      {canManageSessionTypes && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(sessionType)}
                            aria-label={tForms("sessionTypes.actions.edit")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSessionTypeToDelete(sessionType);
                              setDeleteConfirmOpen(true);
                            }}
                            aria-label={tForms("sessionTypes.actions.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {sessionType.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {sessionType.description}
                      </p>
                    )}

                    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">
                          {tForms("sessionTypes.table.duration")}
                        </dt>
                        <dd>{formatDuration(sessionType.duration_minutes, tForms)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {tForms("sessionTypes.table.category")}
                        </dt>
                        <dd>
                          {sessionType.category
                            ? sessionType.category
                            : tForms("sessionTypes.table.category_none")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {tForms("sessionTypes.table.status")}
                        </dt>
                        <dd>
                          <div className="flex items-center gap-2">
                            {canManageSessionTypes ? (
                              <Switch
                                checked={sessionType.is_active}
                                onCheckedChange={(value) =>
                                  toggleSessionTypeActive(sessionType, value)
                                }
                                disabled={togglingId === sessionType.id}
                              />
                            ) : (
                              <Badge variant={sessionType.is_active ? "default" : "secondary"}>
                                {sessionType.is_active
                                  ? tCommon("status.active")
                                  : tCommon("status.inactive")}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {sessionType.is_active
                                ? tCommon("status.active")
                                : tCommon("status.inactive")}
                            </span>
                          </div>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {tForms("sessionTypes.table.default")}
                        </dt>
                        <dd>
                          {isDefault ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Star className="h-4 w-4 text-amber-500" />
                              {tForms("sessionTypes.table.default_active")}
                            </div>
                          ) : canManageSessionTypes ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(sessionType)}
                              disabled={settingDefaultId === sessionType.id}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              {tForms("sessionTypes.set_default")}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {tForms("sessionTypes.table.default_inactive")}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SettingsSection>

      <AddSessionTypeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSessionTypeAdded={handleAddComplete}
        nextSortOrder={nextSortOrder}
      />

      <EditSessionTypeDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        sessionType={editingSessionType}
        defaultSessionTypeId={defaultSessionTypeId}
        onSessionTypeUpdated={handleEditComplete}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tForms("sessionTypes.delete_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tForms("sessionTypes.delete_description", {
                name: sessionTypeToDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {tCommon("buttons.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSessionType}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingId === sessionTypeToDelete?.id}
            >
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SessionTypesSection;
