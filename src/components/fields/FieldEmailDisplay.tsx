import { Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface FieldEmailDisplayProps {
  value: string;
  showCopyButton?: boolean;
}

export function FieldEmailDisplay({ 
  value, 
  showCopyButton = true 
}: FieldEmailDisplayProps) {
  const { toast } = useToast();

  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied",
        description: "Email address copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy email address",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <a 
              href={`mailto:${value}`} 
              className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors flex items-center gap-1 min-w-0"
            >
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{value}</span>
            </a>
          </TooltipTrigger>
          <TooltipContent>
            Send email to {value}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {showCopyButton && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={copyToClipboard}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Copy email address
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}