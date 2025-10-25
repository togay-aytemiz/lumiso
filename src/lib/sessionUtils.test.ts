import { getDisplaySessionName, generateSessionName } from "./sessionUtils";

describe("sessionUtils", () => {
  describe("getDisplaySessionName", () => {
    it("returns trimmed session name when provided", () => {
      expect(
        getDisplaySessionName({
          session_name: "  Sunset Shoot ",
        })
      ).toBe("Sunset Shoot");
    });

    it("falls back to project type when session name missing", () => {
      expect(
        getDisplaySessionName({
          projects: {
            project_types: {
              name: "Engagement",
            },
          },
        })
      ).toBe("Engagement Session");
    });

    it("uses lead name when project type unavailable", () => {
      expect(
        getDisplaySessionName({
          leads: {
            name: "Taylor Swift",
          },
        })
      ).toBe("Taylor Swift Session");
    });

    it("returns generic fallback when no contextual data present", () => {
      expect(getDisplaySessionName({})).toBe("Session");
      expect(getDisplaySessionName(undefined as any)).toBe("Session");
    });
  });

  describe("generateSessionName", () => {
    it("returns default label when project name is empty or whitespace", () => {
      expect(generateSessionName("")).toBe("New Session");
      expect(generateSessionName("   ")).toBe("New Session");
    });

    it("returns trimmed project name with Session suffix", () => {
      expect(generateSessionName("  Family Portraits ")).toBe(
        "Family Portraits Session"
      );
    });
  });
});
