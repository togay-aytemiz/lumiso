import * as React from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SegmentedSize = "sm" | "md";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  tooltip?: React.ReactNode;
}

export interface SegmentedControlProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  size?: SegmentedSize;
}

const sizeClasses: Record<SegmentedSize, { container: string; item: string }> = {
  sm: {
    container: "p-1 gap-1",
    item: "px-3 py-1 text-xs",
  },
  md: {
    container: "p-1.5 gap-1.5",
    item: "px-4 py-1.5 text-sm",
  },
};

const indicatorOffsets: Record<SegmentedSize, number> = {
  sm: 2,
  md: 3,
};

export const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(({ value, onValueChange, options, size = "md", className, ...rest }, ref) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const buttonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const sizeStyle = sizeClasses[size];
  const indicatorInset = indicatorOffsets[size];
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    width: number;
    left: number;
  }>({ width: 0, left: 0 });

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current[value];
    if (!container || !activeButton) return;
    const width = activeButton.offsetWidth;
    const left = activeButton.offsetLeft;
    setIndicatorStyle({
      width,
      left,
    });
  }, [value]);

  React.useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, options]);

  React.useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={mergedRef}
        role="group"
        className={cn(
          "relative inline-flex items-center rounded-full border border-border/50 bg-muted/60 shadow-inner",
          sizeStyle.container,
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border border-border/40 bg-white shadow-sm transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-900"
          style={{
            width: indicatorStyle.width || 0,
            left: indicatorStyle.left,
            opacity: indicatorStyle.width ? 1 : 0,
            top: indicatorInset,
            bottom: indicatorInset,
          }}
        />
        {options.map((option) => {
          const isActive = option.value === value;
          const button = (
            <button
              ref={(node) => {
                buttonRefs.current[option.value] = node;
              }}
              type="button"
              disabled={option.disabled}
              aria-pressed={isActive}
              aria-label={option.ariaLabel}
              onClick={() => {
                if (option.disabled) return;
                onValueChange(option.value);
              }}
              className={cn(
                "relative z-10 inline-flex items-center gap-1.5 rounded-full font-medium leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                sizeStyle.item,
                option.disabled && "pointer-events-none opacity-50",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );

          if (option.tooltip) {
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm leading-snug">
                  {option.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <React.Fragment key={option.value}>
              {button}
            </React.Fragment>
          );
        })}
      </div>
    </TooltipProvider>
  );
});

SegmentedControl.displayName = "SegmentedControl";
