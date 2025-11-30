import { Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface FieldEmailDisplayProps {
  value: string;
  showCopyButton?: boolean;
}

export function FieldEmailDisplay({ 
  value, 
  showCopyButton = true 
}: FieldEmailDisplayProps) {
  const { toast } = useToast();
  const { t } = useTranslation("common");

  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: t("copy.copied"),
        description: t("copy.emailCopied"),
      });
    } catch (err) {
      toast({
        title: t("copy.failed"),
        description: t("copy.emailError"),
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
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{value}</span>
            </a>
          </TooltipTrigger>
          <TooltipContent>
            {t("tooltips.sendEmailTo", { value })}
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
                data-touch-target="compact"
                onClick={(e) => { e.stopPropagation(); void copyToClipboard(); }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("copy.emailTooltip")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
