import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { useIsMobile } from "@/hooks/use-mobile";

interface SettingsHelpContent {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

interface SettingsHelpButtonProps {
  helpContent: SettingsHelpContent;
}

export function SettingsHelpButton({ helpContent }: SettingsHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleDocumentation = () => {
    window.open('https://docs.lovable.dev/', '_blank');
    setIsOpen(false);
  };

  const handleEmailSupport = () => {
    window.open('mailto:support@lovable.dev?subject=Settings Help Request', '_blank');
    setIsOpen(false);
  };

  const footerActions = [
    {
      label: "Documentation",
      onClick: handleDocumentation,
      variant: "outline" as const
    },
    {
      label: "Email Support",
      onClick: handleEmailSupport,
      variant: "outline" as const
    }
  ];

  return (
    <>
      <Button
        variant="outline"
        size={isMobile ? "icon" : "sm"}
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 hover:bg-accent hover:text-accent-foreground"
      >
        <HelpCircle className="h-4 w-4" />
        {!isMobile && <span>Need Help?</span>}
      </Button>

      <AppSheetModal
        title={helpContent.title}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        size="lg"
        footerActions={footerActions}
      >
        <div className="space-y-6">
          <div className="text-muted-foreground">
            {helpContent.description}
          </div>

          {helpContent.sections.map((section, index) => (
            <div key={index} className="space-y-3">
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <div className="text-muted-foreground leading-relaxed">
                {section.content}
              </div>
            </div>
          ))}

          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Need More Help?</p>
                <p className="text-muted-foreground">
                  Our team is here to help you get the most out of your settings. We're continuously adding new features and improvements to make your experience better.
                </p>
              </div>
            </div>
          </div>
        </div>
      </AppSheetModal>
    </>
  );
}