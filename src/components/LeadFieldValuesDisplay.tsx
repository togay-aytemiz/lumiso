import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { useLeadFieldValues } from "@/hooks/useLeadFieldValues";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomFieldDisplay } from "@/components/fields/CustomFieldDisplay";
import { useTranslation } from "react-i18next";

interface LeadFieldValuesDisplayProps {
  leadId: string;
  className?: string;
}

export function LeadFieldValuesDisplay({ leadId, className }: LeadFieldValuesDisplayProps) {
  const { fieldDefinitions, loading: fieldsLoading } = useLeadFieldDefinitions();
  const { fieldValues, loading: valuesLoading } = useLeadFieldValues(leadId);
  const { t } = useTranslation("forms");

  const loading = fieldsLoading || valuesLoading;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t("customFields.title")}</CardTitle>
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
          <CardTitle>{t("customFields.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("customFields.empty")}
          </p>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("customFields.title")}</CardTitle>
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
                      {t("customFields.badges.required")}
                    </Badge>
                  )}
                  {field.is_system && (
                    <Badge variant="secondary" className="text-xs">
                      {t("customFields.badges.system")}
                    </Badge>
                  )}
                </div>
                <div className="text-sm">
                  <CustomFieldDisplay 
                    fieldDefinition={field}
                    value={fieldValue?.value || null}
                    showCopyButtons={true}
                    allowTruncation={true}
                    maxLines={3}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}