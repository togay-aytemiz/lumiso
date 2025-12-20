export type ClientSelectionLike = {
  asset_id: unknown;
  selection_part: unknown;
};

export const normalizeSelectionPartKey = (value: unknown) =>
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

export const countSelectionsByParts = (
  selections: ClientSelectionLike[] | null | undefined,
  partKeys: string[] | null | undefined,
  options?: { favoritesSelectionPartKey?: string }
) => {
  if (!selections || selections.length === 0) return { count: 0, hasMatches: false };
  if (!partKeys || partKeys.length === 0) return { count: 0, hasMatches: false };

  const favoritesKey = normalizeSelectionPartKey(options?.favoritesSelectionPartKey ?? "favorites");
  const normalizedKeys = new Set(
    partKeys.map((key) => normalizeSelectionPartKey(key)).filter((key) => key.length > 0)
  );
  if (normalizedKeys.size === 0) return { count: 0, hasMatches: false };

  const selectionsByPart = new Map<string, Set<string>>();
  let hasMatches = false;

  selections.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const assetId = typeof entry.asset_id === "string" ? entry.asset_id.trim() : "";
    if (!assetId) return;
    const partKey = normalizeSelectionPartKey(entry.selection_part);
    if (!partKey) return;
    if (favoritesKey && partKey === favoritesKey) return;
    if (!normalizedKeys.has(partKey)) return;
    hasMatches = true;
    const existing = selectionsByPart.get(partKey) ?? new Set<string>();
    existing.add(assetId);
    selectionsByPart.set(partKey, existing);
  });

  const count = Array.from(selectionsByPart.values()).reduce((total, set) => total + set.size, 0);
  return { count, hasMatches };
};
