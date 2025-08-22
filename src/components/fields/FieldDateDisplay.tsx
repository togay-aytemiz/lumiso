import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface FieldDateDisplayProps {
  value: string;
  formatString?: string;
}

export function FieldDateDisplay({ 
  value, 
  formatString = "PPP" 
}: FieldDateDisplayProps) {
  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  const formatDate = (dateValue: string) => {
    try {
      return format(new Date(dateValue), formatString);
    } catch {
      return dateValue;
    }
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span>{formatDate(value)}</span>
    </div>
  );
}