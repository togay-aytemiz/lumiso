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
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Calendar, MessageSquare, Users, FileText } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { useLeadsWithCustomFields } from "@/hooks/useLeadsWithCustomFields";
import { useLeadTableColumns } from "@/hooks/useLeadTableColumns";
import { LeadTableColumnManager } from "@/components/LeadTableColumnManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";

const AllLeadsNew = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const navigate = useNavigate();
  const { currentStep, completeCurrentStep } = useOnboarding();
  const { t } = useTranslation('pages');

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

  const leadsTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t('leads.tutorial.welcome.title'),
      description: t('leads.tutorial.welcome.description'),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.welcome.trackLeads.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.welcome.trackLeads.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Filter className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.welcome.filterSort.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.welcome.filterSort.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.welcome.customizeColumns.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.welcome.customizeColumns.description')}</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: t('leads.tutorial.addFirstLead.title'),
      description: t('leads.tutorial.addFirstLead.description'),
      content: null,
      mode: "floating",
      canProceed: leads.length > 0,
      requiresAction: leads.length === 0,
      disabledTooltip: t('leads.tutorial.addFirstLead.disabledTooltip')
    },
    {
      id: 3,
      title: t('leads.tutorial.exploreDetails.title'),
      description: t('leads.tutorial.exploreDetails.description'),
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: t('leads.tutorial.exploreDetails.disabledTooltip')
    }
  ];

  const schedulingTutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t('leads.tutorial.scheduling.title'),
      description: t('leads.tutorial.scheduling.description'),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.scheduling.chooseDateTime.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.scheduling.chooseDateTime.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.scheduling.selectClient.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.scheduling.selectClient.description')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">{t('leads.tutorial.scheduling.addDetails.title')}</h4>
              <p className="text-sm text-muted-foreground">{t('leads.tutorial.scheduling.addDetails.description')}</p>
            </div>
          </div>
        </div>
      ),
      mode: "modal",
      canProceed: true
    },
    {
      id: 2,
      title: t('leads.tutorial.selectLeadForSession.title'),
      description: t('leads.tutorial.selectLeadForSession.description'),
      content: null,
      mode: "floating",
      canProceed: false,
      requiresAction: true,
      disabledTooltip: t('leads.tutorial.selectLeadForSession.disabledTooltip')
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
      console.log(t('leads.messages.tutorialCompleted'));
      navigate('/getting-started');
    } catch (error) {
      console.error(t('leads.messages.errorCompletingTutorial'), error);
      toast({
        title: "Error", 
        description: t('leads.messages.failedToSaveProgress'),
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
      console.error(t('leads.messages.errorFetchingStatuses'), error);
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
    { value: "all", label: t('leads.allStatuses') },
    ...leadStatuses.map(status => ({
      value: status.name,
      label: status.name
    }))
  ];

  const emptyState = (
    <div className="text-center py-8 text-muted-foreground">
      {statusFilter === "all" 
        ? t('leads.noLeadsAllStatuses')
        : t('leads.noLeadsWithStatus', { status: statusFilter })
      }
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHeader
        title={t('leads.title')}
        subtitle={t('leads.description')}
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
              <span className="hidden sm:inline">{t('leads.addLead')}</span>
            </Button>
          </div>
        </PageHeaderSearch>
      </PageHeader>
      
      <div className="p-4 sm:p-6">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('leads.filterByStatus')}</span>
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