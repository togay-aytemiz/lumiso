import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { ChevronDown, FolderPlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ProjectDialogWithLeadSelector } from "@/components/ProjectDialogWithLeadSelector";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);

  const leadId = state.lead.id;

  useEffect(() => {
    if (!leadId && state.project.id) {
      updateProject({
        id: undefined,
        name: "",
        description: "",
        mode: "existing"
      });
    }
  }, [leadId, state.project.id, updateProject]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!leadId) {
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
          .eq("lead_id", leadId)
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
  }, [leadId, toast, t]);

  const selectedProjectOption = useMemo(() => {
    if (!state.project.id) return undefined;
    return projectOptions.find((project) => project.id === state.project.id);
  }, [projectOptions, state.project.id]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return projectOptions.filter((project) => project.name.toLowerCase().includes(term));
  }, [projectOptions, searchTerm]);

  const handleSelectProject = (project: ProjectOption) => {
    updateProject({
      id: project.id,
      name: project.name,
      description: state.project.description,
      mode: "existing"
    });
    setDropdownOpen(false);
    setSearchTerm("");
  };

  const handleProjectCreated = (project: { id: string; name: string }) => {
    setProjectSheetOpen(false);
    const option = { id: project.id, name: project.name };
    setProjectOptions((prev) => {
      const without = prev.filter((item) => item.id !== project.id);
      return [...without, option].sort((a, b) => a.name.localeCompare(b.name));
    });
    handleSelectProject(option);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.project.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.project.description")}</p>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("steps.project.selectExisting")}
        </Label>
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-left h-auto min-h-[42px]"
              disabled={!leadId || loading || projectOptions.length === 0}
            >
              {selectedProjectOption ? (
                <span className="text-sm font-medium text-foreground">{selectedProjectOption.name}</span>
              ) : !leadId ? (
                t("steps.project.selectLeadFirst")
              ) : loading ? (
                t("steps.project.loading")
              ) : (
                t("steps.project.selectPlaceholder")
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[360px]" align="start">
            <Command>
              <CommandInput
                placeholder={t("steps.project.searchPlaceholder")}
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>{t("steps.project.noProjects")}</CommandEmpty>
                <CommandGroup>
                  {filteredProjects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={project.id}
                      onSelect={() => handleSelectProject(project)}
                      className="flex items-center gap-3"
                    >
                      <span className="text-sm font-medium text-foreground">{project.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setProjectSheetOpen(true)}
          disabled={!leadId}
        >
          <FolderPlus className="h-4 w-4" />
          {t("steps.project.createButton")}
        </Button>

        {leadId && projectOptions.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">{t("steps.project.emptyState")}</p>
        )}
      </div>

      {selectedProjectOption && (
        <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{selectedProjectOption.name}</p>
        </div>
      )}

      <ProjectDialogWithLeadSelector
        open={projectSheetOpen}
        onOpenChange={setProjectSheetOpen}
        onProjectCreated={handleProjectCreated}
        defaultLeadId={leadId}
      />
    </div>
  );
};
