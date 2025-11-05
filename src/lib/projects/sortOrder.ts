import { supabase } from "@/integrations/supabase/client";

export const PROJECT_SORT_GAP = 1000;

/**
 * Ensure the given project appears at the top of its kanban column by
 * assigning it a sort order that precedes the current minimum.
 */
export async function promoteProjectToTop(projectId: string) {
  try {
    const { data: projectRecord, error: projectFetchError } = await supabase
      .from("projects")
      .select("status_id, organization_id")
      .eq("id", projectId)
      .single();

    if (projectFetchError || !projectRecord) {
      throw projectFetchError ?? new Error("Project not found");
    }

    const projectStatusId = projectRecord.status_id ?? null;
    const organizationId = projectRecord.organization_id;

    let query = supabase
      .from("projects")
      .select("id, sort_order")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .neq("id", projectId);

    if (projectStatusId) {
      query = query.eq("status_id", projectStatusId);
    } else {
      query = query.is("status_id", null);
    }

    const { data: minSortData, error: minSortError } = await query;
    if (minSortError) throw minSortError;

    const minSortOrder =
      typeof minSortData?.[0]?.sort_order === "number"
        ? minSortData[0].sort_order
        : null;

    const newSortOrder = (minSortOrder ?? PROJECT_SORT_GAP) - PROJECT_SORT_GAP;

    const { error: updateError } = await supabase
      .from("projects")
      .update({ sort_order: newSortOrder, status_id: projectStatusId })
      .eq("id", projectId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error("Failed to promote project to top:", error);
  }
}
