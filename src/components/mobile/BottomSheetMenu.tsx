import { ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

interface BottomSheetMenuProps {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  customContent?: React.ReactNode;
}

export function BottomSheetMenu({
  title,
  isOpen,
  onOpenChange,
  items,
  customContent
}: BottomSheetMenuProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="max-h-[85vh] rounded-t-xl border-t"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 pb-6 px-2">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 py-4 rounded-xl transition-colors",
                  "hover:bg-muted/50 active:bg-muted",
                  item.variant === 'destructive' 
                    ? "text-destructive hover:bg-destructive/10" 
                    : "text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.title}</span>
              </button>
            );
          })}
        </div>
        
        {customContent && customContent}
      </SheetContent>
    </Sheet>
  );
}