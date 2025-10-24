import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { EntityListView } from "@/legacy/components/common/EntityListView";
import { EntityFilters } from "@/legacy/components/common/EntityFilters";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { LeadService, LeadWithCustomFields } from "@/services/LeadService";
import { useEntityData } from "@/hooks/useEntityData";
import { useLeadTableColumns } from "@/hooks/useLeadTableColumns";
import { Calendar, MessageSquare, Users, FileText, Filter } from "lucide-react";
import { LEAD_STATUS } from "@/constants/entityConstants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const AllLeadsRefactored = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [leadStatusesLoading, setLeadStatusesLoading] = useState(true);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const navigate = useNavigate();
  const { currentStep, completeCurrentStep } = useOnboarding();
  const { t } = useTranslation("pages");

  // Services
  const leadService = new LeadService();

  // Data hooks
  const { 
    data: leads, 
    loading: leadsLoading, 
    refetch: refetchLeads 
  } = useEntityData<LeadWithCustomFields>({
    fetchFn: () => leadService.fetchLeadsWithCustomFields()
  });

  // Refetch data when page becomes visible (e.g., when navigating back from lead detail)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchLeads();
      }
    };

    const handleFocus = () => {
      refetchLeads();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchLeads]);

  const {
    columns,
    loading: columnsLoading,
  } = useLeadTableColumns({
    leadStatuses,
    leadStatusesLoading,
  });

  const loading = leadsLoading || columnsLoading;

  // Tutorial steps
  const leadsTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t("leads.tutorial.welcome.title"),
      description: t("leads.tutorial.welcome.description"),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t("leads.tutorial.welcome.trackLeads.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("leads.tutorial.welcome.trackLeads.description")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Filter className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t("leads.tutorial.welcome.filterSort.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("leads.tutorial.welcome.filterSort.description")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t("leads.tutorial.welcome.customizeColumns.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("leads.tutorial.welcome.customizeColumns.description")}
              </p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: t("leads.tutorial.addFirstLead.title"),
      description: t("leads.tutorial.addFirstLead.description"),
      content: null,
      mode: "floating",
      canProceed: leads.length > 0,
      requiresAction: leads.length === 0,
      disabledTooltip: t("leads.tutorial.addFirstLead.disabledTooltip")
    },
    {
      id: 3,
      title: t("leads.tutorial.exploreDetails.title"),
      description: t("leads.tutorial.exploreDetails.description"),
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: t("leads.tutorial.exploreDetails.disabledTooltip")
    }
  ];

  const schedulingTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t("leads.tutorial.scheduling.title"),
      description: t("leads.tutorial.scheduling.description"),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">
                {t("leads.tutorial.scheduling.chooseDateTime.title")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("leads.tutorial.scheduling.chooseDateTime.description")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">
                {t("leads.tutorial.scheduling.selectClient.title")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("leads.tutorial.scheduling.selectClient.description")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">
                {t("leads.tutorial.scheduling.addDetails.title")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("leads.tutorial.scheduling.addDetails.description")}
              </p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: t("leads.tutorial.selectLeadForSession.title"),
      description: t("leads.tutorial.selectLeadForSession.description"),
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: t("leads.tutorial.selectLeadForSession.disabledTooltip")
    }
  ];

  // Effects
  useEffect(() => {
    fetchLeadStatuses();
  }, []);

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

  useEffect(() => {
    if (showTutorial && !addLeadDialogOpen && currentTutorialStep === 1) {
      setCurrentTutorialStep(2);
    }
  }, [addLeadDialogOpen, showTutorial, currentTutorialStep]);

  // Functions
  const fetchLeadStatuses = async () => {
    try {
      setLeadStatusesLoading(true);
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLeadStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching lead statuses:', error);
    } finally {
      setLeadStatusesLoading(false);
    }
  };

  const handleTutorialComplete = async () => {
    try {
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

  const handleRowClick = (lead: LeadWithCustomFields) => {
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

  // Filter and prepare data
  const filteredLeads = useMemo(() => {
    if (statusFilter === "all") return leads;
    return leads.filter(lead => lead.lead_statuses?.name === statusFilter);
  }, [leads, statusFilter]);

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    ...leadStatuses.map(status => ({
      value: status.name,
      label: status.name
    }))
  ];

  const clearFilters = () => {
    setStatusFilter("all");
  };

  const emptyState = (
    <div className="text-center py-8 text-muted-foreground">
      {statusFilter === "all" 
        ? "No leads found. Add your first lead to get started!"
        : `No leads found with status "${statusFilter}".`
      }
    </div>
  );

  const filters = (
    <EntityFilters
      filters={[
        {
          label: "Filter by status",
          value: statusFilter,
          options: statusOptions,
          onValueChange: setStatusFilter,
          placeholder: "Select status"
        }
      ]}
      onClearFilters={statusFilter !== "all" ? clearFilters : undefined}
    />
  );

  return (
    <ErrorBoundary>
      <EntityListView
        title="Leads"
        subtitle="Track and manage your potential clients"
        data={filteredLeads}
        columns={columns}
        loading={loading}
        onRowClick={handleRowClick}
        onAddClick={() => setAddLeadDialogOpen(true)}
        addButtonText="Add Lead"
        emptyState={emptyState}
        filters={filters}
        itemsPerPage={20}
      />
      
      <EnhancedAddLeadDialog 
        onSuccess={refetchLeads} 
        open={addLeadDialogOpen}
        onOpenChange={setAddLeadDialogOpen}
        onClose={() => setAddLeadDialogOpen(false)}
      />

      <OnboardingTutorial
        steps={isSchedulingTutorial ? schedulingTutorialSteps : leadsTutorialSteps}
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        initialStepIndex={currentTutorialStep}
      />
    </ErrorBoundary>
  );
};

export default AllLeadsRefactored;
