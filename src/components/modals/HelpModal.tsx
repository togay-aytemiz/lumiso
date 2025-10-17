import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Mail, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { HelpOptionCard } from "@/components/support/HelpOptionCard";
import { cn } from "@/lib/utils";

interface HelpModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ isOpen, onOpenChange }: HelpModalProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation("navigation");

  const helpItems = [
    {
      key: "documentation",
      icon: FileText,
      action: () => window.open("https://docs.lumiso.com", "_blank"),
    },
    {
      key: "support",
      icon: Mail,
      action: () => {
        window.location.href = "mailto:support@lumiso.com";
      },
    },
    {
      key: "chat",
      icon: MessageCircle,
      action: () => {
        console.log("Opening live chat...");
      },
    },
  ] as const;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg p-6",
          isMobile && "w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-w-none max-h-none m-4"
        )}
      >
        <DialogHeader className={isMobile ? "px-2" : ""}>
          <DialogTitle>{t("help.title")}</DialogTitle>
          <DialogDescription>{t("help.description")}</DialogDescription>
        </DialogHeader>

        <div className={cn("space-y-3 py-4", isMobile ? "px-2 flex-1" : "")}>
          {helpItems.map(({ key, icon, action }) => (
            <HelpOptionCard
              key={key}
              icon={icon}
              title={t(`help.options.${key}.title`)}
              description={t(`help.options.${key}.description`)}
              onSelect={() => {
                action();
                onOpenChange(false);
              }}
              className={isMobile ? "min-h-[72px]" : ""}
            />
          ))}
        </div>

        <div className={cn("flex justify-end", isMobile ? "px-2 pb-2" : "")}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("help.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
