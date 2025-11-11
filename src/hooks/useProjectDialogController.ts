import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ProjectDialogProject = {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id?: string | null;
  previous_status_id?: string | null;
  project_type_id?: string | null;
};

export type ProjectDialogLeadInfo = {
  id: string;
  name: string;
  status?: string | null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
};

interface UseProjectDialogControllerOptions {
  resolveLeadName?: (leadId: string) => string | undefined;
  onLeadResolved?: (lead: ProjectDialogLeadInfo) => void;
}

export const useProjectDialogController = (
  options: UseProjectDialogControllerOptions = {}
) => {
  const { resolveLeadName, onLeadResolved } = options;
  const [viewingProject, setViewingProject] =
    useState<ProjectDialogProject | null>(null);
  const [leadName, setLeadName] = useState("Unknown Lead");
  const [open, setOpen] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const openProjectDialog = useCallback(
    async (projectId?: string | null) => {
      if (!projectId || loadingProjectId === projectId) {
        return;
      }
      setLoadingProjectId(projectId);
      try {
        const { data, error } = await supabase
          .from("projects")
          .select(
            "id, name, description, lead_id, user_id, created_at, updated_at, status_id, previous_status_id, project_type_id"
          )
          .eq("id", projectId)
          .single();

        if (error) throw error;

        const project = data as ProjectDialogProject;
        setViewingProject(project);

        let nextLeadName = "Unknown Lead";
        if (project.lead_id) {
          const resolvedLeadName = resolveLeadName?.(project.lead_id);
          if (resolvedLeadName) {
            nextLeadName = resolvedLeadName;
          } else {
            const { data: leadData, error: leadError } = await supabase
              .from("leads")
              .select("id, name, status")
              .eq("id", project.lead_id)
              .single();
            if (leadError) throw leadError;
            nextLeadName = leadData?.name || "Unknown Lead";
            if (leadData) {
              onLeadResolved?.({
                id: leadData.id,
                name: leadData.name,
                status: leadData.status,
              });
            }
          }
        }

        setLeadName(nextLeadName);
        setOpen(true);
      } catch (error: unknown) {
        toast({
          title: "Unable to open project",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setLoadingProjectId(null);
      }
    },
    [loadingProjectId, resolveLeadName, onLeadResolved]
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setViewingProject(null);
    }
  }, []);

  return {
    viewingProject,
    projectDialogOpen: open,
    onProjectDialogOpenChange: handleOpenChange,
    projectDialogLeadName: leadName,
    openProjectDialog,
  };
};
