import { Badge } from '@/components/ui/badge';

interface FieldMultiSelectDisplayProps {
  value: string;
}

export function FieldMultiSelectDisplay({ value }: FieldMultiSelectDisplayProps) {
  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  
  if (values.length === 0) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((val, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {val}
        </Badge>
      ))}
    </div>
  );
}