import { isSupabaseStorageObjectMissingError } from "@/lib/galleryAssets";

describe("galleryAssets", () => {
  describe("isSupabaseStorageObjectMissingError", () => {
    it("returns true when statusCode is 404", () => {
      expect(isSupabaseStorageObjectMissingError({ statusCode: 404, message: "Not found" })).toBe(true);
    });

    it("returns true when message includes not found", () => {
      expect(isSupabaseStorageObjectMissingError({ message: "Object not found" })).toBe(true);
    });

    it("returns false for other errors", () => {
      expect(isSupabaseStorageObjectMissingError({ statusCode: 403, message: "Forbidden" })).toBe(false);
    });

    it("returns false for non-object values", () => {
      expect(isSupabaseStorageObjectMissingError(null)).toBe(false);
      expect(isSupabaseStorageObjectMissingError("not found")).toBe(false);
    });
  });
});

