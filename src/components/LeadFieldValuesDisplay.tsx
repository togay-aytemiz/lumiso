import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface LeadFieldValuesDisplayProps {
  leadId: string;
  className?: string;
}

export function LeadFieldValuesDisplay({ leadId, className }: LeadFieldValuesDisplayProps) {
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { fieldValues, loading: valuesLoading } = useLeadFieldValues(leadId);

  const loading = fieldsLoading || valuesLoading;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter to show only fields that have values or are visible
  const fieldsWithValues = fieldDefinitions
    .filter(field => {
      const hasValue = fieldValues.some(fv => fv.field_key === field.field_key && fv.value);
      return hasValue || field.is_visible_in_form;
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  if (fieldsWithValues.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No custom field data available for this lead.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderFieldValue = (fieldDef: any, value: string | null) => {
    if (!value) {
      return <span className="text-muted-foreground italic">Not provided</span>;
    }

    switch (fieldDef.field_type) {
      case 'email':
        return (
          <a 
            href={`mailto:${value}`} 
            className="text-blue-600 hover:underline"
          >
            {value}
          </a>
        );
      
      case 'phone':
        return (
          <a 
            href={`tel:${value}`} 
            className="text-blue-600 hover:underline"
          >
            {value}
          </a>
        );
      
      case 'date':
        try {
          return format(new Date(value), 'PPP');
        } catch {
          return value;
        }
      
      case 'checkbox':
        return (
          <Badge variant={value === 'true' ? 'default' : 'secondary'}>
            {value === 'true' ? 'Yes' : 'No'}
          </Badge>
        );
      
      case 'select':
        return <Badge variant="outline">{value}</Badge>;
      
      case 'textarea':
        return (
          <div className="whitespace-pre-wrap text-sm bg-muted/50 p-2 rounded">
            {value}
          </div>
        );
      
      default:
        return <span>{value}</span>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Custom Fields</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fieldsWithValues.map(field => {
            const fieldValue = fieldValues.find(fv => fv.field_key === field.field_key);
            
            return (
              <div key={field.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">
                    {field.label}
                  </label>
                  {field.is_required && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {field.is_system && (
                    <Badge variant="secondary" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>
                <div className="text-sm">
                  {renderFieldValue(field, fieldValue?.value || null)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}