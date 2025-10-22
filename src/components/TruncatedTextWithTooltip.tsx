import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ElementType } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SupportedElement = "span" | "div" | "p";

const LINE_CLAMP_CLASSES: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

interface TruncatedTextWithTooltipProps<T extends SupportedElement = "span">
  extends ComponentPropsWithoutRef<T> {
  text: string;
  lines?: number;
  as?: T;
  tooltipSide?: ComponentPropsWithoutRef<typeof TooltipContent>["side"];
  tooltipAlign?: ComponentPropsWithoutRef<typeof TooltipContent>["align"];
  tooltipClassName?: string;
  delayDuration?: number;
}

export function TruncatedTextWithTooltip<T extends SupportedElement = "span">({
  text,
  lines = 2,
  as,
  className,
  tooltipSide = "top",
  tooltipAlign = "center",
  tooltipClassName,
  delayDuration = 150,
  ...rest
}: TruncatedTextWithTooltipProps<T>) {
  const Component = (as ?? "span") as ElementType;
  const textRef = useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const clampClass = useMemo(() => {
    return LINE_CLAMP_CLASSES[lines] || LINE_CLAMP_CLASSES[2];
  }, [lines]);

  useEffect(() => {
    if (!text) {
      setIsTruncated(false);
      return;
    }

    if (typeof window === "undefined") {
      setIsTruncated(false);
      return;
    }

    const el = textRef.current;
    if (!el) {
      setIsTruncated(false);
      return;
    }

    const checkTruncation = () => {
      const isOverflowingVertically = el.scrollHeight > el.clientHeight + 1;
      const isOverflowingHorizontally = el.scrollWidth > el.clientWidth + 1;
      setIsTruncated(isOverflowingVertically || isOverflowingHorizontally);
    };

    const frame = window.requestAnimationFrame(checkTruncation);

    let resizeObserver: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      resizeObserver = new window.ResizeObserver(checkTruncation);
      resizeObserver.observe(el);
    } else {
      window.addEventListener("resize", checkTruncation);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", checkTruncation);
      }
    };
  }, [text, lines]);

  if (!text) {
    return null;
  }

  const content = (
    <Component
      ref={textRef as any}
      className={cn(
        "break-words",
        clampClass,
        isTruncated && "cursor-help",
        className
      )}
      {...(rest as ComponentPropsWithoutRef<typeof Component>)}
    >
      {text}
    </Component>
  );

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        {isTruncated && (
          <TooltipContent
            side={tooltipSide}
            align={tooltipAlign}
            className={cn(
              "max-w-xs whitespace-pre-wrap break-words text-left",
              tooltipClassName
            )}
          >
            {text}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
