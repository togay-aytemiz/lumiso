import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { cn } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
}

export const ProjectStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateProject } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const { toast } = useToast();
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  const mode = state.project.mode ?? "existing";
  const leadIdForProjects = state.lead.mode === "existing" ? state.lead.id : undefined;

  useEffect(() => {
    const fetchProjects = async () => {
      if (!leadIdForProjects) {
        setProjectOptions([]);
        return;
      }
      setLoading(true);
      try {
        const organizationId = await getUserOrganizationId();
        if (!organizationId) {
          setProjectOptions([]);
          return;
        }

        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .eq("lead_id", leadIdForProjects)
          .eq("organization_id", organizationId)
          .order("name", { ascending: true });

        if (error) throw error;
        setProjectOptions((data as ProjectOption[]) || []);
      } catch (error: any) {
        console.error("Failed to load projects", error);
        toast({
          title: t("steps.project.fetchErrorTitle"),
          description: error.message,
          variant: "destructive"
        });
        setProjectOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [leadIdForProjects, toast, t]);

  useEffect(() => {
    if (!leadIdForProjects && mode === "existing" && state.lead.mode === "new") {
      handleModeChange("new");
    }
  }, [leadIdForProjects, mode, state.lead.mode]);

  const selectedProjectOption = useMemo(() => {
    if (!state.project.id) return undefined;
    return projectOptions.find((option) => option.id === state.project.id);
  }, [projectOptions, state.project.id]);

  const handleModeChange = (value: "existing" | "new") => {
    updateProject({
      ...state.project,
      mode: value,
      id: value === "existing" ? state.project.id : undefined,
      name: value === "existing" ? selectedProjectOption?.name : "",
      description: ""
    });
  };

  const handleExistingProjectChange = (projectId: string) => {
    const option = projectOptions.find((project) => project.id === projectId);
    updateProject({
      ...state.project,
      mode: "existing",
      id: projectId,
      name: option?.name ?? "",
      description: ""
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.project.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.project.description")}</p>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(value) => handleModeChange(value as "existing" | "new")}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <ModeCard
          value="existing"
          label={t("steps.project.useExisting")}
          description={t("steps.project.useExistingDescription")}
          disabled={!leadIdForProjects}
        />
        <ModeCard
          value="new"
          label={t("steps.project.createNew")}
          description={t("steps.project.createNewDescription")}
        />
      </RadioGroup>

      {mode === "existing" ? (
        <div className="space-y-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.project.selectExisting")}
          </Label>
          <Select
            value={state.project.id ?? ""}
            onValueChange={handleExistingProjectChange}
            disabled={!leadIdForProjects || loading || projectOptions.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  !leadIdForProjects
                    ? t("steps.project.selectLeadFirst")
                    : loading
                      ? t("steps.project.loading")
                      : t("steps.project.selectPlaceholder")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projectOptions.length === 0 && leadIdForProjects && !loading ? (
            <p className="text-xs text-muted-foreground">{t("steps.project.noProjects")}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
            <Label htmlFor="project-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.project.nameLabel")}
            </Label>
            <Input
              id="project-name"
              placeholder={t("steps.project.namePlaceholder")}
              value={state.project.name ?? ""}
              className="mt-2"
              onChange={(event) =>
                updateProject({
                  ...state.project,
                  name: event.target.value
                })
              }
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
            <Label htmlFor="project-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.project.descriptionLabel")}
            </Label>
            <Textarea
              id="project-description"
              rows={3}
              placeholder={t("steps.project.descriptionPlaceholder")}
              value={state.project.description ?? ""}
              className="mt-2"
              onChange={(event) =>
                updateProject({
                  ...state.project,
                  description: event.target.value
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface ModeCardProps {
  value: "existing" | "new";
  label: string;
  description: string;
  disabled?: boolean;
}

const ModeCard = ({ value, label, description, disabled }: ModeCardProps) => (
  <label
    htmlFor={`project-mode-${value}`}
    className={cn(
      "flex cursor-pointer flex-col gap-1 rounded-lg border border-border/70 bg-muted/30 p-4 shadow-sm transition hover:border-primary/60",
      disabled && "pointer-events-none opacity-50"
    )}
  >
    <div className="flex items-center justify-between">
      <span className="font-semibold text-sm text-foreground">{label}</span>
      <RadioGroupItem id={`project-mode-${value}`} value={value} disabled={disabled} />
    </div>
    <p className="text-xs text-muted-foreground">{description}</p>
  </label>
);
