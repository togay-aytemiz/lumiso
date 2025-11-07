import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SettingsCollectionSection,
} from "@/components/settings/SettingsSectionVariants";
import { FormLoadingSkeleton } from "@/components/ui/loading-presets";
import { LeadFieldsList } from "./LeadFieldsList";
import { LeadFieldDialog } from "./LeadFieldDialog";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { LeadFieldDefinition } from "@/types/leadFields";
import { useTranslation } from "react-i18next";

export function LeadFieldsSection() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<LeadFieldDefinition | null>(
    null
  );
  const {
    fieldDefinitions,
    loading,
    refetch,
    deleteFieldDefinition,
    reorderFieldDefinitions,
  } = useLeadFieldDefinitions();
  const { t } = useTranslation("forms");

  const handleEdit = (field: LeadFieldDefinition) => {
    setEditingField(field);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingField(null);
    // Refresh the data to show any changes made in the dialog
    refetch();
  };

  if (loading) {
    return (
      <SettingsCollectionSection
        sectionId="lead-fields"
        title={t("lead_fields.title")}
        description={t("lead_fields.description")}
        bodyClassName="p-6"
      >
        <FormLoadingSkeleton rows={3} />
      </SettingsCollectionSection>
    );
  }

  return (
    <>
      <SettingsCollectionSection
        sectionId="lead-fields"
        title={t("lead_fields.title")}
        description={t("lead_fields.description")}
        headerAside={
          <Button
            type="button"
            size="sm"
            variant="pill"
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("lead_fields.add_field")}
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="p-6">
          <LeadFieldsList
            fields={fieldDefinitions}
            onEdit={handleEdit}
            onDelete={deleteFieldDefinition}
            onReorder={reorderFieldDefinitions}
          />
        </div>
      </SettingsCollectionSection>

      <LeadFieldDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        field={editingField}
        onClose={handleCloseDialog}
      />
    </>
  );
}
