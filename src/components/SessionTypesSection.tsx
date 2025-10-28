import { useMemo, useState } from "react";
import SettingsSection from "./SettingsSection";
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
          <div className="space-y-1.5">
            {sessionTypes.map((sessionType) => {
              const isDefault = sessionType.id === defaultSessionTypeId;
              const isInactive = !sessionType.is_active;

              return (
                <div
                  key={sessionType.id}
                  className={cn(
                    "rounded-lg border bg-card p-2.5 shadow-sm transition-colors",
                    isDefault && "border-primary/70 bg-primary/15",
                    isInactive && "opacity-70"
                  )}
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <h3 className="text-base font-semibold leading-none">
                          {sessionType.name}
                        </h3>
                        {isDefault ? (
                          <Badge variant="default" className="bg-primary text-primary-foreground">
                            {tForms("sessionTypes.default_badge")}
                          </Badge>
                        ) : canManageSessionTypes ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-2.5 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => handleSetDefault(sessionType)}
                            disabled={settingDefaultId === sessionType.id}
                          >
                            {tForms("sessionTypes.set_default")}
                          </Button>
                        ) : null}
                        {isInactive && (
                          <Badge variant="outline">
                            {tCommon("status.inactive")}
                          </Badge>
                        )}
                      </div>
                      {sessionType.description && (
                        <p className="text-xs text-muted-foreground leading-snug">
                          {sessionType.description}
                        </p>
                      )}
                    </div>
                    {canManageSessionTypes && (
                      <div className="flex items-center gap-1.5 self-end sm:self-start">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-white"
                          onClick={() => handleOpenEdit(sessionType)}
                          aria-label={tForms("sessionTypes.actions.edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="sr-only">
                        {tForms("sessionTypes.table.duration")}
                      </span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Clock className="h-3 w-3" />
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDuration(sessionType.duration_minutes, tForms)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
