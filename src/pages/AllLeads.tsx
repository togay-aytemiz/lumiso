import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter } from "lucide-react";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { useNavigate } from "react-router-dom";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { Calendar, MessageSquare, Users, FileText } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { useLeadsWithCustomFields } from "@/hooks/useLeadsWithCustomFields";
import { useLeadTableColumns } from "@/hooks/useLeadTableColumns";
import { LeadTableColumnManager } from "@/components/LeadTableColumnManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";

const AllLeadsNew = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const navigate = useNavigate();
  const { currentStep, completeCurrentStep } = useOnboardingV2();

  // Use new hooks
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeadsWithCustomFields();
  const { 
    columns, 
    columnPreferences, 
    availableColumns, 
    loading: columnsLoading, 
    saveColumnPreferences, 
    resetToDefault 
  } = useLeadTableColumns();

  const loading = leadsLoading || columnsLoading;

  const leadsTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Welcome to Lead Management",
      description: "This is your leads dashboard where you can track and manage all your potential clients. Here's what you can do:",
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Track Leads</h4>
              <p className="text-sm text-muted-foreground">View all your leads in one organized table with contact information and status.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Filter className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Filter & Sort</h4>
              <p className="text-sm text-muted-foreground">Filter by lead status and sort by any column to find exactly what you need.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Customize Columns</h4>
              <p className="text-sm text-muted-foreground">Customize which columns to show and arrange them to match your workflow.</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: "Add Your First Lead",
      description: "Now let's add your first lead! Click the 'Add Lead' button (or + icon on mobile) in the top right corner to get started.",
      content: null,
      mode: "floating",
      canProceed: leads.length > 0,
      requiresAction: leads.length === 0,
      disabledTooltip: "Add at least 1 lead to continue"
    },
    {
      id: 3,
      title: "Great! Now Let's Explore Lead Details",
      description: "Perfect! Now that you have a lead, let's see what you can do with it. Click on your lead in the table below to view its detailed information.",
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: "Click on your lead to continue"
    }
  ];

  const schedulingTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Schedule Your First Photo Session",
      description: "Let's walk through scheduling a photo session for your client. This process will help you organize your photography workflow.",
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Choose Date & Time</h4>
              <p className="text-sm text-muted-foreground">Pick a convenient time that works for both you and your client.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Select Your Client</h4>
              <p className="text-sm text-muted-foreground">Choose the lead/client you want to photograph from your list.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Add Session Details</h4>
              <p className="text-sm text-muted-foreground">Include notes, special requirements, and optional project association.</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: "Select a Lead to Schedule Session",
      description: "Great! Now click on one of your leads in the table below to open their details page where you can schedule a session.",
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: "Click on a lead to continue"
    }
  ];

  // Check if we should show tutorial when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isSchedulingTutorialParam = urlParams.get('tutorial') === 'scheduling';
    
    if (isSchedulingTutorialParam) {
      setIsSchedulingTutorial(true);
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    } else if (currentStep === 2) {
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    }
  }, [currentStep]);

  // Update tutorial step when needed
  useEffect(() => {
    if (showTutorial && !addLeadDialogOpen && currentTutorialStep === 1) {
      setCurrentTutorialStep(2);
    }
  }, [addLeadDialogOpen, showTutorial, currentTutorialStep]);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      // Complete Step 2 (leads) since this tutorial was accessed from leads page
      await completeCurrentStep();
      setShowTutorial(false);
      console.log('🎉 Lead tutorial completed! Step 2 completed, navigating back to getting-started');
      navigate('/getting-started');
    } catch (error) {
      console.error('Error completing tutorial:', error);
      toast({
        title: "Error", 
        description: "Failed to save progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTutorialExit = () => {
    setShowTutorial(false);
  };

  const handleAddLeadDialogChange = (open: boolean) => {
    setAddLeadDialogOpen(open);
  };

  useEffect(() => {
    fetchLeadStatuses();
  }, []);

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

  // Filter leads by status
  const filteredLeads = useMemo(() => {
    if (statusFilter === "all") return leads;
    return leads.filter(lead => lead.lead_statuses?.name === statusFilter);
  }, [leads, statusFilter]);

  const handleRowClick = (lead: any) => {
    const state: any = { from: 'all-leads' };
    
    if (showTutorial) {
      if (isSchedulingTutorial && currentTutorialStep === 1) {
        state.continueTutorial = true;
        state.tutorialType = 'scheduling';
        state.tutorialStep = 3;
      } else if (currentTutorialStep === 2) {
        state.continueTutorial = true;
        state.tutorialStep = 4;
      }
    }
    
    navigate(`/leads/${lead.id}`, { state });
  };

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    ...leadStatuses.map(status => ({
      value: status.name,
      label: status.name
    }))
  ];

  const emptyState = (
    <div className="text-center py-8 text-muted-foreground">
      {statusFilter === "all" 
        ? "No leads found. Add your first lead to get started!"
        : `No leads found with status "${statusFilter}".`
      }
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Leads"
        subtitle="Track and manage your potential clients"
      >
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <Button 
              size="sm"
              onClick={() => setAddLeadDialogOpen(true)}
              className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              data-testid="add-lead-button"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </div>
        </PageHeaderSearch>
      </PageHeader>
      
      <div className="p-4 sm:p-6">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <LeadTableColumnManager
                columnPreferences={columnPreferences}
                availableColumns={availableColumns}
                onSave={saveColumnPreferences}
                onReset={resetToDefault}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={filteredLeads}
              columns={columns}
              onRowClick={handleRowClick}
              emptyState={emptyState}
              itemsPerPage={20}
            />
          </CardContent>
        </Card>
      </div>
      
      <EnhancedAddLeadDialog 
        onSuccess={refetchLeads} 
        open={addLeadDialogOpen}
        onOpenChange={handleAddLeadDialogChange}
        onClose={() => handleAddLeadDialogChange(false)}
      />

      <OnboardingTutorial
        steps={isSchedulingTutorial ? schedulingTutorialSteps : leadsTutorialSteps}
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        initialStepIndex={currentTutorialStep}
      />
    </div>
  );
};

export default AllLeadsNew;