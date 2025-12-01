import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type DismissableLayerEvent<T extends Event> = CustomEvent<{
  originalEvent: T;
}>;

type PointerDownOutsideEvent = DismissableLayerEvent<PointerEvent>;
type FocusOutsideEvent = DismissableLayerEvent<FocusEvent>;

interface FooterAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}

interface AppSheetModalProps {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  size?: 'content' | 'default' | 'md' | 'lg' | 'wide' | 'xl';
  footerActions?: FooterAction[];
  dirty?: boolean;
  onDirtyClose?: () => void;
  headerAccessory?: ReactNode;
  mobileHeightClass?: string;
  mobileMinHeightClass?: string;
  bodyRef?: (node: HTMLDivElement | null) => void;
}

const RECENT_OPEN_GUARD_MS = 200;

const getDismissableEventTarget = (
  event: PointerDownOutsideEvent | FocusOutsideEvent,
): Element | null => {
  const originalEvent = event.detail?.originalEvent as Event | undefined;
  if (!originalEvent) return null;

  const getElement = (value: EventTarget | null | undefined): Element | null =>
    value instanceof Element ? value : null;

  const target = 'target' in originalEvent ? getElement(originalEvent.target) : null;
  if (target) return target;

  const relatedTarget =
    'relatedTarget' in originalEvent
      ? getElement((originalEvent as FocusEvent).relatedTarget)
      : null;
  if (relatedTarget) return relatedTarget;

  if (typeof originalEvent.composedPath === 'function') {
    const pathTarget = originalEvent
      .composedPath()
      .find((node): node is Element => node instanceof Element);
    if (pathTarget) return pathTarget;
  }

  return null;
};

export function AppSheetModal({
  title,
  isOpen,
  onOpenChange,
  children,
  size = 'default',
  footerActions = [],
  dirty = false,
  onDirtyClose,
  headerAccessory,
  mobileHeightClass = "max-h-[85vh]",
  mobileMinHeightClass,
  bodyRef,
}: AppSheetModalProps) {
  const isMobile = useIsMobile();
  const lastOpenedRef = useRef(0);
  const hasHeaderAccessory = Boolean(headerAccessory);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const handleBodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      if (bodyRef) {
        bodyRef(node);
      }
    },
    [bodyRef],
  );

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      const node = scrollContainerRef.current;
      if (!node) return;
      node.scrollTop = 0;
      node.scrollLeft = 0;
      window.requestAnimationFrame(() => {
        node.scrollTop = 0;
        node.scrollLeft = 0;
      });
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      lastOpenedRef.current = Date.now();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const forceTop = () => {
      const node = scrollContainerRef.current;
      if (node) {
        node.scrollTop = 0;
        node.scrollLeft = 0;
      }
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    const raf = window.requestAnimationFrame(forceTop);
    const t1 = window.setTimeout(forceTop, 60);
    const t2 = window.setTimeout(forceTop, 140);
    const t3 = window.setTimeout(forceTop, 280);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && dirty && onDirtyClose) {
      onDirtyClose();
      return;
    }
    onOpenChange(open);
  }, [dirty, onDirtyClose, onOpenChange]);

  const handleOutsideInteraction = useCallback(
    (event: PointerDownOutsideEvent | FocusOutsideEvent) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        event.preventDefault();
        return;
      }

      const target = getDismissableEventTarget(event);
      if (target?.closest("[data-toast-root],[data-radix-toast-viewport],[data-sonner-toast],[data-sonner-toaster]")) {
        event.preventDefault();
        if ("stopPropagation" in event) {
          event.stopPropagation();
        }
        const original = event.detail?.originalEvent as Event | undefined;
        if (original && "stopPropagation" in original) {
          original.stopPropagation();
        }
        return;
      }
      if (target?.closest('[role="dialog"],[role="alertdialog"]')) {
        event.preventDefault();
        return;
      }

      const justOpened = Date.now() - lastOpenedRef.current < RECENT_OPEN_GUARD_MS;
      if (justOpened) {
        event.preventDefault();
        return;
      }

      if (dirty && onDirtyClose) {
        event.preventDefault();
        onDirtyClose();
      } else {
        onOpenChange(false);
      }
    },
    [dirty, onDirtyClose, onOpenChange],
  );

  const handlePointerDownOutside = useCallback(
    (event: PointerDownOutsideEvent) => {
      handleOutsideInteraction(event);
    },
    [handleOutsideInteraction],
  );

  const handleInteractOutside = useCallback(
    (event: PointerDownOutsideEvent | FocusOutsideEvent) => {
      handleOutsideInteraction(event);
    },
    [handleOutsideInteraction],
  );

  const handleCloseClick = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const sideVariant = isMobile ? 'bottom' : 'right';

  const sizeClassMap: Record<NonNullable<AppSheetModalProps["size"]>, string> = {
    content: "sm:max-w-md",
    default: "sm:max-w-4xl",
    md: "sm:max-w-3xl",
    lg: "sm:max-w-5xl",
    xl: "sm:max-w-6xl",
    wide: "sm:max-w-[90vw]",
  };

  const sheetContentClass = cn(
    "flex min-h-0 flex-col overflow-hidden w-full",
    !isMobile && sizeClassMap[size],
    isMobile && cn(mobileHeightClass, mobileMinHeightClass, "rounded-t-xl")
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent 
        side={sideVariant} 
        className={cn(sheetContentClass, "[&>button]:hidden")}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <SheetHeader className={cn("border-b", hasHeaderAccessory ? "pb-4" : "pb-3")}>
          <div
            className={cn(
              hasHeaderAccessory
                ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                : "flex items-center justify-between"
            )}
          >
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
            {hasHeaderAccessory ? (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                  <div className="flex-1 sm:flex-none">{headerAccessory}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseClick}
                    className="h-8 w-8 p-0 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseClick}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        <div
          className={cn(
            "flex-1 overflow-y-auto pb-6 my-0 py-0",
            isMobile && "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          ref={handleBodyRef}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'manipulation'
          }}
        >
          <div className="space-y-4 overflow-visible [&_input]:border [&_input]:border-border [&_input]:bg-muted/50 [&_textarea]:border [&_textarea]:border-border [&_textarea]:bg-muted/50 [&_[role=combobox]]:border [&_[role=combobox]]:border-border [&_[role=combobox]]:bg-muted/50">
            {children}
          </div>
        </div>

        {footerActions.length > 0 && (
          <SheetFooter className="border-t pt-4 gap-2 px-1 sticky bottom-0 bg-background z-10">
            {footerActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (index === footerActions.length - 1 ? 'default' : 'outline')}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className={cn("flex-1", action.loading && "cursor-not-allowed")}
              >
                {action.loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {action.label}
                  </div>
                ) : (
                  action.label
                )}
              </Button>
            ))}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
