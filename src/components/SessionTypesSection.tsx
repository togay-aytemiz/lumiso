import { useMemo, useState } from "react";
import { SettingsCollectionSection } from "@/components/settings/SettingsSectionVariants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Edit, Trash2, Clock } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useSessionTypes } from "@/hooks/useOrganizationData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AddSessionTypeDialog, EditSessionTypeDialog, SessionType } from "./settings/SessionTypeDialogs";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { IconActionButtonGroup } from "@/components/ui/icon-action-button-group";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

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
    } catch (error) {
      console.error("Failed to set default session type:", error);
      const message =
        error instanceof Error ? error.message : undefined;
      toast({
        title: tCommon("toast.error"),
        description: message || tForms("sessionTypes.errors.default_failed"),
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
    } catch (error) {
      console.error("Failed to clear default session type:", error);
      const message =
        error instanceof Error ? error.message : undefined;
      toast({
        title: tCommon("toast.error"),
        description: message || tForms("sessionTypes.errors.default_failed"),
        variant: "destructive",
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  const SESSION_TYPE_IN_USE = "SESSION_TYPE_IN_USE";

  const handleDeleteSessionType = async () => {
    if (!sessionTypeToDelete) return;

    try {
      setDeletingId(sessionTypeToDelete.id);
      const { error } = await supabase.functions.invoke("session-types-delete", {
        body: { session_type_id: sessionTypeToDelete.id },
      });

      if (error) {
        if (error.message === SESSION_TYPE_IN_USE) {
          toast({
            title: tCommon("toast.error"),
            description: tForms("sessionTypes.errors.delete_in_use"),
            variant: "destructive",
          });
        } else {
          throw new Error(error.message);
        }
        return;
      }

      toast({
        title: tCommon("toast.success"),
        description: tForms("sessionTypes.success.deleted"),
      });

      invalidateSessionTypeQueries();
    } catch (error) {
      console.error("Failed to delete session type:", error);
      const message =
        error instanceof Error ? error.message : undefined;
      toast({
        title: tCommon("toast.error"),
        description: message || tForms("sessionTypes.errors.delete_failed"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setDeleteConfirmOpen(false);
      setSessionTypeToDelete(null);
    }
  };

  const handleMarkSessionTypeInactive = async () => {
    if (!sessionTypeToDelete) return;

    try {
      setDeactivatingId(sessionTypeToDelete.id);
      const { error } = await supabase
        .from("session_types")
        .update({ is_active: false })
        .eq("id", sessionTypeToDelete.id);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: tCommon("toast.success"),
        description: tForms("sessionTypes.success.marked_inactive"),
      });

      invalidateSessionTypeQueries();
      setDeleteConfirmOpen(false);
      setSessionTypeToDelete(null);
    } catch (error) {
      console.error("Failed to deactivate session type:", error);
      const message =
        error instanceof Error ? error.message : undefined;
      toast({
        title: tCommon("toast.error"),
        description: message || tForms("sessionTypes.errors.mark_inactive_failed"),
        variant: "destructive",
      });
    } finally {
      setDeactivatingId(null);
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
  const passiveBadgeLabel = tCommon("status.passive_badge");

  const filteredSessionTypes = useMemo(
    () => (showInactive ? sessionTypes : sessionTypes.filter((type) => type.is_active !== false)),
    [sessionTypes, showInactive]
  );

  if (isLoading) {
    return (
      <SettingsCollectionSection
        sectionId="session-types"
        title={tForms("sessionTypes.title")}
        description={tForms("sessionTypes.description")}
        bodyClassName="p-6"
      >
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-md bg-muted" />
          <div className="h-12 animate-pulse rounded-md bg-muted" />
        </div>
      </SettingsCollectionSection>
    );
  }

  const emptyState = filteredSessionTypes.length === 0;

  const headerActions = (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-4">
      <label
        htmlFor="session-types-show-inactive"
        className="flex items-center gap-2 text-muted-foreground"
      >
        <Switch
          id="session-types-show-inactive"
          checked={showInactive}
          onCheckedChange={setShowInactive}
        />
        <span>{tCommon("labels.show_inactive")}</span>
      </label>
      {canManageSessionTypes && (
        <Button
          type="button"
          size="sm"
          variant="pill"
          className="flex items-center gap-2 whitespace-nowrap"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-4 w-4" />
          {tForms("sessionTypes.add_session_type")}
        </Button>
      )}
    </div>
  );

  return (
    <>
      <SettingsCollectionSection
        sectionId="session-types"
        title={tForms("sessionTypes.title")}
        description={tForms("sessionTypes.description")}
        headerAside={headerActions}
        contentClassName="space-y-4"
        unstyledBody
      >
        {emptyState ? (
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSessionTypes.map((sessionType) => {
                const isDefault = sessionType.id === defaultSessionTypeId;
                const isInactive = !sessionType.is_active;

                return (
                  <div
                    key={sessionType.id}
                    className={cn(
                      "rounded-lg border bg-card p-3 shadow-sm transition-colors",
                      isDefault && "border-primary/70 bg-primary/15",
                      isInactive && "opacity-70"
                    )}
                  >
                    <div className="flex h-full flex-col gap-3">
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold leading-none">
                                {sessionType.name}
                              </h3>
                              {isInactive && (
                                <Badge variant="outline">
                                  {passiveBadgeLabel}
                                </Badge>
                              )}
                            </div>
                            {sessionType.description && (
                              <p className="text-xs leading-snug text-muted-foreground">
                                {sessionType.description}
                              </p>
                            )}
                          </div>
                          {(isDefault || canManageSessionTypes) && (
                            <div className="flex items-start">
                              {isDefault ? (
                                <Badge className="bg-primary text-primary-foreground">
                                  {tForms("sessionTypes.default_badge")}
                                </Badge>
                              ) : (
                                canManageSessionTypes && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                    onClick={() => handleSetDefault(sessionType)}
                                    disabled={settingDefaultId === sessionType.id}
                                  >
                                    {tForms("sessionTypes.set_default")}
                                  </Button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="sr-only">
                            {tForms("sessionTypes.table.duration")}
                          </span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Clock className="h-3 w-3" />
                          </span>
                          <span className="font-medium text-foreground">
                            {formatDuration(
                              sessionType.duration_minutes,
                              tForms
                            )}
                          </span>
                        </div>

                        {canManageSessionTypes && (
                          <IconActionButtonGroup>
                            <IconActionButton
                              onClick={() => handleOpenEdit(sessionType)}
                              aria-label={tForms("sessionTypes.actions.edit")}
                            >
                              <Edit className="h-4 w-4" />
                            </IconActionButton>
                            <IconActionButton
                              onClick={() => {
                                setSessionTypeToDelete(sessionType);
                                setDeleteConfirmOpen(true);
                              }}
                              aria-label={tForms("sessionTypes.actions.delete")}
                              variant="danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconActionButton>
                          </IconActionButtonGroup>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        )}
      </SettingsCollectionSection>

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
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="text-foreground">
                  {tForms("sessionTypes.delete_description", {
                    name: sessionTypeToDelete?.name ?? "",
                  })}
                </p>
                <p>{tForms("sessionTypes.delete_consider_inactive")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                deletingId === sessionTypeToDelete?.id ||
                deactivatingId === sessionTypeToDelete?.id
              }
            >
              {tCommon("buttons.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkSessionTypeInactive}
              className="border border-input bg-background text-foreground hover:bg-muted"
              disabled={
                deactivatingId === sessionTypeToDelete?.id ||
                deletingId === sessionTypeToDelete?.id
              }
            >
              {tForms("sessionTypes.mark_inactive")}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeleteSessionType}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                deletingId === sessionTypeToDelete?.id ||
                deactivatingId === sessionTypeToDelete?.id
              }
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
