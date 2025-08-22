import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

interface FieldCheckboxDisplayProps {
  value: string;
}

export function FieldCheckboxDisplay({ value }: FieldCheckboxDisplayProps) {
  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  const isTrue = value === 'true' || value === '1' || value.toLowerCase() === 'yes';

  return (
    <Badge 
      variant={isTrue ? "default" : "secondary"} 
      className="text-xs flex items-center gap-1"
    >
      {isTrue ? (
        <>
          <Check className="h-3 w-3" />
          Yes
        </>
      ) : (
        <>
          <X className="h-3 w-3" />
          No
        </>
      )}
    </Badge>
  );
}