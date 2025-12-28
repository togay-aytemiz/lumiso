import { supabase } from "@/integrations/supabase/client";
import { GALLERY_ASSETS_BUCKET } from "@/lib/galleryAssets";

type GalleryDeletionInput = {
  galleryId: string;
  sessionId?: string | null;
  organizationId?: string | null;
};

const listStorageFilesInFolder = async (folder: string) => {
  const files: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(GALLERY_ASSETS_BUCKET)
      .list(folder, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const rows = data ?? [];
    rows.forEach((entry) => {
      if (entry.id) {
        files.push(`${folder}/${entry.name}`);
      }
    });
    if (rows.length < limit) break;
    offset += limit;
  }

  return files;
};

export const deleteGalleryWithAssets = async ({ galleryId, sessionId, organizationId }: GalleryDeletionInput) => {
  let resolvedOrganizationId = organizationId ?? null;

  if (!resolvedOrganizationId && sessionId) {
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("organization_id")
      .eq("id", sessionId)
      .single();
    if (sessionError) throw sessionError;
    resolvedOrganizationId = sessionRow?.organization_id ?? null;
  }

  if (!resolvedOrganizationId) {
    throw new Error("No organization found for this gallery.");
  }

  const basePrefix = `${resolvedOrganizationId}/galleries/${galleryId}`;
  const storagePaths = new Set<string>();

  const { data: assetRows, error: assetError } = await supabase
    .from("gallery_assets")
    .select("storage_path_web,storage_path_original,metadata")
    .eq("gallery_id", galleryId);
  if (assetError) throw assetError;

  (assetRows ?? []).forEach((row) => {
    const typedRow = row as {
      storage_path_web: string | null;
      storage_path_original: string | null;
      metadata?: unknown;
    };
    const rawMetadata = typedRow.metadata;
    const metadata =
      rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
        ? (rawMetadata as Record<string, unknown>)
        : {};
    const thumbPath = typeof metadata.thumbPath === "string" ? metadata.thumbPath : null;
    if (typedRow.storage_path_web) storagePaths.add(typedRow.storage_path_web);
    if (typedRow.storage_path_original) storagePaths.add(typedRow.storage_path_original);
    if (thumbPath) storagePaths.add(thumbPath);
  });

  const folderCandidates = [basePrefix, `${basePrefix}/proof`, `${basePrefix}/original`, `${basePrefix}/thumb`];

  await Promise.all(
    folderCandidates.map(async (folder) => {
      const files = await listStorageFilesInFolder(folder);
      files.forEach((path) => storagePaths.add(path));
    })
  );

  const pathsToRemove = Array.from(storagePaths);
  const chunkSize = 100;
  for (let index = 0; index < pathsToRemove.length; index += chunkSize) {
    const chunk = pathsToRemove.slice(index, index + chunkSize);
    const { error: removeError } = await supabase.storage.from(GALLERY_ASSETS_BUCKET).remove(chunk);
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await supabase.from("galleries").delete().eq("id", galleryId);
  if (deleteError) throw deleteError;
};
