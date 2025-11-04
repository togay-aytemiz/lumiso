import { useState, useEffect, useCallback } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18nToast } from "@/lib/toastHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { useTranslation } from "react-i18next";
import type { Database } from "@/integrations/supabase/types";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
  status_id?: string;
}

interface EditLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated: () => void;
}

type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];

type LeadFormState = {
  name: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
};

const createEmptyFormState = (): LeadFormState => ({
  name: "",
  email: "",
  phone: "",
  notes: "",
  status: "",
});

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
};

export function EditLeadDialog({ lead, open, onOpenChange, onLeadUpdated }: EditLeadDialogProps) {
  const { t } = useTranslation(['forms', 'common']);
  const toast = useI18nToast();
  const [loading, setLoading] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusRow[]>([]);
  const [formData, setFormData] = useState<LeadFormState>(() => createEmptyFormState());
  const [initialFormData, setInitialFormData] = useState<LeadFormState>(() => createEmptyFormState());

  const fetchLeadStatuses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<LeadStatusRow>('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeadStatuses(data ?? []);
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
    }
  }, []);

  useEffect(() => {
    if (lead && open) {
      const newFormData: LeadFormState = {
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        notes: lead.notes || "",
        status: lead.status || ""
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
      void fetchLeadStatuses();
    }

    if (!open) {
      setLeadStatuses([]);
      setFormData(createEmptyFormState());
      setInitialFormData(createEmptyFormState());
    }
  }, [fetchLeadStatuses, lead, open]);

  const handleSubmit = async () => {
    if (!lead || !formData.name.trim()) {
      toast.error(t('forms:messages.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      // Find the status ID for the selected status
      const selectedStatus = leadStatuses.find(status => status.name === formData.status);
      
      const { error } = await supabase
        .from('leads')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          notes: formData.notes.trim() || null,
          status: formData.status,
          status_id: selectedStatus?.id || null
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success(t('forms:messages.leadUpdateSuccess'));

      onOpenChange(false);
      onLeadUpdated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const isDirty = lead ? JSON.stringify(formData) !== JSON.stringify(initialFormData) : false;

  const handleDiscard = useCallback(() => {
    if (lead) {
      setFormData(initialFormData);
    } else {
      setFormData(createEmptyFormState());
    }
    onOpenChange(false);
  }, [initialFormData, lead, onOpenChange]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: handleDiscard,
  });

  if (!lead) {
    return null;
  }

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t('common:buttons.cancel'),
      onClick: () => handleDirtyClose(),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? t('common:actions.saving') : t('common:buttons.save'),
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <>
      <AppSheetModal
        title={t('leadDialog.edit_lead')}
        isOpen={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleDirtyClose();
          } else {
            onOpenChange(true);
          }
        }}
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('labels.name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('placeholders.name')}
              className="rounded-xl border-2 border-primary/20 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('labels.email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder={t('placeholders.email')}
              className="rounded-xl border-2 border-primary/20 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('labels.phone')}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder={t('placeholders.phone')}
              className="rounded-xl border-2 border-primary/20 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('labels.status')}</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="rounded-xl border-2 border-primary/20 focus:border-primary">
                <SelectValue placeholder={t('placeholders.status')} />
              </SelectTrigger>
              <SelectContent>
                {leadStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      {status.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('labels.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('placeholders.notes')}
              rows={4}
              className="rounded-xl border-2 border-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>
      </AppSheetModal>
      
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        message={navigation.message}
      />
    </>
  );
}
