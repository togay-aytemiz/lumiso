import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import {
  AddProjectTypeDialog,
  EditProjectTypeDialog,
} from "./settings/ProjectTypeDialogs";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useProjectTypes } from "@/hooks/useOrganizationData";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import { SettingsTwoColumnSection } from "@/components/settings/SettingsSections";
import { getDisplayProjectTypeName, getProjectTypeMatchKey } from "@/lib/projectTypes";

interface ProjectType {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  template_slug: string | null;
}

const ProjectTypesSection = () => {
  const [editingType, setEditingType] = useState<ProjectType | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const toast = useI18nToast();
  const { activeOrganizationId, loading: orgLoading } = useOrganization();
  const { data: types = [], isLoading, refetch } = useProjectTypes();
  const { settings: orgSettings } = useOrganizationSettings();
  const { t, i18n } = useTranslation("forms");
  const preferredMatchKeys = useMemo(() => {
    const keys = (orgSettings?.preferred_project_types ?? []).map(getProjectTypeMatchKey);
    return new Set(keys.filter((key) => key.length > 0));
  }, [orgSettings?.preferred_project_types]);

  const displayTypes = useMemo(() => {
    if (!types.length) return [];
    if (preferredMatchKeys.size === 0) return types;

    return types.filter((type) => {
      if (!type.template_slug) {
        return true;
      }

      const matchKey = getProjectTypeMatchKey(type.template_slug);
      if (!matchKey) {
        return true;
      }

      return preferredMatchKeys.has(matchKey);
    });
  }, [types, preferredMatchKeys]);

  const createDefaultTypes = useCallback(async () => {
    try {
      if (!activeOrganizationId) {
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      await supabase.rpc("ensure_default_project_types_for_org", {
        user_uuid: user.id,
        org_id: activeOrganizationId,
        locale: orgSettings?.locale ?? i18n.language
      });

      await refetch();
    } catch (error) {
      console.error("Error creating default types:", error);
      toast.error("Failed to create default types");
    }
  }, [activeOrganizationId, refetch, toast, orgSettings?.locale, i18n.language]);

  useEffect(() => {
    if (
      !isLoading &&
      !orgLoading &&
      activeOrganizationId &&
      types.length === 0
    ) {
      void createDefaultTypes();
    }
  }, [
    activeOrganizationId,
    createDefaultTypes,
    isLoading,
    orgLoading,
    types.length,
  ]);

  const handleEdit = (type: ProjectType) => {
    setEditingType(type);
    setIsEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingType(null);
    setIsAddDialogOpen(true);
  };

  const handleRefetch = async () => {
    await refetch();
  };

  const handleEditDialogChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setEditingType(null);
    }
  };

  const sectionAction = {
    label: t("project_types.add_type"),
    onClick: handleAdd,
    icon: Plus,
    variant: "pill" as const,
    size: "sm" as const,
  };

  if (orgLoading || isLoading) {
    return (
      <SettingsTwoColumnSection
        sectionId="project-types"
        title={t("project_types.title")}
        description={t("project_types.description")}
        action={sectionAction}
        contentClassName="space-y-6"
      >
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <FormLoadingSkeleton rows={3} />
        </div>
      </SettingsTwoColumnSection>
    );
  }

  return (
    <>
      <SettingsTwoColumnSection
        sectionId="project-types"
        title={t("project_types.title")}
        description={t("project_types.description")}
        action={sectionAction}
        contentClassName="space-y-6"
      >
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("project_types.description")}
            </p>
          </div>
          {displayTypes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
              <p>
                {t("project_types.empty_state", {
                  defaultValue: "Add your first type to keep projects organized.",
                })}
              </p>
              <Button onClick={handleAdd} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("project_types.add_type")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {displayTypes.map((type) => {
                const localizedName = getDisplayProjectTypeName(type, orgSettings?.locale ?? i18n.language);
                return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleEdit(type)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition-all",
                    type.is_default
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-muted bg-muted/60 text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {type.is_default && (
                    <Check className="h-3.5 w-3.5 text-current" />
                  )}
                  <span className="truncate">{localizedName}</span>
                </button>
              );
            })}
            </div>
          )}
        </div>
      </SettingsTwoColumnSection>

      <AddProjectTypeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onTypeAdded={handleRefetch}
      />

      <EditProjectTypeDialog
        type={editingType}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogChange}
        onTypeUpdated={handleRefetch}
      />
    </>
  );
};

export default ProjectTypesSection;
