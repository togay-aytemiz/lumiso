import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { leadSchema, sanitizeInput, sanitizeHtml } from "@/lib/validation";
import { ZodError } from "zod";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import { AssigneesPicker } from "./AssigneesPicker";
import { InlineAssigneesPicker } from "./InlineAssigneesPicker";
import { useProfile } from "@/contexts/ProfileContext";
import { usePermissions } from "@/hooks/usePermissions";

interface AddLeadDialogProps {
  onLeadAdded: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddLeadDialog = ({ onLeadAdded, open, onOpenChange }: AddLeadDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const { settings: userSettings } = useOrganizationQuickSettings();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    status: "",
    assignees: [] as string[],
  });
  const { profile } = useProfile();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    fetchLeadStatuses();
  }, []);

  // Auto-add current user as first assignee
  useEffect(() => {
    if (profile?.user_id && formData.assignees.length === 0) {
      setFormData(prev => ({
        ...prev,
        assignees: [profile.user_id]
      }));
    }
  }, [profile?.user_id, formData.assignees.length]);

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeadStatuses(data || []);
      
      // Set default status to the first status (typically "New")
      if (data && data.length > 0 && !formData.status) {
        setFormData(prev => ({ ...prev, status: data[0].name }));
      }
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add leads",
          variant: "destructive"
        });
        return;
      }

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');

      if (!organizationId) {
        toast({
          title: "Organization required",
          description: "Please ensure you're part of an organization",
          variant: "destructive"
        });
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
        assignees: formData.assignees.length > 0 ? formData.assignees : [user.id],
      };

      const { error } = await supabase
        .from('leads')
        .insert([leadData]);

      if (error) throw error;

      toast({
        title: "Lead added successfully",
        description: `${formData.name} has been added to your leads`
      });

      // Reset form and close dialog
      const defaultStatus = leadStatuses.length > 0 ? leadStatuses[0].name : "";
      setFormData({
        name: "",
        email: "",
        phone: "",
        notes: "",
        status: defaultStatus,
        assignees: profile?.user_id ? [profile.user_id] : [],
      });
      setErrors({});
      onOpenChange(false);
      onLeadAdded();
    } catch (error: any) {
      toast({
        title: "Error adding lead",
        description: error.message,
        variant: "destructive"
      });
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

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      const defaultStatus = leadStatuses.length > 0 ? leadStatuses[0].name : "";
      setFormData({
        name: "",
        email: "",
        phone: "",
        notes: "",
        status: defaultStatus,
        assignees: profile?.user_id ? [profile.user_id] : [],
      });
      setErrors({});
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
      label: loading ? "Adding..." : "Add Lead",
      onClick: handleSubmit,
      disabled: loading || !formData.name.trim(),
      loading: loading
    }
  ];

  return (
    <>
      <AppSheetModal
        title="Add New Lead"
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
          
          <div className="pt-4 border-t">
            <InlineAssigneesPicker
              value={formData.assignees}
              onChange={(assignees) => handleInputChange("assignees", assignees)}
              disabled={loading}
            />
          </div>
        </div>
      </AppSheetModal>
    </>
  );
};

export default AddLeadDialog;