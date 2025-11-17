import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface InfoSection {
  title: string;
  description: string;
}

interface EmptyStateInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  sections: InfoSection[];
}

export function EmptyStateInfoSheet({
  open,
  onOpenChange,
  title,
  description,
  sections
}: EmptyStateInfoSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="w-full sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
              <p className="text-base font-semibold text-foreground">{section.title}</p>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default EmptyStateInfoSheet;
