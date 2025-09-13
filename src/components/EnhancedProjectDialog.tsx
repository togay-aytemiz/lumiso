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
// Assignee components removed - single user organization
import { ServicePicker } from "./ServicePicker";
import { useProfile } from "@/contexts/ProfileContext";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";

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

interface EnhancedProjectDialogProps {
  defaultLeadId?: string;
  onProjectCreated?: () => void;
  children?: React.ReactNode;
  defaultStatusId?: string | null;
}

export function EnhancedProjectDialog({ defaultLeadId, onProjectCreated, children, defaultStatusId }: EnhancedProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const { toast } = useToast();
  const { currentStep, shouldLockNavigation, completeCurrentStep } = useOnboardingV2();
  const { triggerNewAssignment } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();

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

  const [newLeadData, setNewLeadData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: ""
  });

  const [selectedLeadId, setSelectedLeadId] = useState("");
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

  useEffect(() => {
    if (open) {
      fetchLeads();
      fetchPackagesAndTypes();
    }
  }, [open]);

  // Auto-select lead if defaultLeadId is provided
  useEffect(() => {
    if (defaultLeadId && open) {
      setSelectedLeadId(defaultLeadId);
      setIsNewLead(false);
    }
  }, [defaultLeadId, open]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (dropdownOpen && !target.closest('[data-dropdown-container]')) {
        setDropdownOpen(false);
      }
      if (projectTypeDropdownOpen && !target.closest('[data-projecttype-dropdown]')) {
        setProjectTypeDropdownOpen(false);
      }
      if (packageDropdownOpen && !target.closest('[data-package-dropdown]')) {
        setPackageDropdownOpen(false);
      }
    };

    if (dropdownOpen || projectTypeDropdownOpen || packageDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen, projectTypeDropdownOpen, packageDropdownOpen]);

  // Reset services editor when modal closes
  useEffect(() => {
    if (!open) {
      setShowServicesEditor(false);
      setShowCustomSetup(false);
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

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data: leadsData, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, updated_at')
        .eq('organization_id', organizationId)
        .neq('status', 'lost')
        .order('updated_at', { ascending: false });

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

  const fetchPackagesAndTypes = async () => {
    setLoadingPackages(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const [packagesResult, typesResult, servicesResult] = await Promise.all([
        supabase
          .from('packages')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('project_types')
          .select('id, name, is_default')
          .eq('organization_id', organizationId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('services')
          .select('*')
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

      // Auto-select default project type
      const defaultType = typesResult.data?.find(type => type.is_default);
      if (defaultType && !projectData.projectTypeId) {
        setProjectData(prev => ({
          ...prev,
          projectTypeId: defaultType.id
        }));
      }
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

  const resetForm = () => {
    const defaultType = projectTypes.find(type => type.is_default);
    setProjectData({ 
      name: "", 
      description: "", 
      projectTypeId: defaultType?.id || "",
      basePrice: "",
      packageId: "",
      selectedServices: [],
      selectedServiceIds: [],
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

      // Get user's active organization
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userSettings?.active_organization_id) {
        throw new Error("Organization required");
      }

      let leadId = selectedLeadId;

      // Create new lead if needed
      if (isNewLead) {
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            user_id: user.id,
            organization_id: userSettings.active_organization_id,
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
          organization_id: userSettings.active_organization_id,
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
            organization_id: userSettings.active_organization_id,
            amount: basePrice,
            description: 'Base Price',
            status: 'due',
            type: 'base_price'
          });

        if (paymentError) throw paymentError;
      }

      // Add selected services to project
      if (projectData.selectedServiceIds.length > 0) {
        const serviceInserts = projectData.selectedServiceIds.map(serviceId => ({
          project_id: newProject.id,
          service_id: serviceId,
          user_id: user.id
        }));

        const { error: servicesError } = await supabase
          .from('project_services')
          .insert(serviceInserts);

        if (servicesError) throw servicesError;
      }

      // Send notifications for assigned users
      if (activeOrganization?.id && projectData.assignees.length > 0) {
        console.log('🔔 Sending assignment notifications for project:', newProject.id);
        try {
          await triggerNewAssignment('project', newProject.id, projectData.assignees, activeOrganization.id);
          console.log('✅ Assignment notifications sent successfully');
        } catch (notificationError) {
          console.error('❌ Failed to send assignment notifications:', notificationError);
          // Don't fail the project creation if notifications fail
        }
      }

      toast({
        title: "Success",
        description: "Project created successfully."
      });

      // Check if we're in onboarding step 3 and complete it
      if (shouldLockNavigation && currentStep === 3) {
        console.log('🎯 Project created during onboarding step 3 - completing step automatically');
        try {
          await completeCurrentStep();
          console.log('✅ Onboarding step 3 completed successfully');
        } catch (error) {
          console.error('❌ Failed to complete onboarding step:', error);
          // Don't fail the project creation if step completion fails
        }
      }

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

  const handleProjectDataChange = (field: keyof typeof projectData, value: string | string[] | Service[]) => {
    setProjectData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePackageSelection = async (packageId: string) => {
    if (!packageId) {
      setProjectData(prev => ({
        ...prev,
        packageId: "",
        basePrice: "",
        selectedServices: [],
        selectedServiceIds: []
      }));
      return;
    }

    const selectedPackage = packages.find(p => p.id === packageId);
    if (!selectedPackage) return;

    // Get services for default add-ons
    const packageServices = allServices.filter(service => 
      selectedPackage.default_add_ons.includes(service.id)
    );

    setProjectData(prev => ({
      ...prev,
      packageId,
      basePrice: selectedPackage.price.toString(),
      description: selectedPackage.description || prev.description,
      selectedServices: packageServices,
      selectedServiceIds: selectedPackage.default_add_ons
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
    lead.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter packages based on selected project type
  const selectedProjectType = projectTypes.find(pt => pt.id === projectData.projectTypeId);
  const availablePackages = packages.filter(pkg => 
    pkg.applicable_types.length === 0 || 
    (selectedProjectType && pkg.applicable_types.includes(selectedProjectType.name))
  );

  const selectedPackage = packages.find(p => p.id === projectData.packageId);

  // Calculate total estimated cost
  const basePrice = parseFloat(projectData.basePrice) || 0;
  const selectedServicesForCalculation = allServices.filter(service => 
    projectData.selectedServiceIds.includes(service.id)
  );
  const servicesTotal = selectedServicesForCalculation.reduce((total, service) => 
    total + (service.selling_price || service.cost_price || 0), 0
  );
  const totalEstimatedCost = basePrice + servicesTotal;


  // Check if form has meaningful changes (excluding auto-assigned values)
  const hasInitialAssignee = profile?.user_id && projectData.assignees.length === 1 && projectData.assignees[0] === profile.user_id;
  const isDirty = Boolean(
    projectData.name.trim() ||
    projectData.description.trim() ||
    projectData.basePrice.trim() ||
    projectData.packageId ||
    projectData.selectedServiceIds.length > 0 ||
    (projectData.assignees.length > 1) || // More than just the default creator
    (!hasInitialAssignee && projectData.assignees.length > 0) || // Manual assignee changes
    (isNewLead && (newLeadData.name.trim() || newLeadData.email.trim() || newLeadData.phone.trim() || newLeadData.notes.trim())) ||
    (!isNewLead && selectedLeadId && selectedLeadId !== defaultLeadId)
  );

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      resetForm();
      setOpen(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
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
          {/* Lead Selection - Only show if no default lead is provided */}
          {!defaultLeadId && (
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
                  <div className="relative" data-dropdown-container>
                    <Button
                      variant="outline"
                      className="w-full justify-between text-left h-auto min-h-[40px]"
                      disabled={loadingLeads}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropdownOpen(!dropdownOpen);
                      }}
                    >
                      {selectedLeadId ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{leads.find(lead => lead.id === selectedLeadId)?.name}</span>
                          {leads.find(lead => lead.id === selectedLeadId) && 
                            <LeadStatusBadge 
                              leadId={leads.find(lead => lead.id === selectedLeadId)?.id || ''}
                              currentStatus={leads.find(lead => lead.id === selectedLeadId)?.status || ''}
                              size="sm"
                              editable={false}
                            />
                          }
                        </div>
                      ) : loadingLeads ? (
                        "Loading clients..."
                      ) : (
                        "Search and select a client..."
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    
                    {dropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
                        <div className="p-3 border-b">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                              placeholder="Search by name..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {loadingLeads ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Loading clients...
                            </div>
                          ) : filteredLeads.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {searchTerm ? 'No clients match your search' : 'No active clients found'}
                            </div>
                          ) : (
                            filteredLeads.map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedLeadId(lead.id);
                                  setDropdownOpen(false);
                                  setSearchTerm("");
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 w-full text-left",
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
                                  <span className="font-medium">{lead.name}</span>
                                </div>
                                <LeadStatusBadge 
                                  leadId={lead.id}
                                  currentStatus={lead.status}
                                  size="sm"
                                  editable={false}
                                />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
          )}

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
              <div className="relative" data-projecttype-dropdown>
                <Button
                  variant="outline"
                  className="w-full justify-between text-left h-auto min-h-[40px]"
                  disabled={loading || loadingPackages}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setProjectTypeDropdownOpen(!projectTypeDropdownOpen);
                  }}
                >
                  {projectData.projectTypeId ? (
                    <span className="font-medium">
                      {projectTypes.find(type => type.id === projectData.projectTypeId)?.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select project type...</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                
                {projectTypeDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
                    <div className="p-3 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search project types..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {projectTypes.filter(type =>
                        type.name.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {searchTerm ? 'No types match your search' : 'No project types found'}
                        </div>
                      ) : (
                        projectTypes
                          .filter(type => type.name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleProjectDataChange("projectTypeId", type.id);
                                if (projectData.packageId) {
                                  handlePackageSelection("");
                                }
                                setProjectTypeDropdownOpen(false);
                                setSearchTerm("");
                              }}
                              className={cn(
                                "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 w-full text-left",
                                projectData.projectTypeId === type.id && "bg-muted"
                              )}
                            >
                              <div className="flex items-center space-x-3">
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    projectData.projectTypeId === type.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-medium">{type.name}</span>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Package Selection */}
            {projectData.projectTypeId && (
              <div className="space-y-2">
                <Label htmlFor="package">Package (Optional)</Label>
                <div className="relative" data-package-dropdown>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left h-auto min-h-[40px]"
                    disabled={loading || loadingPackages}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPackageDropdownOpen(!packageDropdownOpen);
                    }}
                  >
                    {projectData.packageId ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">
                          {selectedPackage?.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          TRY {selectedPackage?.price.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select a package...</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  
                  {packageDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
                      <div className="overflow-y-auto max-h-64">
                        <div className="p-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePackageSelection("");
                              setPackageDropdownOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b w-full text-left rounded-md mb-1",
                              !projectData.packageId && "bg-muted"
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  !projectData.packageId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="text-muted-foreground">No package</span>
                            </div>
                          </button>
                          {availablePackages.length === 0 ? (
                            <div className="p-4 text-center space-y-3">
                              <div className="text-sm text-muted-foreground">
                                No packages available for this project type.
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Create packages to offer predefined service bundles with pricing.
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newWindow = window.open('/settings/services', '_blank');
                                  if (newWindow) {
                                    // Listen for when the settings window is closed and refresh packages
                                    const checkClosed = setInterval(() => {
                                      if (newWindow.closed) {
                                        clearInterval(checkClosed);
                                        // Refresh packages after settings window is closed
                                        fetchPackagesAndTypes();
                                      }
                                    }, 1000);
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Package
                              </Button>
                            </div>
                          ) : (
                            availablePackages.map((pkg) => (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handlePackageSelection(pkg.id);
                                  setPackageDropdownOpen(false);
                                }}
                                className={cn(
                                  "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 w-full text-left rounded-md mb-1",
                                  projectData.packageId === pkg.id && "bg-muted"
                                )}
                              >
                                <div className="flex items-center space-x-3 flex-1">
                                  <Check
                                    className={cn(
                                      "h-4 w-4",
                                      projectData.packageId === pkg.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{pkg.name}</span>
                                      <span className="text-sm font-medium text-primary">
                                        TRY {pkg.price.toLocaleString()}
                                      </span>
                                    </div>
                                    {pkg.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {pkg.description}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      {pkg.duration} • {pkg.default_add_ons.length} services
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {selectedPackage && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Duration:</strong> {selectedPackage.duration}</p>
                    {selectedPackage.description && (
                      <p><strong>Description:</strong> {selectedPackage.description}</p>
                    )}
                    {selectedPackage.default_add_ons.length > 0 && (
                      <p><strong>Includes:</strong> {selectedPackage.default_add_ons.length} default services</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Custom Setup Toggle - Only show when no package is selected */}
            {!projectData.packageId && !showCustomSetup && (
              <div className="space-y-3 p-4 bg-muted/10 rounded-lg border border-dashed">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No package selected. You can add custom pricing and services.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomSetup(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Set Custom Details
                  </Button>
                </div>
              </div>
            )}

            {/* Base Price - Show if package selected or custom setup enabled */}
            {(projectData.packageId || showCustomSetup) && (
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
                {selectedPackage && (
                  <p className="text-xs text-muted-foreground">
                    Package base price: TRY {selectedPackage.price.toLocaleString()} (you can customize this)
                  </p>
                )}
              </div>
            )}
            
            {/* Description - Show if package selected or custom setup enabled */}
            {(projectData.packageId || showCustomSetup) && (
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
            )}

            {/* Services Selection - Show if package selected or custom setup enabled */}
            {(projectData.packageId || showCustomSetup) && (
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
                    onChange={(serviceIds) => {
                      const selectedServices = allServices.filter(service => serviceIds.includes(service.id));
                      handleProjectDataChange("selectedServiceIds", serviceIds);
                      handleProjectDataChange("selectedServices", selectedServices);
                    }}
                    disabled={loading}
                    isLoading={loadingPackages}
                  />
                </div>
               )}
             </div>
            )}

            {/* Project Summary */}
            {(projectData.name || projectData.basePrice || projectData.selectedServiceIds.length > 0) && (
              <div className="space-y-3 p-4 bg-muted/20 rounded-lg border">
                <h4 className="font-medium text-primary">Project Summary</h4>
                
                {selectedPackage && (
                  <div className="space-y-1 text-sm">
                    <p><strong>Base Package:</strong> {selectedPackage.name}</p>
                    <p><strong>Duration:</strong> {selectedPackage.duration}</p>
                  </div>
                )}
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base Price:</span>
                    <span className="font-medium">TRY {(parseFloat(projectData.basePrice) || 0).toLocaleString()}</span>
                  </div>
                  
                  {projectData.selectedServiceIds.length > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Add-ons:</span>
                        <span>{projectData.selectedServiceIds.length} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Services Total:</span>
                        <span className="font-medium">TRY {servicesTotal.toLocaleString()}</span>
                       </div>
                     </>
                   )}
                   
                   <div className="flex justify-between pt-2 border-t border-border font-medium text-primary">
                    <span>Final Price:</span>
                    <span>TRY {totalEstimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Assignees removed - single user organization */}
              />
            </div>
          </div>
        </AppSheetModal>
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </AppSheetModal>

      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message="You have unsaved project changes."
      />
    </>
  );
}