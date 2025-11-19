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
  size?: 'content' | 'default' | 'lg' | 'wide' | 'xl';
  footerActions?: FooterAction[];
  dirty?: boolean;
  onDirtyClose?: () => void;
}

const RECENT_OPEN_GUARD_MS = 200;

const getDismissableEventTarget = (
  event: PointerDownOutsideEvent | FocusOutsideEvent,
): HTMLElement | null => {
  const originalEvent = event.detail?.originalEvent as Event | undefined;
  if (!originalEvent) return null;

  if ('target' in originalEvent && originalEvent.target instanceof HTMLElement) {
    return originalEvent.target;
  }

  if ('relatedTarget' in originalEvent && originalEvent.relatedTarget instanceof HTMLElement) {
    return originalEvent.relatedTarget;
  }

  if (typeof originalEvent.composedPath === 'function') {
    const [first] = originalEvent.composedPath();
    if (first instanceof HTMLElement) {
      return first;
    }
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
  onDirtyClose
}: AppSheetModalProps) {
  const isMobile = useIsMobile();
  const lastOpenedRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      lastOpenedRef.current = Date.now();
    }
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
    lg: "sm:max-w-5xl",
    xl: "sm:max-w-6xl",
    wide: "sm:max-w-[90vw]",
  };

  const sheetContentClass = cn(
    "flex flex-col overflow-visible w-full",
    !isMobile && sizeClassMap[size],
    isMobile && "max-h-[85vh] rounded-t-xl"
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent 
        side={sideVariant} 
        className={cn(sheetContentClass, "[&>button]:hidden")}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
      >
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCloseClick} 
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pb-6 my-0 py-0 px-[4px] overflow-visible" style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'manipulation'
        }}>
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
