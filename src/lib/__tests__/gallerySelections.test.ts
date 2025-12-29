import { countSelectionsByParts, countUniqueSelectedAssets } from "@/lib/gallerySelections";

describe("gallerySelections", () => {
  describe("countUniqueSelectedAssets", () => {
    it("counts unique assets excluding favorites", () => {
      const selections = [
        { asset_id: "asset-1", selection_part: "cover" },
        { asset_id: "asset-1", selection_part: "favorites" },
        { asset_id: "asset-2", selection_part: "album" },
        { asset_id: "asset-2", selection_part: "album" },
        { asset_id: "asset-3", selection_part: "favorites" },
      ];

      expect(countUniqueSelectedAssets(selections, { favoritesSelectionPartKey: "favorites" })).toBe(2);
    });

    it("returns 0 when there are no non-favorite selections", () => {
      const selections = [{ asset_id: "asset-1", selection_part: "favorites" }];
      expect(countUniqueSelectedAssets(selections, { favoritesSelectionPartKey: "favorites" })).toBe(0);
    });

    it("ignores invalid rows", () => {
      const selections = [
        null,
        undefined,
        123,
        { asset_id: "", selection_part: "cover" },
        { asset_id: "asset-1", selection_part: null },
        { asset_id: "asset-2", selection_part: "cover" },
      ];

      expect(
        countUniqueSelectedAssets(selections as unknown as Array<{ asset_id: unknown; selection_part: unknown }>, {
          favoritesSelectionPartKey: "favorites",
        })
      ).toBe(1);
    });
  });

  describe("countSelectionsByParts", () => {
    it("counts selections per part and allows the same asset in multiple parts", () => {
      const selections = [
        { asset_id: "asset-1", selection_part: "album" },
        { asset_id: "asset-1", selection_part: "print" },
        { asset_id: "asset-2", selection_part: "album" },
        { asset_id: "asset-1", selection_part: "favorites" },
      ];

      const result = countSelectionsByParts(selections, ["album", "print"], { favoritesSelectionPartKey: "favorites" });

      expect(result).toEqual({ count: 3, hasMatches: true });
    });

    it("returns no matches when there are no valid parts", () => {
      const selections = [{ asset_id: "asset-1", selection_part: "album" }];

      expect(countSelectionsByParts(selections, [], { favoritesSelectionPartKey: "favorites" })).toEqual({
        count: 0,
        hasMatches: false,
      });
    });
  });
});
