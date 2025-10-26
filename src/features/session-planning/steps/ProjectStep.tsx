import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";

export const ProjectStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateProject } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("steps.project.description")}</p>

      <div className="space-y-2">
        <Label htmlFor="project-name">{t("steps.project.nameLabel")}</Label>
        <Input
          id="project-name"
          placeholder={t("steps.project.namePlaceholder")}
          value={state.project.name ?? ""}
          onChange={(event) =>
            updateProject({
              ...state.project,
              name: event.target.value
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-id">{t("steps.project.idLabel")}</Label>
        <Input
          id="project-id"
          placeholder={t("steps.project.idPlaceholder")}
          value={state.project.id ?? ""}
          onChange={(event) =>
            updateProject({
              ...state.project,
              id: event.target.value
            })
          }
        />
      </div>

      <Button
        variant="outline"
        onClick={() =>
          updateProject({
            id: "proj-demo",
            name: t("steps.project.demoName")
          })
        }
      >
        {t("steps.project.loadDemo")}
      </Button>
    </div>
  );
};
