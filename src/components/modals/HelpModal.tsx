import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, FileText, MessageCircle } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ isOpen, onOpenChange }: HelpModalProps) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Help & Support
          </DialogTitle>
          <DialogDescription>
            Need assistance? Choose from the options below to get help.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {helpItems.map((item) => (
            <Button
              key={item.title}
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => {
                item.action();
                onOpenChange(false);
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <item.icon className="h-5 w-5 text-primary" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          ))}
        </div>
        
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}