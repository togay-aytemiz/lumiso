export type GalleryWatermarkPlacement = "grid" | "center" | "corner";
export type GalleryWatermarkType = "text" | "logo";

export type GalleryWatermarkSettings = {
  enabled: boolean;
  type: GalleryWatermarkType;
  placement: GalleryWatermarkPlacement;
  opacity: number;
  scale: number;
};

export type GalleryWatermarkConfig = {
  settings: GalleryWatermarkSettings;
  text: string;
  logoUrl: string | null;
};

export const DEFAULT_GALLERY_WATERMARK_SETTINGS: GalleryWatermarkSettings = {
  enabled: false,
  type: "text",
  placement: "grid",
  opacity: 60,
  scale: 100,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const parseGalleryWatermarkFromBranding = (
  branding: Record<string, unknown> | null | undefined
): GalleryWatermarkConfig => {
  const watermarkRaw = isRecord(branding?.watermark) ? branding?.watermark : null;
  const enabled = watermarkRaw?.enabled === true;
  const type: GalleryWatermarkType = watermarkRaw?.type === "logo" ? "logo" : "text";
  const placement: GalleryWatermarkPlacement =
    watermarkRaw?.placement === "center" ? "center" : watermarkRaw?.placement === "corner" ? "corner" : "grid";

  const opacityParsed = parseNumber(watermarkRaw?.opacity);
  const scaleParsed = parseNumber(watermarkRaw?.scale);

  const opacity = clamp(opacityParsed ?? DEFAULT_GALLERY_WATERMARK_SETTINGS.opacity, 10, 100);
  const scale = clamp(scaleParsed ?? DEFAULT_GALLERY_WATERMARK_SETTINGS.scale, 20, 200);

  const text = typeof watermarkRaw?.text === "string" ? watermarkRaw.text : "";
  const logoUrl =
    typeof watermarkRaw?.logoUrl === "string" && watermarkRaw.logoUrl.trim() ? watermarkRaw.logoUrl : null;

  return {
    settings: { enabled, type, placement, opacity, scale },
    text,
    logoUrl,
  };
};

export const applyGalleryWatermarkToBranding = (
  branding: Record<string, unknown>,
  watermark: GalleryWatermarkConfig
): Record<string, unknown> => ({
  ...branding,
  watermark: {
    enabled: watermark.settings.enabled,
    type: watermark.settings.type,
    placement: watermark.settings.placement,
    opacity: watermark.settings.opacity,
    scale: watermark.settings.scale,
    text: watermark.text,
    logoUrl: watermark.logoUrl,
  },
});
