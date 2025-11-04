import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { SettingsHelpContent } from "@/lib/settingsHelpContent";
import { useTranslation } from "react-i18next";

interface SettingsHelpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  helpContent: SettingsHelpContent;
}

export default function SettingsHelpSheet({ open, onOpenChange, helpContent }: SettingsHelpSheetProps) {
  const { t } = useTranslation("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-lg">
        <SheetHeader className="items-start text-left">
          <SheetTitle>{helpContent.title}</SheetTitle>
          <SheetDescription>{helpContent.description}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-220px)] pr-4">
          <div className="space-y-6">
            {helpContent.sections.map((section) => (
              <div key={section.title} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline" className="ml-auto">
              {t("buttons.close")}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
