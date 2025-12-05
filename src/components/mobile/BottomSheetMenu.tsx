import { ReactNode } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  testId?: string;
}

interface BottomSheetMenuProps {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  leadingContent?: React.ReactNode;
  customContent?: React.ReactNode;
}

export function BottomSheetMenu({
  title,
  isOpen,
  onOpenChange,
  items,
  leadingContent,
  customContent
}: BottomSheetMenuProps) {
  const { t } = useTranslation("navigation");

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] rounded-t-xl border-t"
      >
        <SheetHeader className="pb-3 px-1">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-left text-lg font-semibold">{title}</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 focus:outline-none px-2 py-1"
            >
              {t("close", { defaultValue: "Kapat" })}
            </button>
          </div>
        </SheetHeader>

        {leadingContent && (
          <div className="px-2 pb-4">{leadingContent}</div>
        )}

        <div className={cn("space-y-2 px-2", customContent ? "pb-3" : "pb-6")}>
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  onOpenChange(false);
                }}
                data-walkthrough={item.testId}
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
