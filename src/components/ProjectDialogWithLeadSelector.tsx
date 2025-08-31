import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompactLoadingSkeleton } from "@/components/ui/loading-presets";
import { Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProjectTypeSelector } from "./ProjectTypeSelector";

interface Lead {
  id: string;
  name: string;
  status: string;
  email?: string;
}

interface ProjectDialogWithLeadSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

export function ProjectDialogWithLeadSelector({ 
  open, 
  onOpenChange, 
  onProjectCreated 
}: ProjectDialogWithLeadSelectorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, status, email')
        .order('name', { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading leads",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingLeads(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedLeadId("");
    setProjectTypeId("");
    setBasePrice("");
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedLeadId) {
      toast({
        title: "Validation Error",
        description: "Please select a lead for this project.",
        variant: "destructive"
      });
      return;
    }

    if (!projectTypeId) {
      toast({
        title: "Validation Error",
        description: "Please select a project type.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create a project.",
          variant: "destructive"
        });
        return;
      }

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        toast({
          title: "Organization required",
          description: "Please ensure you're part of an organization",
          variant: "destructive"
        });
        return;
      }

      // Get default project status
      const { data: defaultStatusId } = await supabase
        .rpc('get_default_project_status', { user_uuid: userData.user.id });

      const basePriceValue = parseFloat(basePrice) || 0;

      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          lead_id: selectedLeadId,
          user_id: userData.user.id,
          organization_id: userSettings.active_organization_id,
          status_id: defaultStatusId,
          project_type_id: projectTypeId,
          base_price: basePriceValue
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Create base price payment if base price > 0
      if (basePriceValue > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            project_id: newProject.id,
            user_id: userData.user.id,
            organization_id: userSettings.active_organization_id,
            amount: basePriceValue,
            description: 'Base Price',
            status: 'due',
            type: 'base_price'
          });

        if (paymentError) throw paymentError;
      }

      toast({
        title: "Success",
        description: "Project created successfully."
      });

      resetForm();
      onOpenChange(false);
      onProjectCreated();
    } catch (error: any) {
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getLeadDisplayText = (lead: Lead) => {
    return `${lead.name}${lead.email ? ` (${lead.email})` : ''} - ${lead.status}`;
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (!newOpen && !isSaving) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
        </DialogHeader>
        
          <div className="-mx-2">
            <ScrollArea className="max-h-[60vh]">
              <div className="px-2 space-y-4 pt-2 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="lead-select">Select Lead *</Label>
                  {loadingLeads ? (
                    <CompactLoadingSkeleton />
                  ) : (
                    <Select value={selectedLeadId} onValueChange={setSelectedLeadId} disabled={isSaving}>
                      <SelectTrigger id="lead-select">
                        <SelectValue placeholder="Choose a lead for this project" />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {getLeadDisplayText(lead)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter project name"
                    disabled={isSaving}
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project-type">Project Type *</Label>
                  <ProjectTypeSelector
                    value={projectTypeId}
                    onValueChange={setProjectTypeId}
                    disabled={isSaving}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="base-price">Base Price (TRY)</Label>
                  <Input
                    id="base-price"
                    type="number"
                    step="1"
                    min="0"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="0"
                    disabled={isSaving}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter project description (optional)"
                    rows={4}
                    disabled={isSaving}
                    className="resize-none"
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !selectedLeadId || !projectTypeId}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}