import { applyVat, calculateVatPortion, normalizeVatInput, type VatMode } from "../vat";

describe("vat helpers", () => {
  it("normalizes invalid input", () => {
    expect(normalizeVatInput(undefined, undefined)).toEqual({ rate: 0, mode: "exclusive" });
    expect(normalizeVatInput(120, "inclusive")).toEqual({ rate: 99.99, mode: "inclusive" });
    expect(normalizeVatInput(-5, "invalid" as unknown as VatMode)).toEqual({
      rate: 0,
      mode: "exclusive",
    });
  });

  it("calculates VAT portion for exclusive prices", () => {
    const vat = calculateVatPortion(1000, 18, "exclusive");
    expect(vat).toBeCloseTo(180);
  });

  it("calculates VAT portion for inclusive prices", () => {
    const vat = calculateVatPortion(1180, 18, "inclusive");
    expect(vat).toBeCloseTo(180);
  });

  it("applies VAT for exclusive mode", () => {
    const { total, vatPortion } = applyVat(1000, 20, "exclusive");
    expect(vatPortion).toBeCloseTo(200);
    expect(total).toBeCloseTo(1200);
  });

  it("keeps totals unchanged for inclusive mode", () => {
    const { total, vatPortion } = applyVat(1180, 18, "inclusive");
    expect(total).toBeCloseTo(1180);
    expect(vatPortion).toBeCloseTo(180);
  });
});
