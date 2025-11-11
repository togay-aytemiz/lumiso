import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Calendar, CheckCircle, FolderPlus, User, Activity, CheckSquare, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import ScheduleSessionDialog from "@/components/ScheduleSessionDialog";
import { LeadActivitySection } from "@/components/LeadActivitySection";
import { ProjectsSection } from "@/components/ProjectsSection";
import { LeadSessionsSection } from "@/components/LeadSessionsSection";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import ProjectDetailsLayout from "@/components/project-details/ProjectDetailsLayout";
// AssigneesList removed - single user organization
import { formatDate, formatTime, getDateFnsLocale } from "@/lib/utils";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import { useLeadStatusActions } from "@/hooks/useLeadStatusActions";
// Permissions removed for single photographer mode
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { DetailPageLoadingSkeleton } from "@/components/ui/loading-presets";
import { useMessagesTranslation, useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { EntityHeader, type EntitySummaryItem } from "@/components/EntityHeader";
import { useLeadDetailData } from "@/hooks/useLeadDetailData";

const getDateKey = (value?: string | null) => (value ? value.slice(0, 10) : null);
const safeFormatDate = (value?: string | null) => {
  if (!value) return null;
  try {
    return formatDate(value);
  } catch {
    return null;
  }
};
const safeFormatTime = (value?: string | null) => {
  if (!value) return null;
  try {
    return formatTime(value);
  } catch {
    return null;
  }
};
const LeadDetail = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t: tMessages } = useMessagesTranslation();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { t: tPages } = useTranslation("pages");
  const {
    lead,
    leadQuery,
    sessions,
    sessionsQuery,
    projectSummary,
    aggregatedPayments,
    summaryQuery,
    latestLeadActivity,
    latestActivityQuery,
    leadStatuses,
    sessionMetrics,
    latestSessionUpdate,
    hasProjects,
    isLoading: detailLoading,
    refetchAll
  } = useLeadDetailData(id);
  const handledMissingLeadRef = useRef(false);

  useEffect(() => {
    if (!id) {
      navigate("/leads");
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id || detailLoading || handledMissingLeadRef.current) {
      return;
    }

    if (leadQuery.isError) {
      handledMissingLeadRef.current = true;
      const message =
        leadQuery.error && leadQuery.error instanceof Error
          ? leadQuery.error.message
          : tPages("leadDetail.toast.fetchLeadDescription");

      toast({
        title: tPages("leadDetail.toast.fetchLeadTitle"),
        description: message,
        variant: "destructive"
      });
      navigate("/leads");
      return;
    }

    if (leadQuery.isSuccess && !lead) {
      handledMissingLeadRef.current = true;
      toast({
        title: tPages("leadDetail.toast.leadNotFoundTitle"),
        description: tPages("leadDetail.toast.leadNotFoundDescription"),
        variant: "destructive"
      });
      navigate("/leads");
    }
  }, [id, detailLoading, leadQuery.isError, leadQuery.error, leadQuery.isSuccess, lead, navigate, tPages]);
  const [deleting, setDeleting] = useState(false);

  // User settings and status actions
  const {
    settings: userSettings,
    loading: settingsLoading
  } = useOrganizationQuickSettings();
  const {
    markAsCompleted,
    markAsLost,
    isUpdating
  } = useLeadStatusActions({
    leadId: lead?.id || '',
    onStatusChange: () => {
      refetchAll();
    }
  });


  const {
    currentStep,
    completeCurrentStep,
    completeMultipleSteps // BULLETPROOF: For combined tutorials
  } = useOnboarding();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [hasViewedProject, setHasViewedProject] = useState(false);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const [hasScheduledSession, setHasScheduledSession] = useState(false);
  const {
    todayCount,
    todayNext,
    nextUpcoming,
    overdueCount
  } = sessionMetrics;

  // Dynamically update tutorial steps based on hasProjects
  const leadDetailsTutorialSteps: TutorialStep[] = useMemo(() => {
    const introSections = tPages("leadDetail.tutorial.intro.sections", { returnObjects: true }) as Array<{ title: string; description: string }>;
    const introIcons = [User, FolderPlus, Activity];
    const explorePoints = tPages("leadDetail.tutorial.exploreProjects.points", { returnObjects: true }) as string[];

    return [
      {
        id: 4,
        title: tPages("leadDetail.tutorial.intro.title"),
        description: tPages("leadDetail.tutorial.intro.description"),
        content: (
          <div className="space-y-4">
            {introSections.map((section, index) => {
              const Icon = introIcons[index] ?? User;
              return (
                <div key={section.title} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">{section.title}</h4>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ),
        mode: "modal",
        canProceed: true,
      },
      {
        id: 5,
        title: tPages("leadDetail.tutorial.createProject.title"),
        description: tPages("leadDetail.tutorial.createProject.description"),
        content: null,
        mode: "floating",
        canProceed: hasProjects,
        requiresAction: true,
        disabledTooltip: tPages("leadDetail.tutorial.createProject.disabledTooltip"),
      },
      {
        id: 6,
        title: tPages("leadDetail.tutorial.exploreProjects.title"),
        description: tPages("leadDetail.tutorial.exploreProjects.description"),
        content: (
          <div className="text-sm space-y-2">
            {explorePoints.map(point => (
              <div key={point} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        ),
        mode: "floating",
        canProceed: hasViewedProject,
        requiresAction: !hasViewedProject,
        disabledTooltip: hasViewedProject ? undefined : tPages("leadDetail.tooltips.viewProject"),
      },
      {
        id: 7,
        title: tPages("leadDetail.tutorial.complete.title"),
        description: tPages("leadDetail.tutorial.complete.description"),
        content: (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              {tPages("leadDetail.tutorial.complete.projectsShortcut")}
            </p>
          </div>
        ),
        mode: "modal",
        canProceed: true,
      },
    ];
  }, [hasProjects, hasViewedProject, tPages]);

  // Scheduling tutorial steps
  const schedulingTutorialSteps: TutorialStep[] = useMemo(() => {
    const schedulingSections = tPages("leadDetail.scheduling.scheduleSession.sections", { returnObjects: true }) as Array<{ title: string; description: string }>;
    const schedulingIcons = [Calendar, CheckSquare];
    const scheduledTips = tPages("leadDetail.scheduling.sessionScheduled.tips", { returnObjects: true }) as string[];

    return [
      {
        id: 3,
        title: tPages("leadDetail.scheduling.scheduleSession.title"),
        description: tPages("leadDetail.scheduling.scheduleSession.description"),
        content: (
          <div className="space-y-4">
            {schedulingSections.map((section, index) => {
              const Icon = schedulingIcons[index] ?? Calendar;
              return (
                <div key={section.title} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">{section.title}</h4>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ),
        mode: "floating",
        canProceed: hasScheduledSession,
        requiresAction: !hasScheduledSession,
        disabledTooltip: tPages("leadDetail.scheduling.scheduleSession.disabledTooltip"),
      },
      {
        id: 4,
        title: tPages("leadDetail.scheduling.sessionScheduled.title"),
        description: tPages("leadDetail.scheduling.sessionScheduled.description"),
        content: (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800">
                {tPages("leadDetail.scheduling.sessionScheduled.banner")}
              </p>
            </div>
            <div className="text-sm space-y-2">
              {scheduledTips.map(tip => (
                <div key={tip} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        ),
        mode: "modal",
        canProceed: true,
      },
    ];
  }, [hasScheduledSession, tPages]);

  // Check if we should show tutorial when component mounts
  useEffect(() => {
    const continueTutorial = location.state?.continueTutorial;
    const tutorialStep = location.state?.tutorialStep;
    const tutorialType = location.state?.tutorialType;
    
    // Check if we should show tutorial either from navigation state OR onboarding progress
    const shouldShowFromState = continueTutorial && tutorialStep;
    const shouldShowFromProgress = currentStep === 2; // User completed first step, now on leads

    if (shouldShowFromState) {
      if (tutorialType === 'scheduling') {
        setIsSchedulingTutorial(true);
        setShowTutorial(true);
        setCurrentTutorialStep(tutorialStep - 3); // Convert to 0-based index for scheduling steps
      } else {
        setShowTutorial(true);
        setCurrentTutorialStep(tutorialStep - 4); // Convert to 0-based index for our steps array
      }
    } else if (shouldShowFromProgress) {
      setShowTutorial(true);
      setCurrentTutorialStep(0); // Start with first lead details step
    }
  }, [location.state?.continueTutorial, location.state?.tutorialStep, location.state?.tutorialType, currentStep]);

  // Auto-start scheduling tutorial when currentStep is 5 (after step 4, now on step 5)
  useEffect(() => {
    if (currentStep === 5 && !showTutorial && !location.state?.continueTutorial) {
      console.log('🚀 Auto-starting scheduling tutorial for step 5');
      setIsSchedulingTutorial(true);
      setShowTutorial(true);
      setCurrentTutorialStep(0); // Start with first scheduling step
    }
  }, [currentStep, showTutorial, location.state?.continueTutorial]);

  // Handle tutorial completion with BULLETPROOF step completion
  const handleTutorialComplete = async () => {
    try {
      if (isSchedulingTutorial) {
        // For scheduling tutorial, complete step 5 (scheduling step)
        console.log('🎯 BULLETPROOF LeadDetail: Completing scheduling tutorial (Step 5)');
        await completeCurrentStep();
        setShowTutorial(false);
        console.log('🎉 BULLETPROOF LeadDetail: Scheduling tutorial completed! Navigating back to getting-started');
        navigate('/getting-started');
      } else {
        // For regular lead details tutorial that includes project creation
        // Complete BOTH Step 2 (leads) and Step 3 (projects) in one atomic operation
        console.log('🎯 BULLETPROOF LeadDetail: Completing combined tutorial (Steps 2 & 3) atomically');
        await completeMultipleSteps(2); // Complete 2 steps at once: current + next
        
        setShowTutorial(false);
        console.log('🎉 BULLETPROOF LeadDetail: Combined tutorial completed! Both Step 2 & 3 completed atomically, navigating back to getting-started');
        navigate('/getting-started');
      }
    } catch (error) {
      console.error('❌ BULLETPROOF LeadDetail: Error completing tutorial:', error);
      toast({
        title: tCommon("toast.error"),
        description: tPages("leadDetail.toast.saveProgressFailed"),
        variant: "destructive"
      });
    }
  };
  const handleTutorialExit = () => {
    setShowTutorial(false);
  };

  // Handle project clicked during tutorial
  const handleProjectClicked = () => {
    setHasViewedProject(true);
  };

  const handleSessionScheduled = () => {
    setHasScheduledSession(true);
    void refetchAll();
  };

  useEffect(() => {
    if (!hasScheduledSession && sessions.length > 0) {
      setHasScheduledSession(true);
    }
  }, [hasScheduledSession, sessions.length]);

  // Debug tutorial step changes
  useEffect(() => {
    // Development only debug logging would go here if needed
  }, [currentTutorialStep, showTutorial]);

  // UI state for Lead Information card
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Get system status labels for buttons (refresh when leadStatuses changes)
  const completedStatus = leadStatuses.find(s => s.is_system_final && (s.name.toLowerCase().includes('completed') || s.name.toLowerCase().includes('delivered'))) || leadStatuses.find(s => s.name === 'Completed');
  const lostStatus = leadStatuses.find(s => s.is_system_final && (s.name.toLowerCase().includes('lost') || s.name.toLowerCase().includes('not interested'))) || leadStatuses.find(s => s.name === 'Lost');


  const formatRelativeTime = (dateString?: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: getDateFnsLocale()
      });
    } catch (error) {
      console.error("Error formatting relative time:", error);
      return null;
    }
  };

  const formatCurrency = useCallback((amount: number) => {
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: aggregatedPayments.currency || "TRY",
        minimumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `${Number.isFinite(amount) ? Math.round(amount) : 0} ${aggregatedPayments.currency || "TRY"}`;
    }
  }, [aggregatedPayments.currency]);

  const handleDelete = async () => {
    if (!lead) return;
    setDeleting(true);
    try {
      // 1) Fetch all project IDs for this lead
      const {
        data: leadProjects,
        error: projectsFetchError
      } = await supabase.from('projects').select('id').eq('lead_id', lead.id);
      if (projectsFetchError) throw projectsFetchError;
      const projectIds = (leadProjects || []).map(p => p.id);
      if (projectIds.length > 0) {
        // Delete related project data in safe order
        const {
          error: servicesError
        } = await supabase.from('project_services').delete().in('project_id', projectIds);
        if (servicesError) throw servicesError;
        const {
          error: todosError
        } = await supabase.from('todos').delete().in('project_id', projectIds);
        if (todosError) throw todosError;
        const {
          error: projSessionsError
        } = await supabase.from('sessions').delete().in('project_id', projectIds);
        if (projSessionsError) throw projSessionsError;
        const {
          error: projActivitiesError
        } = await supabase.from('activities').delete().in('project_id', projectIds);
        if (projActivitiesError) throw projActivitiesError;
        const {
          error: paymentsError
        } = await supabase.from('payments').delete().in('project_id', projectIds);
        if (paymentsError) throw paymentsError;

        // Finally delete projects
        const {
          error: deleteProjectsError
        } = await supabase.from('projects').delete().in('id', projectIds);
        if (deleteProjectsError) throw deleteProjectsError;
      }

      // 2) Delete sessions associated directly with this lead (not tied to a project)
      const {
        error: leadSessionsError
      } = await supabase.from('sessions').delete().eq('lead_id', lead.id);
      if (leadSessionsError) throw leadSessionsError;

      // 3) Delete activities/reminders/notes for this lead
      const {
        error: leadActivitiesError
      } = await supabase.from('activities').delete().eq('lead_id', lead.id);
      if (leadActivitiesError) throw leadActivitiesError;

      // 4) Finally delete the lead
      const {
        error: deleteLeadError
      } = await supabase.from('leads').delete().eq('id', lead.id);
      if (deleteLeadError) throw deleteLeadError;
      toast({
        title: tMessages('success.deleted'),
        description: tForms('deleteLeadDialog.successDescription')
      });
      navigate('/leads');
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : "Unable to delete lead.";
      toast({
        title: tMessages('error.generic'),
        description,
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setConfirmDeleteText('');
    }
  };
  const handleSessionUpdated = () => {
    void sessionsQuery.refetch();
    void latestActivityQuery.refetch();
  };

  const handleProjectUpdated = () => {
    // Refresh sessions and activities when project changes (archive/restore should affect visibility)
    void sessionsQuery.refetch();
    void summaryQuery.refetch();
    void latestActivityQuery.refetch();

    // If tutorial is active and we're on the project creation step (Step 5 = index 1), advance to project exploration step
    if (showTutorial && currentTutorialStep === 1) {
      // Use setTimeout to ensure state update happens after component re-render
      setTimeout(() => {
        setCurrentTutorialStep(2); // Move to "Now Explore Your Project" step (Step 6)
      }, 100);
    }
  };
  const handleActivityUpdated = () => {
    // Force activity section to refresh when activities are updated in project modal
    void latestActivityQuery.refetch();
  };
  const handleBack = () => {
    const from = location.state?.from;
    if (from === 'dashboard') {
      navigate('/');
    } else if (from === 'all-leads') {
      navigate('/leads');
    } else if (from === 'all-sessions') {
      navigate('/sessions');
    } else {
      // Default fallback - go back in history if possible, otherwise to all leads
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/leads');
      }
    }
  };
  const handleMarkAsCompleted = () => {
    if (!lead || !completedStatus) return;
    markAsCompleted(lead.status, completedStatus.name);
  };
  const handleMarkAsLost = () => {
    if (!lead || !lostStatus) return;
    markAsLost(lead.status, lostStatus.name);
  };
  const activitySummary = useMemo(() => {
    const timeline: Array<{ type: "lead" | "project" | "session" | "note"; timestamp: string }> = [];

    if (lead?.updated_at) {
      timeline.push({ type: "lead", timestamp: lead.updated_at });
    }

    if (projectSummary.latestUpdate) {
      timeline.push({ type: "project", timestamp: projectSummary.latestUpdate });
    }

    if (latestSessionUpdate) {
      timeline.push({ type: "session", timestamp: latestSessionUpdate });
    }

    if (latestLeadActivity) {
      timeline.push({ type: "note", timestamp: latestLeadActivity });
    }

    if (timeline.length === 0) {
      return {
        primary: tPages("leadDetail.header.activity.none"),
        secondary: tPages("leadDetail.header.activity.hint")
      };
    }

    const latest = timeline.reduce((currentLatest, entry) => {
      if (!currentLatest) return entry;
      return new Date(entry.timestamp).getTime() > new Date(currentLatest.timestamp).getTime() ? entry : currentLatest;
    });

    const relative = formatRelativeTime(latest.timestamp);
    const primary = relative
      ? tPages("leadDetail.header.activity.last", { time: relative })
      : tPages("leadDetail.header.activity.lastFallback");
    const secondary = tPages(`leadDetail.header.activity.sources.${latest.type}`);

    return {
      primary,
      secondary
    };
  }, [lead?.updated_at, projectSummary.latestUpdate, latestSessionUpdate, latestLeadActivity, tPages]);

  const projectUpdateRelative = formatRelativeTime(projectSummary.latestUpdate);
  const projectPrimary = projectSummary.count
    ? tPages("leadDetail.header.projects.count", { count: projectSummary.count })
    : tPages("leadDetail.header.projects.none");
  const projectSecondary = projectSummary.count
    ? projectUpdateRelative
      ? tPages("leadDetail.header.projects.updated", { time: projectUpdateRelative })
      : tPages("leadDetail.header.projects.updatedFallback")
    : tPages("leadDetail.header.projects.hint");

  const sessionsCount = sessions.length;
  const sessionsPrimary = sessionsCount
    ? tPages("leadDetail.header.sessions.count", { count: sessionsCount })
    : tPages("leadDetail.header.sessions.none");
  const sessionsSecondary = useMemo<ReactNode>(() => {
    if (sessionsCount === 0) {
      return tPages("leadDetail.header.sessions.hint");
    }

    const chips: ReactNode[] = [];

    if (overdueCount > 0) {
      chips.push(
        <span
          key="overdue"
          className="inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700"
        >
          {tPages("leadDetail.header.sessions.chips.overdue", { count: overdueCount })}
        </span>
      );
    }

    if (todayCount > 0) {
      const todayTime = safeFormatTime(todayNext?.session_time);
      const label = todayTime
        ? todayCount > 1
          ? tPages("leadDetail.header.sessions.chips.todayMultiple", { count: todayCount, time: todayTime })
          : tPages("leadDetail.header.sessions.chips.todaySingle", { time: todayTime })
        : tPages("leadDetail.header.sessions.chips.todayMultipleNoTime", { count: todayCount });

      chips.push(
        <span
          key="today"
          className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
        >
          {label}
        </span>
      );
    }

    if (nextUpcoming?.session_date) {
      const upcomingDateLabel = safeFormatDate(nextUpcoming.session_date);
      const upcomingTime = safeFormatTime(nextUpcoming.session_time);

      if (upcomingDateLabel) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(
          tomorrow.getDate()
        ).padStart(2, "0")}`;
        const upcomingDateKey = getDateKey(nextUpcoming.session_date);

        const label = upcomingDateKey && upcomingDateKey === tomorrowKey && upcomingTime
          ? tPages("leadDetail.header.sessions.chips.tomorrow", { time: upcomingTime })
          : upcomingTime
            ? tPages("leadDetail.header.sessions.chips.upcomingWithTime", {
                date: upcomingDateLabel,
                time: upcomingTime
              })
            : tPages("leadDetail.header.sessions.chips.upcoming", { date: upcomingDateLabel });

        chips.push(
          <span
            key="upcoming"
            className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"
          >
            {label}
          </span>
        );
      }
    }

    if (chips.length === 0) {
      return tPages("leadDetail.header.sessions.hint");
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {chips}
      </div>
    );
  }, [
    sessionsCount,
    overdueCount,
    todayCount,
    todayNext?.session_time,
    nextUpcoming?.session_date,
    nextUpcoming?.session_time,
    tPages
  ]);

  const paymentsPrimary = aggregatedPayments.total > 0 || aggregatedPayments.totalPaid > 0
    ? tPages("leadDetail.header.payments.primary", { paid: formatCurrency(aggregatedPayments.totalPaid) })
    : tPages("leadDetail.header.payments.primaryZero");
  const paymentsSecondary = aggregatedPayments.total > 0
    ? aggregatedPayments.remaining > 0
      ? tPages("leadDetail.header.payments.secondary", {
          remaining: formatCurrency(aggregatedPayments.remaining),
          total: formatCurrency(aggregatedPayments.total)
        })
      : tPages("leadDetail.header.payments.paidInFull")
    : tPages("leadDetail.header.payments.secondaryZero");

  const summaryItems: EntitySummaryItem[] = useMemo(() => {
    const paymentsSecondaryClass = aggregatedPayments.total > 0 && aggregatedPayments.remaining <= 0
      ? "text-emerald-600"
      : undefined;
    const sessionsSecondaryClass =
      typeof sessionsSecondary === "string" || typeof sessionsSecondary === "number"
        ? "text-muted-foreground"
        : undefined;

    return [
      {
        key: "projects",
        icon: FolderPlus,
        label: tPages("leadDetail.header.projects.label"),
        primary: projectPrimary,
        secondary: projectSecondary
      },
      {
        key: "payments",
        icon: CreditCard,
        label: tPages("leadDetail.header.payments.label"),
        primary: paymentsPrimary,
        secondary: paymentsSecondary,
        secondaryClassName: paymentsSecondaryClass
      },
      {
        key: "sessions",
        icon: Calendar,
        label: tPages("leadDetail.header.sessions.label"),
        primary: sessionsPrimary,
        secondary: sessionsSecondary,
        secondaryClassName: sessionsSecondaryClass
      },
      {
        key: "activity",
        icon: Activity,
        label: tPages("leadDetail.header.activity.label"),
        primary: activitySummary.primary,
        secondary: activitySummary.secondary,
        info: {
          content: tPages("leadDetail.header.activity.info"),
          ariaLabel: tPages("leadDetail.header.activity.infoLabel")
        }
      }
    ];
  }, [
    aggregatedPayments.total,
    aggregatedPayments.remaining,
    projectPrimary,
    projectSecondary,
    paymentsPrimary,
    paymentsSecondary,
    sessionsPrimary,
    sessionsSecondary,
    activitySummary,
    tPages
  ]);
  if (detailLoading) {
    return <DetailPageLoadingSkeleton />;
  }
  if (!lead) {
    return null;
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-full px-4 py-4 md:px-8 md:py-8">
        <div className="space-y-6 md:space-y-8">
          <EntityHeader
            className="mb-0"
            name={lead.name || ""}
            title={lead.name || tPages("leadDetail.defaultTitle")}
            onBack={handleBack}
            backLabel={tPages("leadDetail.header.back")}
            statusBadge={
              <LeadStatusBadge
                leadId={lead.id}
                currentStatusId={lead.status_id}
                currentStatus={lead.status}
                onStatusChange={() => {
                  void refetchAll();
                }}
                editable={true}
                statuses={leadStatuses}
              />
            }
            summaryItems={summaryItems}
            fallbackInitials="LD"
            actions={
              <>
                <ScheduleSessionDialog
                  leadId={lead.id}
                  leadName={lead.name}
                  onSessionScheduled={handleSessionScheduled}
                />

                {!settingsLoading &&
                  userSettings.show_quick_status_buttons &&
                  completedStatus &&
                  lead.status !== completedStatus.name && (
                    <Button
                      onClick={handleMarkAsCompleted}
                      disabled={isUpdating}
                      className="h-10 bg-green-600 text-white hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {isUpdating ? "Updating..." : completedStatus.name}
                    </Button>
                  )}

                {!settingsLoading &&
                  userSettings.show_quick_status_buttons &&
                  lostStatus &&
                  lead.status !== lostStatus.name && (
                    <Button onClick={handleMarkAsLost} disabled={isUpdating} variant="destructive" size="sm" className="h-10">
                      {isUpdating ? "Updating..." : lostStatus.name}
                    </Button>
                  )}
              </>
            }
          />

          <ProjectDetailsLayout
            header={null}
            left={
              <div className="space-y-6">
                <UnifiedClientDetails
                  lead={lead}
                  createdAt={lead.created_at}
                  showQuickActions={true}
                  showLeadNameInHeader={false}
                  onLeadUpdated={() => {
                    void refetchAll();
                  }}
                />
              </div>
            }
            sections={[
              {
                id: "lead-projects",
                title: tPages("leadDetail.header.projects.label"),
                content: (
                  <ProjectsSection
                    leadId={lead.id}
                    leadName={lead.name}
                    onProjectUpdated={handleProjectUpdated}
                    onActivityUpdated={handleActivityUpdated}
                    onProjectClicked={handleProjectClicked}
                  />
                )
              },
              {
                id: "lead-sessions",
                title: tPages("leadDetail.header.sessions.label"),
                content: (
                  <LeadSessionsSection
                    sessions={sessions}
                    loading={sessionsQuery.isLoading}
                    leadId={lead.id}
                    leadName={lead.name}
                    onSessionsChanged={handleSessionUpdated}
                    headerAction={
                      <ScheduleSessionDialog
                        leadId={lead.id}
                        leadName={lead.name}
                        onSessionScheduled={handleSessionScheduled}
                      />
                    }
                  />
                )
              },
              {
                id: "lead-activity",
                title: tPages("leadDetail.header.activity.label"),
                content: (
                  <LeadActivitySection
                    leadId={lead.id}
                    leadName={lead.name}
                    onActivityUpdated={() => {
                      void latestActivityQuery.refetch();
                    }}
                  />
                )
              }
            ]}
            overviewNavId="lead-detail-overview"
            overviewLabel={tForms("project_sheet.overview_tab")}
            rightFooter={
              <div className="border border-destructive/20 bg-destructive/5 rounded-md p-4 max-w-full text-center">
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full max-w-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {tForms("leadDangerZone.deleteLead")}
                  </Button>
                  <p className="text-xs text-muted-foreground break-words">
                    {tForms("leadDangerZone.deleteWarning")}
                  </p>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {/* Delete Lead Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setConfirmDeleteText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms("deleteLeadDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForms("deleteLeadDialog.description", { name: lead.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-delete" className="sr-only">
              Confirmation
            </Label>
            <Input
              id="confirm-delete"
              placeholder={tForms("deleteLeadDialog.placeholder", { name: lead.name })}
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {tForms("deleteLeadDialog.cannotUndo")}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting || ![lead.name, 'DELETE'].includes(confirmDeleteText.trim())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? tForms('deleteLeadDialog.deleting') : tForms('deleteLeadDialog.deleteLead')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <OnboardingTutorial
        key={`tutorial-${currentTutorialStep}`}
        steps={isSchedulingTutorial ? schedulingTutorialSteps : leadDetailsTutorialSteps}
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        initialStepIndex={currentTutorialStep}
      />
    </div>
  );
};
export default LeadDetail;
