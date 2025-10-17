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
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useToast } from "@/hooks/use-toast";
import { ProjectTypeSelector } from "./ProjectTypeSelector";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";

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
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();

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
        title: tCommon('labels.error'),
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
        title: tCommon('labels.error'),
        description: tForms('project_validation.name_required'),
        variant: "destructive"
      });
      return;
    }

    if (!selectedLeadId) {
      toast({
        title: tCommon('labels.error'),
        description: tForms('project_validation.lead_required'),
        variant: "destructive"
      });
      return;
    }

    if (!projectTypeId) {
      toast({
        title: tCommon('labels.error'),
        description: tForms('project_validation.type_required'),
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: tCommon('labels.error'),
          description: tCommon('messages.error.auth_required'),
          variant: "destructive"
        });
        return;
      }

      // Get user's active organization
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        toast({
          title: tCommon('labels.error'),
          description: tCommon('messages.error.organization_required'),
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
          organization_id: organizationId,
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
            organization_id: organizationId,
            amount: basePriceValue,
            description: tForms('payments.base_price'),
            status: 'due',
            type: 'base_price'
          });

        if (paymentError) throw paymentError;
      }

      toast({
        title: tCommon('actions.success'),
        description: tCommon('messages.success.project_created')
      });

      resetForm();
      onOpenChange(false);
      onProjectCreated();
    } catch (error: any) {
      toast({
        title: tCommon('labels.error'),
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
          <DialogTitle>{tForms('projectDialog.title')}</DialogTitle>
        </DialogHeader>
        
          <div className="-mx-2">
            <ScrollArea className="max-h-[60vh]">
              <div className="px-2 space-y-4 pt-2 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="lead-select">{tForms('projectDialog.selectClient')}</Label>
                  {loadingLeads ? (
                    <CompactLoadingSkeleton />
                  ) : (
                    <Select value={selectedLeadId} onValueChange={setSelectedLeadId} disabled={isSaving}>
                      <SelectTrigger id="lead-select">
                        <SelectValue placeholder={tForms('placeholders.select_client_placeholder')} />
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
                  <Label htmlFor="project-name">{tForms('projectDialog.projectName')}</Label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={tForms('placeholders.enterProjectName')}
                    disabled={isSaving}
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project-type">{tForms('projectDialog.projectType')}</Label>
                  <ProjectTypeSelector
                    value={projectTypeId}
                    onValueChange={setProjectTypeId}
                    disabled={isSaving}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="base-price">{tForms('projectDialog.basePrice')}</Label>
                  <Input
                    id="base-price"
                    type="number"
                    step="1"
                    min="0"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder={tForms('placeholders.basePrice')}
                    disabled={isSaving}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="project-description">{tForms('projectDialog.description')}</Label>
                  <Textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={tForms('placeholders.enterProjectDescription')}
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
            {tForms('buttons.cancel')}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !selectedLeadId || !projectTypeId}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? tForms('buttons.creating') : tForms('buttons.createProject')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
