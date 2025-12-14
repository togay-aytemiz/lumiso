export type ClientSelectionLike = {
  asset_id: unknown;
  selection_part: unknown;
};

const normalizeSelectionPartKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const countUniqueSelectedAssets = (
  selections: ClientSelectionLike[] | null | undefined,
  options?: { favoritesSelectionPartKey?: string }
) => {
  if (!selections || selections.length === 0) return 0;

  const favoritesKey = normalizeSelectionPartKey(options?.favoritesSelectionPartKey ?? "favorites");
  const ids = new Set<string>();

  selections.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const assetId = typeof entry.asset_id === "string" ? entry.asset_id.trim() : "";
    if (!assetId) return;

    const partKey = normalizeSelectionPartKey(entry.selection_part);
    if (!partKey) return;
    if (favoritesKey && partKey === favoritesKey) return;

    ids.add(assetId);
  });

  return ids.size;
};

