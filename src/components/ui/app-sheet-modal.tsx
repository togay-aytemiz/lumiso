import { ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
  size?: 'content' | 'default' | 'lg';
  footerActions?: FooterAction[];
  dirty?: boolean;
  onDirtyClose?: () => void;
}

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

  const handleOpenChange = (open: boolean) => {
    if (!open && dirty && onDirtyClose) {
      onDirtyClose();
      return;
    }
    onOpenChange(open);
  };

  const sideVariant = isMobile ? 'bottom' : 'right';
  
  const sheetContentClass = cn(
    "flex flex-col",
    // Desktop: Right side sheet, full height
    !isMobile && "sm:max-w-xl w-full",
    // Mobile: Bottom sheet with rounded top corners, content height
    isMobile && "max-h-[85vh] rounded-t-xl",
    // Size variants
    size === 'content' && !isMobile && "sm:max-w-md",
    size === 'lg' && !isMobile && "sm:max-w-2xl"
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent 
        side={sideVariant} 
        className={cn(sheetContentClass, "[&>button]:hidden")}
        onPointerDownOutside={(e) => {
          if (dirty && onDirtyClose) {
            e.preventDefault();
            onDirtyClose();
          }
        }}
      >
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pb-6 px-1">
          <div className="space-y-4">
            {children}
          </div>
        </div>

        {footerActions.length > 0 && (
          <SheetFooter className="border-t pt-4 gap-2 px-1">
            {footerActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (index === footerActions.length - 1 ? 'default' : 'outline')}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className={cn(
                  "flex-1",
                  action.loading && "cursor-not-allowed"
                )}
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