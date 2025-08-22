import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, FileText, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface HelpModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ isOpen, onOpenChange }: HelpModalProps) {
  const isMobile = useIsMobile();
  const helpItems = [
    {
      title: "Documentation",
      description: "Browse our comprehensive guides and tutorials",
      icon: FileText,
      action: () => {
        // Placeholder - replace with actual documentation URL
        window.open("https://docs.lumiso.com", "_blank");
      }
    },
    {
      title: "Contact Support",
      description: "Get help from our support team",
      icon: Mail,
      action: () => {
        // Placeholder - replace with actual support email
        window.location.href = "mailto:support@lumiso.com";
      }
    },
    {
      title: "Live Chat",
      description: "Chat with our support team in real-time",
      icon: MessageCircle,
      action: () => {
        // Placeholder - replace with actual chat widget
        console.log("Opening live chat...");
      }
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? "w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-w-none max-h-none m-4" : "sm:max-w-md"}>
        <DialogHeader className={isMobile ? "px-2" : ""}>
          <DialogTitle className="flex items-center gap-2">
            Help & Support
          </DialogTitle>
          <DialogDescription>
            Need assistance? Choose from the options below to get help.
          </DialogDescription>
        </DialogHeader>
        
        <div className={`space-y-3 py-4 ${isMobile ? "px-2 flex-1" : ""}`}>
          {helpItems.map((item) => (
            <Button
              key={item.title}
              variant="outline"
              className={`w-full justify-start h-auto p-4 ${isMobile ? "min-h-[60px]" : ""}`}
              onClick={() => {
                item.action();
                onOpenChange(false);
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <item.icon className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Button>
          ))}
        </div>
        
        <div className={`flex justify-end ${isMobile ? "px-2 pb-2" : ""}`}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}