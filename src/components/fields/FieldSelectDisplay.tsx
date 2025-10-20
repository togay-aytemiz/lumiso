import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface FieldSelectDisplayProps {
  value: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

export function FieldSelectDisplay({ 
  value, 
  variant = "outline" 
}: FieldSelectDisplayProps) {
  const { t } = useTranslation("common");
  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  return (
    <Badge variant={variant} className="text-xs">
      {value}
    </Badge>
  );
}
