import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { leadSchema, sanitizeInput, sanitizeHtml } from "@/lib/validation";
import { ZodError } from "zod";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Edit } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
}

interface EditLeadDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated: () => void;
}

export function EditLeadDialog({ lead, open, onOpenChange, onLeadUpdated }: EditLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const { settings: userSettings } = useUserSettings();
  
  const [formData, setFormData] = useState({
    name: lead.name,
    email: lead.email || "",
    phone: lead.phone || "",
    notes: lead.notes || "",
    status: lead.status,
  });

  useEffect(() => {
    if (open) {
      fetchLeadStatuses();
      setFormData({
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        notes: lead.notes || "",
        status: lead.status,
      });
    }
  }, [open, lead]);

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
      const leadData = {
        name: sanitizeInput(formData.name),
        email: formData.email ? sanitizeInput(formData.email) : null,
        phone: formData.phone ? sanitizeInput(formData.phone) : null,
        notes: formData.notes ? await sanitizeHtml(formData.notes) : null,
        status: formData.status,
      };

      const { error } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Lead updated successfully",
        description: `${formData.name} has been updated`
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isDirty = Boolean(
    formData.name !== lead.name ||
    formData.email !== (lead.email || "") ||
    formData.phone !== (lead.phone || "") ||
    formData.notes !== (lead.notes || "") ||
    formData.status !== lead.status
  );

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
      label: loading ? "Updating..." : "Update Lead",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Edit Lead"
      isOpen={open}
      onOpenChange={onOpenChange}
      size="default"
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Client's full name"
            maxLength={100}
            required
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="client@example.com"
            maxLength={254}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="(555) 123-4567"
            maxLength={20}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
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
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Any additional notes about this lead..."
            maxLength={1000}
            rows={3}
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
        </div>
      </div>
    </AppSheetModal>
  );
}