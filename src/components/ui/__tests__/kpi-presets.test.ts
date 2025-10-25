import {
  getKpiIconPreset,
  KPI_ICON_BASE_CLASS,
  KPI_ICON_PRESETS,
  KPI_ICON_SVG_CLASS,
} from "../kpi-presets";

describe("kpi-presets", () => {
  it("returns preset styles with base classes attached", () => {
    const preset = getKpiIconPreset("indigo");

    expect(preset.iconBackground).toBe(
      KPI_ICON_PRESETS.indigo.iconBackground
    );
    expect(preset.iconForeground).toBe("text-white");
    expect(preset.iconClassName).toContain(KPI_ICON_BASE_CLASS);
    expect(preset.iconClassName).toContain(KPI_ICON_PRESETS.indigo.glow);
    expect(preset.iconSvgClassName).toBe(KPI_ICON_SVG_CLASS);
  });

  it("defaults iconForeground to white when preset does not override", () => {
    const preset = getKpiIconPreset("emerald");

    expect(preset.iconForeground).toBe("text-white");
  });

  it("honors preset-specific foreground overrides", () => {
    const preset = getKpiIconPreset("yellow");

    expect(preset.iconForeground).toBe(
      KPI_ICON_PRESETS.yellow.iconForeground
    );
  });

  it("provides presets for every declared key", () => {
    Object.keys(KPI_ICON_PRESETS).forEach((key) => {
      const preset = getKpiIconPreset(key as keyof typeof KPI_ICON_PRESETS);
      expect(preset.iconClassName).toContain(KPI_ICON_BASE_CLASS);
      expect(typeof preset.iconBackground).toBe("string");
      expect(typeof preset.iconSvgClassName).toBe("string");
    });
  });
});
