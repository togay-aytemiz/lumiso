import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { deleteGalleryWithAssets } from "@/lib/galleryDeletion";
import { getUserOrganizationId } from "@/lib/organizationUtils";

const DELETE_BATCH_SIZE = 100;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

type TableName = keyof Database["public"]["Tables"];

const deleteByOrganization = async (table: TableName, organizationId: string) => {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("organization_id", organizationId);
  if (error) throw error;
};

const deleteByUser = async (table: TableName, userId: string) => {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
};

const deleteByIds = async (
  table: TableName,
  column: string,
  ids: string[]
) => {
  const chunks = chunkArray(ids, DELETE_BATCH_SIZE);
  for (const chunk of chunks) {
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw error;
  }
};

const fetchIdsByOrganization = async (
  table: TableName,
  organizationId: string
) => {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
};

const fetchGalleryIdsByKey = async (
  column: "session_id" | "project_id",
  ids: string[],
  galleryIds: Set<string>
) => {
  const chunks = chunkArray(ids, DELETE_BATCH_SIZE);
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("galleries")
      .select("id")
      .in(column, chunk);
    if (error) throw error;
    (data ?? []).forEach((row) => {
      if (row.id) {
        galleryIds.add(row.id);
      }
    });
  }
};

const deleteOrganizationData = async (organizationId: string, userId: string) => {
  const [projectIds, sessionIds, leadIds] = await Promise.all([
    fetchIdsByOrganization("projects", organizationId),
    fetchIdsByOrganization("sessions", organizationId),
    fetchIdsByOrganization("leads", organizationId),
  ]);

  const galleryIds = new Set<string>();
  if (sessionIds.length > 0) {
    await fetchGalleryIdsByKey("session_id", sessionIds, galleryIds);
  }
  if (projectIds.length > 0) {
    await fetchGalleryIdsByKey("project_id", projectIds, galleryIds);
  }

  for (const galleryId of galleryIds) {
    await deleteGalleryWithAssets({ galleryId, organizationId });
  }

  if (projectIds.length > 0) {
    await deleteByIds("project_services", "project_id", projectIds);
    await deleteByIds("todos", "project_id", projectIds);
    await deleteByIds("payments", "project_id", projectIds);
  }

  await deleteByOrganization("activities", organizationId);
  await deleteByOrganization("scheduled_session_reminders", organizationId);

  await deleteByOrganization("sessions", organizationId);
  await deleteByOrganization("projects", organizationId);

  if (leadIds.length > 0) {
    await deleteByIds("lead_field_values", "lead_id", leadIds);
  }

  await deleteByUser("appointments", userId);

  await deleteByOrganization("leads", organizationId);
};

export const deleteAllOrganizationData = async (password: string) => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = userData.user?.email;
  const userId = userData.user?.id;
  if (!email) {
    throw new Error("Missing user email for reauthentication.");
  }
  if (!userId) {
    throw new Error("Missing user id.");
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) throw authError;

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("No organization ID found.");
  }

  await deleteOrganizationData(organizationId, userId);
};
