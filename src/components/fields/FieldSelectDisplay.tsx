import { Badge } from "@/components/ui/badge";

interface FieldSelectDisplayProps {
  value: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

export function FieldSelectDisplay({ 
  value, 
  variant = "outline" 
}: FieldSelectDisplayProps) {
  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  return (
    <Badge variant={variant} className="text-xs">
      {value}
    </Badge>
  );
}