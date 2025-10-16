import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import SettingsSection from "@/components/SettingsSection";
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
      <SettingsSection
        title={t("lead_fields.title")}
        description={t("lead_fields.description")}
      >
        <FormLoadingSkeleton rows={3} />
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection
        title={t("lead_fields.title")}
        description={t("lead_fields.description")}
        action={{
          label: t("lead_fields.add_field"),
          onClick: () => setIsDialogOpen(true),
          icon: <Plus className="h-4 w-4" />,
        }}
      >
        <LeadFieldsList
          fields={fieldDefinitions}
          onEdit={handleEdit}
          onDelete={deleteFieldDefinition}
          onReorder={reorderFieldDefinitions}
        />
      </SettingsSection>

      <LeadFieldDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        field={editingField}
        onClose={handleCloseDialog}
      />
    </>
  );
}
