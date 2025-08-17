import { useState, useEffect } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronDown, Check, X, Save } from "lucide-react";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProjectTypeSelector } from "./ProjectTypeSelector";
import { AssigneesPicker } from "./AssigneesPicker";
import { InlineAssigneesPicker } from "./InlineAssigneesPicker";
import { useProfile } from "@/contexts/ProfileContext";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

interface EnhancedProjectDialogProps {
  onProjectCreated?: () => void;
  children?: React.ReactNode;
  defaultStatusId?: string | null;
}

export function EnhancedProjectDialog({ onProjectCreated, children, defaultStatusId }: EnhancedProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const { toast } = useToast();

  const [projectData, setProjectData] = useState({
    name: "",
    description: "",
    projectTypeId: "",
    basePrice: "",
    assignees: [] as string[]
  });
  const { profile } = useProfile();

  const [newLeadData, setNewLeadData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: ""
  });

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open]);

  // Auto-add current user as first assignee
  useEffect(() => {
    if (profile?.user_id && projectData.assignees.length === 0) {
      setProjectData(prev => ({
        ...prev,
        assignees: [profile.user_id]
      }));
    }
  }, [profile?.user_id, projectData.assignees.length]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: leadsData, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, status')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setLeads(leadsData || []);
    } catch (error: any) {
      toast({
        title: "Error fetching leads",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingLeads(false);
    }
  };

  const resetForm = () => {
    setProjectData({ 
      name: "", 
      description: "", 
      projectTypeId: "", 
      basePrice: "",
      assignees: profile?.user_id ? [profile.user_id] : []
    });
    setNewLeadData({ name: "", email: "", phone: "", notes: "" });
    setSelectedLeadId("");
    setSearchTerm("");
    setIsNewLead(false);
  };

  const handleSubmit = async () => {

    if (!projectData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Project name is required.",
        variant: "destructive"
      });
      return;
    }

    if (!isNewLead && !selectedLeadId) {
      toast({
        title: "Validation error",
        description: "Please select a lead or create a new one.",
        variant: "destructive"
      });
      return;
    }

    if (isNewLead && !newLeadData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Lead name is required when creating a new lead.",
        variant: "destructive"
      });
      return;
    }

    if (!projectData.projectTypeId) {
      toast({
        title: "Validation error",
        description: "Please select a project type.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let leadId = selectedLeadId;

      // Create new lead if needed
      if (isNewLead) {
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            user_id: user.id,
            name: newLeadData.name.trim(),
            email: newLeadData.email.trim() || null,
            phone: newLeadData.phone.trim() || null,
            notes: newLeadData.notes.trim() || null,
            status: 'new'
          })
          .select('id')
          .single();

        if (leadError) throw leadError;
        leadId = newLead.id;
      }

      // Use provided status or get default project status
      let statusId = defaultStatusId;
      if (!statusId) {
        const { data: defaultStatus } = await supabase
          .rpc('get_default_project_status', { user_uuid: user.id });
        statusId = defaultStatus;
      }

      // Create project
      const basePrice = parseFloat(projectData.basePrice) || 0;
      
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          name: projectData.name.trim(),
          description: projectData.description.trim() || null,
          status_id: statusId,
          project_type_id: projectData.projectTypeId,
          base_price: basePrice,
          assignees: projectData.assignees.length > 0 ? projectData.assignees : [user.id]
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Create base price payment if base price > 0
      if (basePrice > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            project_id: newProject.id,
            user_id: user.id,
            amount: basePrice,
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
      setOpen(false);
      
      if (onProjectCreated) {
        onProjectCreated();
      }
    } catch (error: any) {
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectDataChange = (field: keyof typeof projectData, value: string | string[]) => {
    setProjectData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewLeadDataChange = (field: keyof typeof newLeadData, value: string) => {
    setNewLeadData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Filter leads based on search term
  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    const styles = getLeadStatusStyles(status);
    return (
      <Badge className={`text-xs ${styles.className}`}>
        {formatStatusText(status)}
      </Badge>
    );
  };

  const isDirty = Boolean(
    projectData.name.trim() ||
    projectData.description.trim() ||
    projectData.basePrice.trim() ||
    projectData.assignees.length > 1 || // More than just the default creator
    (isNewLead && (newLeadData.name.trim() || newLeadData.email.trim() || newLeadData.phone.trim() || newLeadData.notes.trim())) ||
    (!isNewLead && selectedLeadId)
  );

  const handleDirtyClose = () => {
    if (window.confirm("Discard changes?")) {
      resetForm();
      setOpen(false);
    }
  };

  const footerActions = [
    {
      label: "Cancel",
      onClick: () => {
        resetForm();
        setOpen(false);
      },
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Creating..." : "Create Project",
      onClick: handleSubmit,
      disabled: loading || !projectData.name.trim() || (!isNewLead && !selectedLeadId) || (isNewLead && !newLeadData.name.trim()) || !projectData.projectTypeId,
      loading: loading
    }
  ];

  return (
    <>
      {children ? (
        <div onClick={() => setOpen(true)}>
          {children}
        </div>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      )}

      <AppSheetModal
        title="Create New Project"
        isOpen={open}
        onOpenChange={setOpen}
        size="lg"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="grid gap-4">
          {/* Lead Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="existing-lead"
                name="lead-type"
                checked={!isNewLead}
                onChange={() => setIsNewLead(false)}
                className="h-4 w-4"
              />
              <Label htmlFor="existing-lead">Select existing client</Label>
            </div>
            
            {!isNewLead && (
              <div className="space-y-2">
                <Label htmlFor="lead-search">Select client</Label>
                <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={dropdownOpen}
                      className="w-full justify-between text-left h-auto min-h-[40px]"
                      disabled={loadingLeads}
                    >
                      {selectedLeadId ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col">
                            <span className="font-medium">{leads.find(lead => lead.id === selectedLeadId)?.name}</span>
                            {leads.find(lead => lead.id === selectedLeadId)?.email && (
                              <span className="text-xs text-muted-foreground">{leads.find(lead => lead.id === selectedLeadId)?.email}</span>
                            )}
                          </div>
                          {leads.find(lead => lead.id === selectedLeadId) && 
                            getStatusBadge(leads.find(lead => lead.id === selectedLeadId)?.status || '')
                          }
                        </div>
                      ) : loadingLeads ? (
                        "Loading clients..."
                      ) : (
                        "Search and select a client..."
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
                    <div className="p-3 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search by name or email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <div className="py-1">
                        {loadingLeads ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Loading clients...
                          </div>
                        ) : filteredLeads.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            {searchTerm ? 'No clients match your search' : 'No clients found'}
                          </div>
                        ) : (
                          filteredLeads.map((lead) => (
                            <div
                              key={lead.id}
                              onClick={() => {
                                setSelectedLeadId(lead.id);
                                setDropdownOpen(false);
                                setSearchTerm("");
                              }}
                              className={cn(
                                "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0",
                                selectedLeadId === lead.id && "bg-muted"
                              )}
                            >
                              <div className="flex items-center space-x-3">
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    selectedLeadId === lead.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{lead.name}</span>
                                  {lead.email && (
                                    <span className="text-xs text-muted-foreground">{lead.email}</span>
                                  )}
                                </div>
                              </div>
                              {getStatusBadge(lead.status)}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="new-lead"
                name="lead-type"
                checked={isNewLead}
                onChange={() => setIsNewLead(true)}
                className="h-4 w-4"
              />
              <Label htmlFor="new-lead">Create new client</Label>
            </div>

            {isNewLead && (
              <div className="space-y-3 pl-6 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="new-name">Name *</Label>
                  <Input
                    id="new-name"
                    value={newLeadData.name}
                    onChange={(e) => handleNewLeadDataChange("name", e.target.value)}
                    placeholder="Enter client name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newLeadData.email}
                    onChange={(e) => handleNewLeadDataChange("email", e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-phone">Phone</Label>
                  <Input
                    id="new-phone"
                    value={newLeadData.phone}
                    onChange={(e) => handleNewLeadDataChange("phone", e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-notes">Notes</Label>
                  <Textarea
                    id="new-notes"
                    value={newLeadData.notes}
                    onChange={(e) => handleNewLeadDataChange("notes", e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Project Details */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={projectData.name}
                onChange={(e) => handleProjectDataChange("name", e.target.value)}
                placeholder="Enter project name"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-type">Project Type *</Label>
              <ProjectTypeSelector
                value={projectData.projectTypeId}
                onValueChange={(value) => handleProjectDataChange("projectTypeId", value)}
                disabled={loading}
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
                value={projectData.basePrice}
                onChange={(e) => handleProjectDataChange("basePrice", e.target.value)}
                placeholder="0"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={projectData.description}
                onChange={(e) => handleProjectDataChange("description", e.target.value)}
                placeholder="Enter project description (optional)"
                rows={3}
                disabled={loading}
                className="resize-none"
              />
            </div>

            <div className="pt-4 border-t">
              <InlineAssigneesPicker
                value={projectData.assignees}
                onChange={(assignees) => handleProjectDataChange("assignees", assignees)}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </AppSheetModal>
    </>
  );
}