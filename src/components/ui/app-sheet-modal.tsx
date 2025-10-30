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
  size?: 'content' | 'default' | 'lg' | 'wide' | 'xl';
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

  const handleOutsideInteraction = () => {
    if (dirty && onDirtyClose) {
      onDirtyClose();
    } else {
      onOpenChange(false);
    }
  };

  const sideVariant = isMobile ? 'bottom' : 'right';
  
  const sheetContentClass = cn(
    "flex flex-col overflow-visible",
    !isMobile && "sm:max-w-6xl w-full",
    isMobile && "max-h-[85vh] rounded-t-xl",
    size === 'content' && !isMobile && "sm:max-w-md",
    size === 'lg' && !isMobile && "sm:max-w-2xl",
    size === 'wide' && !isMobile && "sm:max-w-4xl"
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent 
        side={sideVariant} 
        className={cn(sheetContentClass, "[&>button]:hidden")}
        onPointerDownOutside={handleOutsideInteraction}
        onInteractOutside={handleOutsideInteraction}
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
