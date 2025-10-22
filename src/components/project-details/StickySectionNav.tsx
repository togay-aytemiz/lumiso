import { cn } from "@/lib/utils";

export interface StickySectionNavItem {
  id: string;
  title: string;
}

export interface StickySectionNavProps {
  items: StickySectionNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  stickyTopOffset?: number;
  align?: "start" | "center" | "end";
  ariaLabel?: string;
  className?: string;
  navClassName?: string;
}

const BASE_NAV_BUTTON_CLASSES = [
  "flex-shrink-0",
  "whitespace-nowrap",
  "rounded-full",
  "border",
  "px-3",
  "py-1.5",
  "text-sm",
  "font-medium",
  "transition-colors",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-primary"
].join(" ");

const ACTIVE_NAV_CLASSES = "border-primary/50 bg-primary/10 text-primary shadow-sm";
const INACTIVE_NAV_CLASSES = "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground";

const ALIGN_CLASSNAMES: Record<NonNullable<StickySectionNavProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end"
};

export default function StickySectionNav({
  items,
  activeId,
  onSelect,
  stickyTopOffset = 0,
  align = "end",
  ariaLabel = "Section navigation",
  className,
  navClassName
}: StickySectionNavProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky z-30 -mx-2 mb-6 border-b border-border/20 bg-background/70 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50",
        className
      )}
      style={{ top: stickyTopOffset }}
    >
      <nav
        className={cn(
          "flex w-full max-w-full items-center gap-2 overflow-x-auto",
          ALIGN_CLASSNAMES[align],
          navClassName
        )}
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const buttonClasses = [
            BASE_NAV_BUTTON_CLASSES,
            item.id === activeId ? ACTIVE_NAV_CLASSES : INACTIVE_NAV_CLASSES
          ].join(" ");

          return (
            <button
              key={item.id}
              type="button"
              className={buttonClasses}
              onClick={() => onSelect?.(item.id)}
              aria-current={item.id === activeId ? "page" : undefined}
            >
              {item.title}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export const STICKY_NAV_CLASSES = {
  baseButton: BASE_NAV_BUTTON_CLASSES,
  active: ACTIVE_NAV_CLASSES,
  inactive: INACTIVE_NAV_CLASSES
};
