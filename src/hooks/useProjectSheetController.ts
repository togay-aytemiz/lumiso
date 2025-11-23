import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProjectPackageSnapshot } from "@/lib/projects/projectPackageSnapshot";
import { useTranslation } from "react-i18next";

export type ProjectSheetProject = {
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
  package_id?: string | null;
  package_snapshot?: ProjectPackageSnapshot | null;
};

export type ProjectSheetLeadInfo = {
  id: string;
  name: string;
  status?: string | null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
};

interface UseProjectSheetControllerOptions {
  resolveLeadName?: (leadId: string) => string | undefined;
  onLeadResolved?: (lead: ProjectSheetLeadInfo) => void;
}

export const useProjectSheetController = (
  options: UseProjectSheetControllerOptions = {}
) => {
  const { t } = useTranslation(["messages", "common"]);
  const { resolveLeadName, onLeadResolved } = options;
  const [viewingProject, setViewingProject] =
    useState<ProjectSheetProject | null>(null);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [projectSheetLeadName, setProjectSheetLeadName] =
    useState("Unknown Lead");
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const resolveLeadDetails = useCallback(
    async (leadId?: string | null) => {
      if (!leadId) return "Unknown Lead";
      const cachedName = resolveLeadName?.(leadId);
      if (cachedName) {
        return cachedName;
      }
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, status")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      if (data) {
        onLeadResolved?.({
          id: data.id,
          name: data.name,
          status: data.status,
        });
      }
      return data?.name || "Unknown Lead";
    },
    [onLeadResolved, resolveLeadName]
  );

  const openProjectSheet = useCallback(
    async (projectId?: string | null) => {
      if (!projectId || loadingProjectId === projectId) {
        return;
      }
      setLoadingProjectId(projectId);
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();
        if (error) throw error;

      setViewingProject(data as ProjectSheetProject);
      const leadName = await resolveLeadDetails(data?.lead_id);
      setProjectSheetLeadName(leadName);
      setProjectSheetOpen(true);
    } catch (error) {
      toast({
        title: t("error.projectOpen", { ns: "messages" }),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
        setLoadingProjectId(null);
      }
    },
    [loadingProjectId, resolveLeadDetails]
  );

  const onProjectSheetOpenChange = useCallback((nextOpen: boolean) => {
    setProjectSheetOpen(nextOpen);
    if (!nextOpen) {
      setViewingProject(null);
    }
  }, []);

  return {
    viewingProject,
    projectSheetOpen,
    onProjectSheetOpenChange,
    projectSheetLeadName,
    openProjectSheet,
  };
};
