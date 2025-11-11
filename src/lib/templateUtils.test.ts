import {
  replacePlaceholders,
  getCharacterCount,
  checkSpamWords,
  generatePlainText,
  getPreviewDataSets,
  previewDataSets,
  emojis,
} from "./templateUtils";

jest.mock("./templateBlockUtils", () => ({
  blocksToPlainText: jest.fn(() => "plain-text-from-blocks"),
}));

describe("templateUtils", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("replacePlaceholders", () => {
    it("replaces placeholders with provided data when fallbacks disabled", () => {
      const result = replacePlaceholders(
        "Hello {name}, welcome to {location}",
        { name: "Tayte", location: "Lumiso" },
        false
      );

      expect(result).toBe("Hello Tayte, welcome to Lumiso");
    });

    it("supports fallback syntax when allowFallbacks is true", () => {
      const result = replacePlaceholders(
        "Dear {customer|friend}, see you at {venue|our studio}",
        { customer: "", venue: "" }
      );

      expect(result).toBe("Dear friend, see you at our studio");
    });
  });

  describe("getCharacterCount", () => {
    it("returns the string length", () => {
      expect(getCharacterCount("abc")).toBe(3);
    });
  });

  describe("checkSpamWords", () => {
    it("returns matching spam words case-insensitively", () => {
      expect(checkSpamWords("This is a FREE limited time offer")).toEqual([
        "free",
        "limited time",
      ]);
    });

    it("returns empty array when no spam words present", () => {
      expect(checkSpamWords("Professional photography session")).toEqual([]);
    });
  });

  describe("generatePlainText", () => {
    it("delegates to blocksToPlainText when an array of blocks is provided", () => {
      const output = generatePlainText([{ type: "paragraph", text: "Hello" }], {
        name: "Client",
      });

      expect(output).toBe("plain-text-from-blocks");
    });

    it("replaces placeholders when given a legacy string template", () => {
      const output = generatePlainText("Welcome {name}", { name: "Tayte" });

      expect(output).toBe("Welcome Tayte");
    });

    it("returns fallback message for unsupported input shapes", () => {
      expect(generatePlainText(123 as unknown as string)).toBe(
        "No content available"
      );
    });
  });

  describe("getPreviewDataSets", () => {
    it("returns Turkish datasets when language is tr", () => {
      const sets = getPreviewDataSets("tr");

      expect(sets).toHaveLength(3);
      expect(sets[0]?.name).toBe("Tam Veri");
      expect(sets[1]?.data.business_name).toBe("Parlak Fotoğrafçılık");
    });

    it("returns English datasets by default", () => {
      const sets = getPreviewDataSets();

      expect(sets).toHaveLength(3);
      expect(sets[0]?.name).toBe("Complete Data");
      expect(sets[0]?.data.lead_name).toBe("Sarah Johnson");
    });
  });

  it("exposes default English previewDataSets constant", () => {
    expect(previewDataSets[0]?.name).toBe("Complete Data");
  });

  it("provides a non-empty emojis list", () => {
    expect(emojis.length).toBeGreaterThan(0);
    expect(emojis).toContain("📸");
  });
});
