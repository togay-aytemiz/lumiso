import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

type ProjectArchiveInput = {
  id: string;
  status_id?: string | null;
};

export async function onArchiveToggle(project: ProjectArchiveInput) {
  const {
    data: userData,
    error: userErr
  } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("User not authenticated");

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Organization required");
  }

  let archivedId: string | undefined;

  const {
    data: existingStatuses,
    error: statusError
  } = await supabase
    .from("project_statuses")
    .select("id, name")
    .eq("organization_id", organizationId)
    .ilike("name", "archived");

  if (statusError) throw statusError;

  const existingArchived = existingStatuses?.find(
    status => status.name?.toLowerCase() === "archived"
  );

  if (existingArchived) {
    archivedId = existingArchived.id;
  } else {
    const {
      data: created,
      error: createErr
    } = await supabase
      .from("project_statuses")
      .insert({
        user_id: userData.user.id,
        organization_id: organizationId,
        name: "Archived",
        color: "#6B7280",
        sort_order: 9999,
        lifecycle: "cancelled"
      })
      .select("id")
      .single();

    if (createErr) {
      if (createErr.code === "23505") {
        const {
          data: raceStatuses,
          error: raceError
        } = await supabase
          .from("project_statuses")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("name", "archived")
          .limit(1);

        if (raceError) throw raceError;

        if (raceStatuses && raceStatuses.length > 0) {
          archivedId = raceStatuses[0].id;
        } else {
          throw createErr;
        }
      } else {
        throw createErr;
      }
    } else if (created) {
      archivedId = created.id;
    }
  }

  if (!archivedId) {
    throw new Error("Unable to resolve archived status");
  }

  const {
    data: proj,
    error: projErr
  } = await supabase
    .from("projects")
    .select("id, status_id, previous_status_id, lead_id")
    .eq("id", project.id)
    .single();

  if (projErr) throw projErr;
  if (!proj) throw new Error("Project not found");

  const currentlyArchived = proj.status_id === archivedId;
  if (!currentlyArchived) {
    const {
      error: updErr
    } = await supabase
      .from("projects")
      .update({
        previous_status_id: proj.status_id,
        status_id: archivedId
      })
      .eq("id", project.id)
      .eq("user_id", userData.user.id);
    if (updErr) throw updErr;

    await supabase.from("activities").insert({
      type: "status_change",
      content: "Project archived",
      project_id: project.id,
      lead_id: proj.lead_id,
      user_id: userData.user.id,
      organization_id: organizationId
    });

    await supabase.from("audit_log").insert({
      user_id: userData.user.id,
      entity_type: "project",
      entity_id: project.id,
      action: "archived",
      old_values: {
        status_id: proj.status_id
      },
      new_values: {
        status_id: archivedId
      }
    });
    return {
      isArchived: true
    };
  }

  let targetStatusId: string | null = proj.previous_status_id;
  if (!targetStatusId) {
    const {
      data: def,
      error: defErr
    } = await supabase.rpc("get_default_project_status", {
      user_uuid: userData.user.id
    });
    if (defErr) throw defErr;
    targetStatusId = def as string | null;
  }

  const {
    error: restoreErr
  } = await supabase
    .from("projects")
    .update({
      status_id: targetStatusId,
      previous_status_id: null
    })
    .eq("id", project.id)
    .eq("user_id", userData.user.id);
  if (restoreErr) throw restoreErr;

  await supabase.from("activities").insert({
    type: "status_change",
    content: "Project restored",
    project_id: project.id,
    lead_id: proj.lead_id,
    user_id: userData.user.id,
    organization_id: organizationId
  });

  await supabase.from("audit_log").insert({
    user_id: userData.user.id,
    entity_type: "project",
    entity_id: project.id,
    action: "restored",
    old_values: {
      status_id: archivedId
    },
    new_values: {
      status_id: targetStatusId
    }
  });
  return {
    isArchived: false
  };
}
