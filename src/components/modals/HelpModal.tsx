import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileQuestion, Mail, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { HelpOptionCard } from "@/components/support/HelpOptionCard";
import { FeatureFAQSheet } from "@/components/support/FeatureFAQSheet";
import { cn } from "@/lib/utils";

interface HelpModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ isOpen, onOpenChange }: HelpModalProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation("navigation");
  const [isFaqSheetOpen, setFaqSheetOpen] = useState(false);

  const helpItems = [
    {
      key: "faq",
      icon: FileQuestion,
      action: () => setFaqSheetOpen(true),
    },
    {
      key: "email",
      icon: Mail,
      action: () => window.open("mailto:support@lumiso.com", "_self"),
    },
    {
      key: "whatsapp",
      icon: MessageCircle,
      action: () => window.open("https://wa.me/905074699692", "_blank"),
    },
  ] as const;

  const handleOptionSelect = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  const renderHelpOptions = (cardClassName?: string) => (
    <div className="space-y-3">
      {helpItems.map(({ key, icon, action }) => (
        <HelpOptionCard
          key={key}
          icon={icon}
          title={t(`help.options.${key}.title`)}
          description={t(`help.options.${key}.description`)}
          onSelect={() => handleOptionSelect(action)}
          className={cardClassName}
        />
      ))}
    </div>
  );

  const closeButton = (
    <Button
      variant="surface"
      onClick={() => onOpenChange(false)}
      className={cn("btn-surface-accent", isMobile ? "w-full" : undefined)}
    >
      {t("help.close")}
    </Button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "sm:max-w-lg p-6",
            isMobile &&
              "w-full max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl p-5"
          )}
          hideClose={isMobile}
        >
          <DialogHeader className={isMobile ? "space-y-1 text-center" : undefined}>
            <DialogTitle>{t("help.title")}</DialogTitle>
            <DialogDescription>{t("help.description")}</DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "space-y-3 py-4",
              isMobile && "max-h-[60vh] overflow-y-auto pr-1"
            )}
          >
            {renderHelpOptions(isMobile ? "min-h-[72px]" : undefined)}
          </div>

          <div className={cn("flex", isMobile ? "flex-col gap-2 pt-1" : "justify-end")}>
            {closeButton}
          </div>
        </DialogContent>
      </Dialog>

      <FeatureFAQSheet open={isFaqSheetOpen} onOpenChange={setFaqSheetOpen} />
    </>
  );
}
