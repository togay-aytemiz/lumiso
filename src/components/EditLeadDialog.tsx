import { useState, useEffect } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
        title: "Validation error",
        description: "Name is required.",
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
        title: "Success",
        description: "Lead updated successfully."
      });

      onOpenChange(false);
      onLeadUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating lead",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData);

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => onOpenChange(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Saving..." : "Save",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="EDIT LEAD"
      isOpen={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Name *"
          className="h-12 text-base placeholder:text-muted-foreground/70 placeholder:font-medium"
        />

        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="Email"
          className="h-12 text-base placeholder:text-muted-foreground/70 placeholder:font-medium"
        />

        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          placeholder="Phone"
          className="h-12 text-base placeholder:text-muted-foreground/70 placeholder:font-medium"
        />

        <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Status" />
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

        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Notes"
          rows={3}
          className="text-base placeholder:text-muted-foreground/70 placeholder:font-medium resize-none"
        />
      </div>
    </AppSheetModal>
  );
}