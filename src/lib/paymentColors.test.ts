import { PAYMENT_COLORS } from "./paymentColors";

describe("paymentColors", () => {
  it("exposes paid, due, and refund status color mappings", () => {
    expect(Object.keys(PAYMENT_COLORS)).toEqual(["paid", "due", "refund"]);
  });

  it("provides consistent styling fields for each status", () => {
    Object.entries(PAYMENT_COLORS).forEach(([status, config]) => {
      expect(config.hex).toMatch(/^#/);
      expect(config.textClass).toMatch(/^text-/);
      expect(config.badgeClass).toContain("border");
      expect(config.badgeClass).toContain("bg-");
      expect(config.badgeClass).toContain("text-");
      expect(config.badgeClass).toContain("hover:bg-");
    });
  });
});
