import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Check, ChevronDown, FolderPlus, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";

interface ProjectOption {
  id: string;
  name: string;
}

export const ProjectStep = ({ onContinue }: { onContinue?: () => void } = {}) => {
  const { state } = useSessionPlanningContext();
  const { updateProject } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const { toast } = useToast();
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasAnyProject, setHasAnyProject] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const latestRequestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const leadId = state.lead.id;
  const noProjectsAvailable =
    Boolean(leadId) && hasLoadedInitial && !hasAnyProject;
  const dropdownDisabled =
    !leadId || noProjectsAvailable || (loading && projectOptions.length === 0);

  useEffect(() => {
    if (!leadId && state.project.id) {
      updateProject({
        id: undefined,
        name: "",
        description: "",
        mode: "existing",
      });
    }
  }, [leadId, state.project.id, updateProject]);

  const loadProjects = useCallback(
    async (targetLeadId: string, term: string) => {
      const requestId = ++latestRequestRef.current;
      const isBaseQuery = term.trim().length === 0;
      if (!targetLeadId) {
        setProjectOptions([]);
        setHasAnyProject(false);
        setHasLoadedInitial(false);
        return;
      }
      setLoading(true);
      try {
        const organizationId = await getUserOrganizationId();
        if (!organizationId) {
          if (latestRequestRef.current === requestId) {
            setProjectOptions([]);
            if (isBaseQuery) {
              setHasAnyProject(false);
              setHasLoadedInitial(true);
            }
          }
          return;
        }

        const sanitized = term.trim().replace(/[%_]/g, "\\$&");
        let query = supabase
          .from("projects")
          .select("id, name")
          .eq("lead_id", targetLeadId)
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false })
          .limit(25);

        if (sanitized) {
          query = query.ilike("name", `%${sanitized}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (latestRequestRef.current === requestId) {
          setProjectOptions((data as ProjectOption[]) || []);
          if (isBaseQuery) {
            setHasAnyProject(((data as ProjectOption[]) || []).length > 0);
            setHasLoadedInitial(true);
          }
        }
      } catch (error: any) {
        console.error("Failed to load projects", error);
        if (latestRequestRef.current === requestId) {
          setProjectOptions([]);
          if (isBaseQuery) {
            setHasAnyProject(false);
            setHasLoadedInitial(true);
          }
        }
        toast({
          title: t("steps.project.fetchErrorTitle"),
          description: error.message,
          variant: "destructive",
        });
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [toast, t]
  );

  useEffect(() => {
    if (!leadId) {
      setProjectOptions([]);
      setHasAnyProject(false);
      setHasLoadedInitial(false);
      return;
    }
    loadProjects(leadId, "");
  }, [leadId, loadProjects]);

  useEffect(() => {
    if (!dropdownOpen || !leadId) return;
    const handler = window.setTimeout(() => {
      loadProjects(leadId, searchTerm);
    }, 250);
    return () => {
      window.clearTimeout(handler);
    };
  }, [dropdownOpen, searchTerm, leadId, loadProjects]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [dropdownOpen]);

  const selectedProjectOption = useMemo(() => {
    if (!state.project.id) return undefined;
    return projectOptions.find((project) => project.id === state.project.id);
  }, [projectOptions, state.project.id]);

  const handleSelectProject = (project: ProjectOption) => {
    updateProject({
      id: project.id,
      name: project.name,
      description: state.project.description,
      mode: "existing",
    });
    setDropdownOpen(false);
    setSearchTerm("");
  };

  const handleProjectCreated = (project?: { id: string; name: string }) => {
    if (project) {
      const option = { id: project.id, name: project.name };
      setProjectOptions((prev) => {
        const without = prev.filter((item) => item.id !== project.id);
        return [option, ...without];
      });
      handleSelectProject(option);
    } else if (leadId) {
      void loadProjects(leadId, "");
    }
  };

  const handleSkipProject = () => {
    updateProject({
      id: undefined,
      name: "",
      description: "",
      mode: "existing",
    });
    setDropdownOpen(false);
    setSearchTerm("");
    onContinue?.();
  };

  useEffect(() => {
    if (dropdownOpen && (!leadId || noProjectsAvailable)) {
      setDropdownOpen(false);
    }
  }, [dropdownOpen, leadId, noProjectsAvailable]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("steps.project.navigationLabel")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.project.description")}
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("steps.project.selectExisting")}
        </Label>
        <div className="relative" ref={containerRef}>
          <Button
            type="button"
            onClick={() => {
              if (dropdownDisabled) return;
              setDropdownOpen((prev) => !prev);
            }}
            className={cn(
              "group flex h-12 w-full items-center justify-between rounded-xl border-none bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-4 py-3 text-left font-semibold text-white shadow-lg shadow-emerald-500/20 transition focus-visible:ring-2 focus-visible:ring-emerald-300",
              dropdownOpen && "ring-2 ring-emerald-300",
              dropdownDisabled && "cursor-not-allowed opacity-60"
            )}
            disabled={dropdownDisabled}
          >
            {selectedProjectOption ? (
              <span className="text-sm font-semibold text-white">
                {selectedProjectOption.name}
              </span>
            ) : !leadId ? (
              t("steps.project.selectLeadFirst")
            ) : loading ? (
              t("steps.project.loading")
            ) : (
              t("steps.project.selectPlaceholder")
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-80 transition group-data-[state=open]:rotate-180" />
          </Button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-emerald-200/40 bg-white shadow-2xl shadow-emerald-900/10">
              <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white">
                {t("steps.project.searchHeading")}
              </div>
              <div className="px-4 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t("steps.project.searchPlaceholder")}
                    className="h-11 rounded-xl border border-emerald-300/60 bg-white pl-9 text-sm shadow-inner shadow-emerald-900/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto border-t border-slate-100">
                {loading ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {t("steps.project.loading")}
                  </p>
                ) : projectOptions.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {searchTerm
                      ? t("steps.project.noResults")
                      : t("steps.project.emptyState")}
                  </p>
                ) : (
                  projectOptions.map((project) => {
                    const isActive = state.project.id === project.id;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleSelectProject(project)}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-emerald-50/70",
                          isActive && "bg-emerald-500/10"
                        )}
                      >
                        <span className="text-sm font-semibold text-slate-900">
                          {project.name}
                        </span>
                        <Check
                          className={cn(
                            "h-4 w-4 text-emerald-500 transition",
                            isActive ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {noProjectsAvailable && (
          <div className="rounded-2xl border border-border/70 bg-white px-4 py-6 text-sm text-muted-foreground shadow-sm">
            {t("steps.project.noProjects")}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <EnhancedProjectDialog
            defaultLeadId={leadId || undefined}
            onProjectCreated={handleProjectCreated}
            triggerDisabled={!leadId}
          >
            <Button
              variant="outline"
              className="h-11 gap-2"
              disabled={!leadId}
            >
              <FolderPlus className="h-4 w-4" />
              {t("steps.project.createButton")}
            </Button>
          </EnhancedProjectDialog>

          <Button
            type="button"
            variant="ghost"
            className="h-11 px-4 text-sm font-medium text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600"
            onClick={handleSkipProject}
          >
            {t("steps.project.skipButton")}
          </Button>
        </div>

        {leadId && projectOptions.length === 0 && !loading && !noProjectsAvailable && (
          <p className="text-xs text-muted-foreground">
            {t("steps.project.emptyState")}
          </p>
        )}
      </div>
    </div>
  );
};
