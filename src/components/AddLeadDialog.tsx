import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { Plus } from "lucide-react";
import { leadSchema, sanitizeInput, sanitizeHtml } from "@/lib/validation";
import { ZodError } from "zod";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
// Assignee components removed - single user organization
import { useProfile } from "@/contexts/ProfileContext";
// Permissions removed for single photographer mode
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { useTranslation } from "react-i18next";
import type { Database } from "@/integrations/supabase/types";

interface AddLeadDialogProps {
  onLeadAdded: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

const AddLeadDialog = ({ onLeadAdded, open, onOpenChange }: AddLeadDialogProps) => {
  const { t } = useTranslation(['forms', 'common']);
  const toast = useI18nToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusRow[]>([]);
  const { settings: userSettings } = useOrganizationQuickSettings();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    status: "",
    // Assignees removed - single user organization
  });
  const { profile } = useProfile();
  // Permissions removed for single photographer mode - always allow

  const fetchLeadStatuses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<LeadStatusRow>('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      const statuses = data ?? [];
      setLeadStatuses(statuses);
      
      // Set default status to the first status (typically "New")
      if (statuses.length > 0) {
        setFormData(prev =>
          prev.status ? prev : { ...prev, status: statuses[0].name }
        );
      }
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
    }
  }, []);

  useEffect(() => {
    void fetchLeadStatuses();
  }, [fetchLeadStatuses]);

  // Auto-assignment removed - single user organization

  const validateForm = async () => {
    setErrors({});
    
    try {
      await leadSchema.parseAsync({
        name: sanitizeInput(formData.name),
        email: formData.email ? sanitizeInput(formData.email) : undefined,
        phone: formData.phone ? sanitizeInput(formData.phone) : undefined,
        notes: formData.notes ? await sanitizeHtml(formData.notes) : undefined
      });
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          const field = err.path[0] as string;
          newErrors[field] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!(await validateForm())) return;
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error(t('forms:messages.pleaseSignInToAdd'));
        return;
      }

      // Get user's active organization ID
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;
      if (!organizationId) {
        toast.error(t('forms:messages.ensurePartOfOrg'));
        return;
      }

      const leadData = {
        user_id: user.id,
        organization_id: organizationId,
        name: sanitizeInput(formData.name),
        email: formData.email ? sanitizeInput(formData.email) : null,
        phone: formData.phone ? sanitizeInput(formData.phone) : null,
        notes: formData.notes ? await sanitizeHtml(formData.notes) : null,
        status: formData.status,
        // assignees removed - single user organization
      };

      const { error } = await supabase
        .from('leads')
        .insert([leadData]);

      if (error) throw error;

      toast.success(t('forms:messages.leadAddedDesc', { name: formData.name }));

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
      onLeadAdded();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isDirty = Boolean(
    formData.name.trim() || 
    formData.email.trim() || 
    formData.phone.trim() || 
    formData.notes.trim()
  );

  const resetForm = () => {
    const defaultStatus = leadStatuses.length > 0 ? leadStatuses[0].name : "";
    setFormData({
      name: "",
      email: "",
      phone: "",
      notes: "",
      status: defaultStatus,
      // assignees field removed - single user organization
    });
    setErrors({});
  };

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      resetForm();
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      resetForm();
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('common:buttons.cancel'),
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('forms:buttons.adding') : t('forms:buttons.add_lead'),
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <>
      <AppSheetModal
        title={t('forms:dialogs.add_new_lead')}
        isOpen={open}
        onOpenChange={onOpenChange}
        size="default"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('forms:labels.name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder={t('forms:placeholders.name')}
              maxLength={100}
              required
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">{t('forms:labels.email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder={t('forms:placeholders.email')}
              maxLength={254}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">{t('forms:labels.phone')}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder={t('forms:placeholders.phone')}
              maxLength={20}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">{t('forms:labels.status')}</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('forms:placeholders.status')} />
              </SelectTrigger>
              <SelectContent>
                {leadStatuses
                  .filter(status => userSettings.show_quick_status_buttons || !status.is_system_final)
                  .map((status) => (
                  <SelectItem key={status.id} value={status.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <span>{status.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">{t('forms:labels.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder={t('forms:placeholders.notes')}
              maxLength={1000}
              rows={3}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
          </div>
          
          {/* Assignees section removed - single user organization */}
        </div>
      </AppSheetModal>
      
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={t('forms:messages.unsavedLeadChanges')}
      />
    </>
  );
}

export default AddLeadDialog;
