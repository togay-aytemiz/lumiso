import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import SettingsSection from "@/components/SettingsSection";
import { LeadFieldsList } from "./LeadFieldsList";
import { LeadFieldDialog } from "./LeadFieldDialog";
import { useLeadFieldDefinitions } from "@/hooks/useLeadFieldDefinitions";
import { LeadFieldDefinition } from "@/types/leadFields";

export function LeadFieldsSection() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<LeadFieldDefinition | null>(null);
  const { fieldDefinitions, loading, refetch } = useLeadFieldDefinitions();

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
        title="Custom Lead Fields"
        description="Configure custom fields for your leads"
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection
        title="Custom Lead Fields"
        description="Configure custom fields to capture additional lead information"
        action={{
          label: "Add Field",
          onClick: () => setIsDialogOpen(true),
          icon: <Plus className="h-4 w-4" />
        }}
      >
        <LeadFieldsList 
          fields={fieldDefinitions}
          onEdit={handleEdit}
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