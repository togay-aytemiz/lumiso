import { useState, useEffect } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./settings/NavigationGuardDialog";
import { useTranslation } from "react-i18next";

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

export function EditLeadDialog({ lead, open, onOpenChange, onLeadUpdated }: EditLeadDialogProps) {
  const { t } = useTranslation(['forms', 'common']);
  const [loading, setLoading] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    status: ""
  });

  const [initialFormData, setInitialFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    status: ""
  });

  useEffect(() => {
    if (lead && open) {
      const newFormData = {
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        notes: lead.notes || "",
        status: lead.status || ""
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
      fetchLeadStatuses();
    }
  }, [lead, open]);

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeadStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching lead statuses:', error);
    }
  };

  const handleSubmit = async () => {
    if (!lead || !formData.name.trim()) {
      toast({
        title: t('forms:messages.validationError'),
        description: t('forms:messages.nameRequired'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Find the status ID for the selected status
      const selectedStatus = leadStatuses.find(s => s.name === formData.status);
      
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

      toast({
        title: t('forms:messages.success'),
        description: t('forms:messages.leadUpdateSuccess')
      });

      onOpenChange(false);
      onLeadUpdated();
    } catch (error: any) {
      toast({
        title: t('forms:messages.errorUpdatingLead'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      onOpenChange(false);
    },
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
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
      label: loading ? t('common:actions.saving') : t('common:buttons.save'),
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <>
      <AppSheetModal
        title={t('forms:dialogs.edit_lead')}
        isOpen={open}
        onOpenChange={onOpenChange}
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('forms:labels.name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('forms:placeholders.name')}
              className="rounded-xl border-2 border-primary/20 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('forms:labels.email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder={t('forms:placeholders.email')}
              className="rounded-xl border-2 border-primary/20 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('forms:labels.phone')}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder={t('forms:placeholders.phone')}
              className="rounded-xl border-2 border-primary/20 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('forms:labels.status')}</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="rounded-xl border-2 border-primary/20 focus:border-primary">
                <SelectValue placeholder={t('forms:placeholders.status')} />
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
            <Label htmlFor="notes">{t('forms:labels.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('forms:placeholders.notes')}
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