import { type IframeHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OnboardingVideoProps {
  src: string;
  title: string;
  className?: string;
  iframeClassName?: string;
  allow?: string;
  loading?: "lazy" | "eager";
  referrerPolicy?: IframeHTMLAttributes<HTMLIFrameElement>["referrerPolicy"];
}

/**
 * Standardized wrapper for onboarding/tutorial videos so every modal
 * uses the same sizing, border, and aspect ratio.
 */
export function OnboardingVideo({
  src,
  title,
  className,
  iframeClassName,
  allow,
  loading = "lazy",
  referrerPolicy,
}: OnboardingVideoProps) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/60 bg-black shadow-lg", className)}>
      <div className="aspect-video w-full sm:min-h-[460px] lg:min-h-[520px]">
        <iframe
          src={src}
          title={title}
          className={cn("h-full w-full", iframeClassName)}
          allow={
            allow ?? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          }
          allowFullScreen
          loading={loading}
          referrerPolicy={referrerPolicy}
        />
      </div>
    </div>
  );
}
