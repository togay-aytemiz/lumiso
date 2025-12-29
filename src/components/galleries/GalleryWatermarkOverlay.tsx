import { cn } from "@/lib/utils";
import type { GalleryWatermarkConfig } from "@/lib/galleryWatermark";

type WatermarkVariant = "thumbnail" | "preview" | "lightbox";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getPadding = (variant: WatermarkVariant) => {
  if (variant === "thumbnail") return { grid: "p-3", corner: "p-2", gap: "gap-3" };
  if (variant === "preview") return { grid: "p-6 sm:p-8", corner: "p-4 sm:p-6 md:p-8", gap: "gap-6 sm:gap-8" };
  return { grid: "p-8 sm:p-10 md:p-12", corner: "p-6 sm:p-8 md:p-10", gap: "gap-10 sm:gap-12" };
};

const getTextClassName = (variant: WatermarkVariant) => {
  if (variant === "thumbnail") return "text-xs font-semibold sm:text-sm";
  if (variant === "preview") return "text-base font-semibold sm:text-lg md:text-xl";
  return "text-lg font-semibold sm:text-xl md:text-2xl";
};

const getLogoClassName = (variant: WatermarkVariant) => {
  if (variant === "thumbnail") return "max-h-8 sm:max-h-10";
  if (variant === "preview") return "max-h-12 sm:max-h-14 md:max-h-16";
  return "max-h-20 sm:max-h-24 md:max-h-28";
};

export function GalleryWatermarkOverlay({
  watermark,
  variant = "thumbnail",
  className,
}: {
  watermark: GalleryWatermarkConfig;
  variant?: WatermarkVariant;
  className?: string;
}) {
  if (!watermark.settings.enabled) return null;

  const opacityValue = clamp(watermark.settings.opacity, 0, 100) / 100;
  const scaleValue = clamp(watermark.settings.scale, 0, 200) / 100;
  const textValue = watermark.text.trim();
  const logoUrl = watermark.logoUrl?.trim() || "";

  const renderContent = () => {
    if (watermark.settings.type === "logo" && logoUrl) {
      return (
        <img
          src={logoUrl}
          alt=""
          className={cn(getLogoClassName(variant), "object-contain drop-shadow-sm")}
          style={{ opacity: opacityValue, transform: `scale(${scaleValue})` }}
          loading="lazy"
          decoding="async"
        />
      );
    }

    if (!textValue) return null;

    return (
      <span
        className={cn(getTextClassName(variant), "select-none whitespace-nowrap text-white drop-shadow-sm")}
        style={{ opacity: opacityValue, transform: `scale(${scaleValue})` }}
      >
        {textValue}
      </span>
    );
  };

  const content = renderContent();
  if (!content) return null;

  const spacing = getPadding(variant);

  if (watermark.settings.placement === "center") {
    return (
      <div className={cn("absolute inset-0 pointer-events-none flex items-center justify-center", className)} aria-hidden="true">
        {content}
      </div>
    );
  }

  if (watermark.settings.placement === "corner") {
    return (
      <div
        className={cn(
          "absolute inset-0 pointer-events-none flex items-end justify-end",
          spacing.corner,
          className
        )}
        aria-hidden="true"
      >
        {content}
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none", spacing.grid, className)} aria-hidden="true">
      <div className={cn("grid h-full w-full grid-cols-3 grid-rows-3", spacing.gap)}>
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="flex items-center justify-center -rotate-12">
            {renderContent()}
          </div>
        ))}
      </div>
    </div>
  );
}

