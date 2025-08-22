import { useState, useEffect } from "react";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ChevronDown, Check, X, Save } from "lucide-react";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProjectTypeSelector } from "./ProjectTypeSelector";
import { AssigneesPicker } from "./AssigneesPicker";
import { InlineAssigneesPicker } from "./InlineAssigneesPicker";
import { ServicePicker } from "./ServicePicker";
import { useProfile } from "@/contexts/ProfileContext";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: string;
  applicable_types: string[];
  default_add_ons: string[];
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  category: string | null;
  cost_price?: number;
  selling_price?: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  project_type_id?: string | null;
  assignees?: string[];
}

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectUpdated?: () => void;
  children?: React.ReactNode;
}

export function EditProjectDialog({ 
  project, 
  open, 
  onOpenChange, 
  onProjectUpdated, 
  children 
}: EditProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const { toast } = useToast();

  const [projectData, setProjectData] = useState({
    name: "",
    description: "",
    projectTypeId: "",
    basePrice: "",
    packageId: "",
    assignees: [] as string[],
    selectedServices: [] as Service[],
    selectedServiceIds: [] as string[]
  });
  const { profile } = useProfile();

  const [leadName, setLeadName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [projectTypeDropdownOpen, setProjectTypeDropdownOpen] = useState(false);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [projectTypes, setProjectTypes] = useState<{id: string, name: string, is_default?: boolean}[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showServicesEditor, setShowServicesEditor] = useState(false);
  const [showCustomSetup, setShowCustomSetup] = useState(false);

  // Pre-fill form data when project changes
  useEffect(() => {
    if (project && open) {
      setProjectData({
        name: project.name || "",
        description: project.description || "",
        projectTypeId: project.project_type_id || "",
        basePrice: "",
        packageId: "",
        assignees: project.assignees || [],
        selectedServices: [],
        selectedServiceIds: []
      });
      fetchLeadName(project.lead_id);
      fetchProjectServices(project.id);
    }
  }, [project, open]);

  useEffect(() => {
    if (open) {
      fetchLeads();
      fetchPackagesAndTypes();
    }
  }, [open]);

  // Auto-select current user as assignee if not already assigned
  useEffect(() => {
    if (open && project && profile?.user_id && !project.assignees?.includes(profile.user_id)) {
      setProjectData(prev => ({
        ...prev,
        assignees: [...(project.assignees || []), profile.user_id]
      }));
    }
  }, [open, project, profile?.user_id]);

  // Close dropdowns when modal closes
  useEffect(() => {
    if (!open) {
      setDropdownOpen(false);
      setProjectTypeDropdownOpen(false);
      setPackageDropdownOpen(false);
      setShowServicesEditor(false);
      setShowCustomSetup(false);
    }
  }, [open]);

  const fetchLeadName = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('name')
        .eq('id', leadId)
        .single();

      if (error) throw error;
      setLeadName(data.name);
    } catch (error: any) {
      console.error('Error fetching lead name:', error);
    }
  };

  const fetchProjectServices = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_services')
        .select(`
          service_id,
          services (
            id,
            name,
            category,
            cost_price,
            selling_price
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;

      const services = data?.map(ps => ps.services).filter(Boolean) as Service[];
      const serviceIds = services.map(s => s.id);

      setProjectData(prev => ({
        ...prev,
        selectedServices: services,
        selectedServiceIds: serviceIds
      }));
    } catch (error: any) {
      console.error('Error fetching project services:', error);
    }
  };

  const fetchLeads = async () => {
    if (loadingLeads) return;
    
    setLoadingLeads(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, status')
        .eq('organization_id', userSettings.active_organization_id)
        .neq('status', 'lost')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeads(data || []);
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

  const fetchPackagesAndTypes = async () => {
    if (loadingPackages) return;
    
    setLoadingPackages(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      const organizationId = userSettings.active_organization_id;

      const [packagesResult, typesResult, servicesResult] = await Promise.all([
        supabase
          .from('packages')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('project_types')
          .select('*')
          .eq('organization_id', organizationId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('services')
          .select('id, name, category, cost_price, selling_price')
          .eq('organization_id', organizationId)
          .order('category', { ascending: true })
          .order('name', { ascending: true })
      ]);

      if (packagesResult.error) throw packagesResult.error;
      if (typesResult.error) throw typesResult.error;
      if (servicesResult.error) throw servicesResult.error;

      setPackages(packagesResult.data || []);
      setProjectTypes(typesResult.data || []);
      setAllServices(servicesResult.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSubmit = async () => {
    if (!project) return;

    if (!projectData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Project name is required.",
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

      // Update project
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          name: projectData.name.trim(),
          description: projectData.description.trim() || null,
          project_type_id: projectData.projectTypeId,
          assignees: projectData.assignees.length > 0 ? projectData.assignees : [user.id]
        })
        .eq('id', project.id);

      if (projectError) throw projectError;

      // Update project services - remove all and re-add selected ones
      if (projectData.selectedServiceIds.length !== projectData.selectedServices.length) {
        // First, remove all existing services
        const { error: deleteServicesError } = await supabase
          .from('project_services')
          .delete()
          .eq('project_id', project.id);

        if (deleteServicesError) throw deleteServicesError;

        // Then add selected services
        if (projectData.selectedServiceIds.length > 0) {
          const serviceInserts = projectData.selectedServiceIds.map(serviceId => ({
            project_id: project.id,
            service_id: serviceId,
            user_id: user.id
          }));

          const { error: servicesError } = await supabase
            .from('project_services')
            .insert(serviceInserts);

          if (servicesError) throw servicesError;
        }
      }

      toast({
        title: "Success",
        description: "Project updated successfully."
      });

      onOpenChange(false);
      
      if (onProjectUpdated) {
        onProjectUpdated();
      }
    } catch (error: any) {
      toast({
        title: "Error updating project",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectDataChange = (field: string, value: any) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
  };

  const handlePackageSelection = (packageId: string) => {
    const selectedPackage = packages.find(p => p.id === packageId);
    if (selectedPackage) {
      setProjectData(prev => ({
        ...prev,
        packageId: packageId,
        basePrice: selectedPackage.price.toString(),
        selectedServices: [],
        selectedServiceIds: selectedPackage.default_add_ons || []
      }));
      
      // Load default services for this package
      const defaultServices = allServices.filter(service => 
        selectedPackage.default_add_ons?.includes(service.id)
      );
      setProjectData(prev => ({
        ...prev,
        selectedServices: defaultServices
      }));
    }
  };

  // Filter leads based on search term
  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (lead.phone && lead.phone.includes(searchTerm))
  );

  // Filter packages based on selected project type
  const filteredPackages = packages.filter(pkg => 
    !projectData.projectTypeId || 
    pkg.applicable_types.length === 0 || 
    pkg.applicable_types.includes(projectData.projectTypeId)
  );

  // Calculate total estimated cost
  const estimatedCost = (parseFloat(projectData.basePrice) || 0) + 
    projectData.selectedServices.reduce((sum, service) => sum + (service.selling_price || 0), 0);

  const isDirty = project && (
    projectData.name !== (project.name || "") ||
    projectData.description !== (project.description || "") ||
    projectData.projectTypeId !== (project.project_type_id || "") ||
    projectData.assignees.length !== (project.assignees || []).length ||
    !projectData.assignees.every(id => project.assignees?.includes(id))
  );

  const handleDirtyClose = () => {
    if (isDirty) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirmClose) return;
    }
    onOpenChange(false);
  };

  if (!project) return null;

  // Footer actions
  const footerActions = [
    {
      label: "Cancel",
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? "Updating..." : "Update Project",
      onClick: handleSubmit,
      disabled: loading || !projectData.name.trim() || !projectData.projectTypeId,
      loading: loading
    }
  ];

  return (
    <AppSheetModal
      title="Edit Project"
      isOpen={open}
      onOpenChange={handleDirtyClose}
      dirty={isDirty}
      onDirtyClose={isDirty ? handleDirtyClose : undefined}
      footerActions={footerActions}
    >
      <div className="space-y-4">
        {/* Lead Information (Read-only) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Client</Label>
          <div className="p-3 bg-muted/20 rounded-lg border">
            <div className="font-medium">{leadName}</div>
            <div className="text-sm text-muted-foreground">Cannot be changed when editing</div>
          </div>
        </div>

        {/* Project Details */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={projectData.name}
              onChange={(e) => handleProjectDataChange("name", e.target.value)}
              placeholder="Enter project name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-type">Project Type</Label>
            <ProjectTypeSelector
              value={projectData.projectTypeId}
              onValueChange={(value) => handleProjectDataChange("projectTypeId", value)}
              disabled={loading}
              required
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

          {/* Services Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Services & Add-ons {projectData.selectedServiceIds.length > 0 && `(${projectData.selectedServiceIds.length})`}</Label>
              {projectData.selectedServiceIds.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleProjectDataChange("selectedServices", []);
                      handleProjectDataChange("selectedServiceIds", []);
                    }}
                    className="h-auto py-1 px-3 text-xs"
                  >
                    Clear All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowServicesEditor(!showServicesEditor)}
                    className="h-auto py-1 px-2 text-xs"
                  >
                    {showServicesEditor ? "Done" : "Edit Services"}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Show selected services as chips */}
            {projectData.selectedServiceIds.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted/20 rounded-lg border">
                {projectData.selectedServices.map((service) => (
                  <div
                    key={service.id}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-background border rounded-lg"
                  >
                    <span className="font-medium">{service.name}</span>
                    <span className="text-muted-foreground">
                      TRY {(service.cost_price || 0).toLocaleString()}/TRY {(service.selling_price || 0).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedServices = projectData.selectedServices.filter(s => s.id !== service.id);
                        const updatedServiceIds = projectData.selectedServiceIds.filter(id => id !== service.id);
                        handleProjectDataChange("selectedServices", updatedServices);
                        handleProjectDataChange("selectedServiceIds", updatedServiceIds);
                      }}
                      className="hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Services button when no services selected */}
            {projectData.selectedServiceIds.length === 0 && !showServicesEditor && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowServicesEditor(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Services
              </Button>
            )}

            {/* Services editor */}
            {showServicesEditor && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {projectData.selectedServiceIds.length === 0 ? "Select services to add:" : "Add or remove services:"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowServicesEditor(false)}
                    className="h-auto py-1 px-2 text-xs"
                  >
                    Done
                  </Button>
                </div>
                
                <ServicePicker
                  services={allServices}
                  value={projectData.selectedServiceIds}
                  onChange={(selectedServiceIds) => {
                    const selectedServices = allServices.filter(service => 
                      selectedServiceIds.includes(service.id)
                    );
                    handleProjectDataChange("selectedServices", selectedServices);
                    handleProjectDataChange("selectedServiceIds", selectedServiceIds);
                  }}
                />
              </div>
            )}
          </div>

          {/* Assignees */}
          <div className="space-y-2">
            <Label>Assignees</Label>
            <InlineAssigneesPicker
              value={projectData.assignees}
              onChange={(assignees) => handleProjectDataChange("assignees", assignees)}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </AppSheetModal>
  );
}