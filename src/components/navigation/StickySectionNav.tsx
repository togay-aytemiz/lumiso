import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { cn } from "@/lib/utils";

export interface StickySectionNavItem {
  id: string;
  title: string;
  onSelect?: () => void;
}

export interface StickySectionNavProps {
  items: StickySectionNavItem[];
  stickyTopOffset?: number;
  align?: "start" | "center" | "end";
  ariaLabel?: string;
  className?: string;
  navClassName?: string;
  observeIds?: string[];
  onActiveChange?: (id: string) => void;
  fallbackActiveId?: string;
  scrollBehavior?: ScrollBehavior;
  disableSticky?: boolean;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

const ALIGN_CLASSNAMES: Record<NonNullable<StickySectionNavProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end"
};

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
const INACTIVE_NAV_CLASSES =
  "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground";
const EXTRA_SCROLL_MARGIN_PX = 12;

export function StickySectionNav({
  items,
  stickyTopOffset = 0,
  align = "end",
  ariaLabel = "Section navigation",
  className,
  navClassName,
  observeIds,
  onActiveChange,
  fallbackActiveId,
  scrollBehavior = "smooth",
  disableSticky = false,
  scrollContainerRef
}: StickySectionNavProps) {
  const [activeId, setActiveId] = useState<string>(() => fallbackActiveId ?? items[0]?.id ?? "");
  const observer = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const idsToObserve = useMemo(() => {
    const ids = observeIds && observeIds.length > 0 ? observeIds : items.map((item) => item.id);
    return Array.from(new Set(ids)).filter(Boolean);
  }, [observeIds, items]);

  useEffect(() => {
    if (idsToObserve.length === 0 || typeof window === "undefined") {
      return undefined;
    }

    const headings = idsToObserve
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    observer.current?.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: [0, 0.5, 1] }
    );

    headings.forEach((el) => observer.current?.observe(el));

    return () => observer.current?.disconnect();
  }, [idsToObserve]);

  useEffect(() => {
    if (idsToObserve.length === 0) {
      setActiveId("");
      return;
    }

    setActiveId((prev) => {
      if (prev && idsToObserve.includes(prev)) {
        return prev;
      }
      const preferred =
        fallbackActiveId && idsToObserve.includes(fallbackActiveId)
          ? fallbackActiveId
          : idsToObserve[0];
      return preferred ?? "";
    });
  }, [idsToObserve, fallbackActiveId]);

  useEffect(() => {
    if (activeId && onActiveChange) {
      onActiveChange(activeId);
    }
  }, [activeId, onActiveChange]);

  const scrollToTarget = (targetId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    const stickyOffset =
      (disableSticky ? 0 : (navRef.current?.offsetHeight ?? 0) + stickyTopOffset) +
      EXTRA_SCROLL_MARGIN_PX;
    const scrollContainer = scrollContainerRef?.current;

    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const currentOffset = scrollContainer.scrollTop ?? 0;
      const relativeTop = targetRect.top - containerRect.top + currentOffset;
      const scrollTarget = Math.max(0, relativeTop - stickyOffset);
      scrollContainer.scrollTo({ top: scrollTarget, behavior: scrollBehavior });
      return;
    }

    const targetPosition = target.getBoundingClientRect().top + window.scrollY;
    const scrollTarget = Math.max(0, targetPosition - stickyOffset);

    window.scrollTo({ top: scrollTarget, behavior: scrollBehavior });
  };

  const handleSelect = (item: StickySectionNavItem) => {
    setActiveId(item.id);

    if (item.onSelect) {
      item.onSelect();
      return;
    }

    scrollToTarget(item.id);
  };

  if (items.length === 0) {
    return null;
  }

  const containerClasses = disableSticky
    ? "border-b border-border/20 bg-background/70 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50"
    : "sticky z-30 -mx-2 mb-6 border-b border-border/20 bg-background/70 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50";

  const containerStyle = disableSticky ? undefined : { top: stickyTopOffset };

  return (
    <div
      ref={navRef}
      className={cn(containerClasses, className)}
      style={containerStyle}
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
              onClick={() => handleSelect(item)}
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

export default StickySectionNav;
