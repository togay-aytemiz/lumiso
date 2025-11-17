import { AppSheetModal } from "@/components/ui/app-sheet-modal";

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
    <AppSheetModal title={title} isOpen={open} onOpenChange={onOpenChange} size="content">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
            <p className="text-base font-semibold text-foreground">{section.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
          </div>
        ))}
      </div>
    </AppSheetModal>
  );
}

export default EmptyStateInfoSheet;
