import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectTypeSelector } from "@/components/ProjectTypeSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useProjectStatuses, useProjectTypes } from "@/hooks/useOrganizationData";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";

export const DetailsStep = () => {
  const { t } = useTranslation("projectCreation");
  const { state } = useProjectCreationContext();
  const { updateDetails } = useProjectCreationActions();
  const { data: projectStatuses = [], isLoading: statusesLoading } = useProjectStatuses();
  const { data: projectTypes = [] } = useProjectTypes();

  const statusOptions = useMemo(
    () => projectStatuses.map((status) => ({ id: status.id, label: status.name, isDefault: status.is_default })),
    [projectStatuses]
  );

  useEffect(() => {
    if (state.details.statusId) return;
    const fallbackId =
      state.meta.defaultStatusId ??
      statusOptions.find((option) => option.isDefault)?.id ??
      statusOptions[0]?.id;
    if (fallbackId) {
      const fallbackLabel =
        statusOptions.find((option) => option.id === fallbackId)?.label;
      updateDetails(
        {
          statusId: fallbackId,
          statusLabel: fallbackLabel,
        },
        { markDirty: false }
      );
    }
  }, [state.details.statusId, state.meta.defaultStatusId, statusOptions, updateDetails]);

  const handleStatusChange = (value: string) => {
    const selected = statusOptions.find((option) => option.id === value);
    updateDetails({
      statusId: value,
      statusLabel: selected?.label,
    });
  };

  useEffect(() => {
    if (!state.details.statusId) return;
    const selected = statusOptions.find((option) => option.id === state.details.statusId);
    if (selected && state.details.statusLabel !== selected.label) {
      updateDetails({ statusLabel: selected.label }, { markDirty: false });
    }
  }, [
    state.details.statusId,
    state.details.statusLabel,
    statusOptions,
    updateDetails,
  ]);

  useEffect(() => {
    if (!state.details.projectTypeId) return;
    const selected = projectTypes.find((type) => type.id === state.details.projectTypeId);
    if (selected && state.details.projectTypeLabel !== selected.name) {
      updateDetails({ projectTypeLabel: selected.name }, { markDirty: false });
    }
  }, [
    state.details.projectTypeId,
    state.details.projectTypeLabel,
    projectTypes,
    updateDetails,
  ]);

  const handleProjectTypeChange = (value: string, options?: { isAutomatic?: boolean }) => {
    const selected = projectTypes.find((type) => type.id === value);
    updateDetails(
      {
        projectTypeId: value,
        projectTypeLabel: selected?.name,
      },
      { markDirty: options?.isAutomatic ? false : undefined }
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.details.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("steps.details.description")}</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="project-name">{t("steps.details.nameLabel")}</Label>
          <Input
            id="project-name"
            value={state.details.name ?? ""}
            onChange={(event) => updateDetails({ name: event.target.value })}
            placeholder={t("steps.details.namePlaceholder")}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("steps.details.typeLabel")}</Label>
            <ProjectTypeSelector
              value={state.details.projectTypeId}
              onValueChange={handleProjectTypeChange}
              placeholder={t("steps.details.typePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("steps.details.statusLabel")}</Label>
            {statusesLoading ? (
              <div className="flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                {t("steps.details.statusLoading")}
              </div>
            ) : statusOptions.length > 0 ? (
              <Select value={state.details.statusId ?? undefined} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("steps.details.statusPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                {t("steps.details.statusEmpty")}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">{t("steps.details.descriptionLabel")}</Label>
          <Textarea
            id="project-description"
            value={state.details.description ?? ""}
            onChange={(event) => updateDetails({ description: event.target.value })}
            placeholder={t("steps.details.descriptionPlaceholder")}
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};
