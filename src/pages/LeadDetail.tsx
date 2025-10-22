import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, CheckCircle, FolderPlus, User, Activity, CheckSquare, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ScheduleSessionDialog from "@/components/ScheduleSessionDialog";
import EditSessionDialog from "@/components/EditSessionDialog";
import SessionSheetView from "@/components/SessionSheetView";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import { LeadActivitySection } from "@/components/LeadActivitySection";
import CompactSessionBanner from "@/components/project-details/Summary/CompactSessionBanner";
import { ProjectsSection } from "@/components/ProjectsSection";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
// AssigneesList removed - single user organization
import { formatDate, formatDateTime, formatTime, getDateFnsLocale } from "@/lib/utils";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import EnhancedSessionsSection from "@/components/EnhancedSessionsSection";
import { useLeadStatusActions } from "@/hooks/useLeadStatusActions";
// Permissions removed for single photographer mode
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { DetailPageLoadingSkeleton } from "@/components/ui/loading-presets";
import { useMessagesTranslation, useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";
import { useSessionActions } from "@/hooks/useSessionActions";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { EntityHeader, type EntitySummaryItem } from "@/components/EntityHeader";
interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
  status_id?: string;
  created_at: string;
  updated_at?: string | null;
  assignees?: string[];
  user_id: string;
}
interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
  project_id?: string;
  lead_id: string;
  project_name?: string;
  created_at?: string | null;
  updated_at?: string | null;
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
}

interface ProjectSummary {
  count: number;
  latestUpdate: string | null;
}

interface AggregatedPaymentSummary {
  totalPaid: number;
  total: number;
  remaining: number;
  currency: string;
}

// Helpers: validation and phone normalization (TR defaults)
const isValidEmail = (email?: string | null) => !!email && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);
function normalizeTRPhone(phone?: string | null): null | {
  e164: string;
  e164NoPlus: string;
} {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  let e164 = "";
  if (phone.trim().startsWith("+")) {
    // already has plus, ensure it is +90XXXXXXXXXX
    if (digits.startsWith("90") && digits.length === 12) {
      e164 = "+" + digits;
    } else {
      return null;
    }
  } else if (digits.startsWith("90") && digits.length === 12) {
    e164 = "+" + digits;
  } else if (digits.startsWith("0") && digits.length === 11) {
    e164 = "+90" + digits.slice(1);
  } else if (digits.length === 10) {
    e164 = "+90" + digits;
  } else {
    return null;
  }
  return {
    e164,
    e164NoPlus: e164.slice(1)
  };
}
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
  const [lead, setLead] = useState<Lead | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionSheetOpen, setIsSessionSheetOpen] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);

  // User settings and status actions
  const {
    settings: userSettings,
    loading: settingsLoading
  } = useOrganizationQuickSettings();
  const currentLocationPath = useMemo(
    () => `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search]
  );
  const {
    markAsCompleted,
    markAsLost,
    isUpdating
  } = useLeadStatusActions({
    leadId: lead?.id || '',
    onStatusChange: () => {
      fetchLead();
      setActivityRefreshKey(prev => prev + 1);
    }
  });

  const { deleteSession } = useSessionActions();
  // Permissions removed for single photographer mode - always allow
  // const {
  //   hasPermission,
  //   canEditLead
  // } = usePermissions();
  const [userCanEdit, setUserCanEdit] = useState(true); // Always allow editing in single photographer mode

  const {
    currentStep,
    completeCurrentStep,
    completeMultipleSteps // BULLETPROOF: For combined tutorials
  } = useOnboarding();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [hasProjects, setHasProjects] = useState(false);
  const [hasViewedProject, setHasViewedProject] = useState(false);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const [hasScheduledSession, setHasScheduledSession] = useState(false);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary>({
    count: 0,
    latestUpdate: null
  });
  const [aggregatedPayments, setAggregatedPayments] = useState<AggregatedPaymentSummary>({
    totalPaid: 0,
    total: 0,
    remaining: 0,
    currency: "TRY"
  });
  const [latestLeadActivity, setLatestLeadActivity] = useState<string | null>(null);

  // Check if projects exist for this lead and capture summary details
  useEffect(() => {
    const fetchProjectSummary = async () => {
      const resetSummaries = () => {
        setHasProjects(false);
        setProjectSummary({
          count: 0,
          latestUpdate: null
        });
        setAggregatedPayments({
          totalPaid: 0,
          total: 0,
          remaining: 0,
          currency: "TRY"
        });
      };

      if (!lead?.id) {
        resetSummaries();
        return;
      }

      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) {
          resetSummaries();
          return;
        }

        const {
          data: organizationId
        } = await supabase.rpc('get_user_active_organization_id');
        if (!organizationId) {
          resetSummaries();
          return;
        }

        const {
          data,
          error
        } = await supabase.from("projects").select("id, updated_at, base_price").eq("lead_id", lead.id).eq("organization_id", organizationId);
        if (error) throw error;

        const projects = (data || []) as Array<{ id: string; updated_at: string | null; base_price: number | null }>;
        const projectIds = projects.map(project => project.id);

        const servicesByProject = new Map<string, number>();
        const paidByProject = new Map<string, number>();

        if (projectIds.length > 0) {
          const {
            data: servicesData,
            error: servicesError
          } = await supabase.from('project_services').select(`
              project_id,
              services (
                selling_price,
                price
              )
            `).in('project_id', projectIds);
          if (servicesError) throw servicesError;

          (servicesData || []).forEach((entry: any) => {
            if (!entry?.project_id) return;
            const service = entry.services as { selling_price?: number | null; price?: number | null } | null;
            const priceValue = Number(service?.selling_price ?? service?.price ?? 0);
            if (!Number.isFinite(priceValue)) return;
            servicesByProject.set(entry.project_id, (servicesByProject.get(entry.project_id) ?? 0) + priceValue);
          });

          const {
            data: paymentsData,
            error: paymentsError
          } = await supabase.from('payments').select('project_id, amount, status').in('project_id', projectIds);
          if (paymentsError) throw paymentsError;

          (paymentsData || []).forEach((payment: any) => {
            if (!payment?.project_id) return;
            const amount = Number(payment.amount) || 0;
            if (!Number.isFinite(amount)) return;
            if (payment.status === 'paid') {
              paidByProject.set(payment.project_id, (paidByProject.get(payment.project_id) ?? 0) + amount);
            }
          });
        }

        const latestUpdate = projects.reduce<string | null>((latest, project) => {
          if (!project.updated_at) return latest;
          if (!latest) return project.updated_at;
          return new Date(project.updated_at).getTime() > new Date(latest).getTime() ? project.updated_at : latest;
        }, null);

        let totalBooked = 0;
        let totalPaid = 0;
        projects.forEach(project => {
          const basePrice = Number(project.base_price) || 0;
          const servicesTotal = servicesByProject.get(project.id) ?? 0;
          const projectTotal = basePrice + servicesTotal;
          totalBooked += projectTotal;
          totalPaid += paidByProject.get(project.id) ?? 0;
        });

        const remaining = Math.max(0, totalBooked - totalPaid);

        setHasProjects(projects.length > 0);
        setProjectSummary({
          count: projects.length,
          latestUpdate
        });
        setAggregatedPayments({
          totalPaid,
          total: totalBooked,
          remaining,
          currency: "TRY"
        });
      } catch (error) {
        console.error("Error checking projects:", error);
        setAggregatedPayments({
          totalPaid: 0,
          total: 0,
          remaining: 0,
          currency: "TRY"
        });
      }
    };

    fetchProjectSummary();
  }, [lead?.id, activityRefreshKey]); // Re-check when activity refreshes (which happens after project creation)

  useEffect(() => {
    const fetchLatestActivity = async () => {
      if (!lead?.id) {
        setLatestLeadActivity(null);
        return;
      }

      try {
        const {
          data,
          error
        } = await supabase.from('activities').select('updated_at, created_at').eq('lead_id', lead.id).order('updated_at', {
          ascending: false
        }).order('created_at', {
          ascending: false
        }).limit(1);
        if (error) throw error;

        const latest = data && data.length > 0 ? data[0] : null;
        const timestamp = latest?.updated_at || latest?.created_at || null;
        setLatestLeadActivity(timestamp || null);
      } catch (error) {
        console.error('Error fetching latest activity timestamp:', error);
        setLatestLeadActivity(null);
      }
    };

    fetchLatestActivity();
  }, [lead?.id, activityRefreshKey]);

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
    setActivityRefreshKey(prev => prev + 1); // Refresh activities to show new session
    fetchSessions();
  };

  // Debug tutorial step changes
  useEffect(() => {
    // Development only debug logging would go here if needed
  }, [currentTutorialStep, showTutorial]);

  // Check edit permissions when lead data loads
  useEffect(() => {
    const checkEditPermissions = async () => {
      if (lead) {
        // Always allow editing in single photographer mode
        // const canEdit = await canEditLead(lead.user_id, lead.assignees);
        setUserCanEdit(true);
      }
    };
    checkEditPermissions();
  }, [lead]); // Removed canEditLead dependency

  // UI state for Lead Information card
  const [editOpen, setEditOpen] = useState(false);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const [isNotesTruncatable, setIsNotesTruncatable] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Get system status labels for buttons (refresh when leadStatuses changes)
  const completedStatus = leadStatuses.find(s => s.is_system_final && (s.name.toLowerCase().includes('completed') || s.name.toLowerCase().includes('delivered'))) || leadStatuses.find(s => s.name === 'Completed');
  const lostStatus = leadStatuses.find(s => s.is_system_final && (s.name.toLowerCase().includes('lost') || s.name.toLowerCase().includes('not interested'))) || leadStatuses.find(s => s.name === 'Lost');

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    status: "new" as string
  });

  // Track initial form data to detect changes
  const [initialFormData, setInitialFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    status: "new" as string
  });

  // Check if form has changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

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

  const getSessionDateTime = useCallback((session: Session): Date | null => {
    if (!session.session_date) return null;
    const timePart = (session.session_time ?? "").trim();
    const candidate = timePart
      ? new Date(`${session.session_date}T${timePart}`)
      : new Date(session.session_date);

    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }

    const fallback = new Date(session.session_date);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }, []);

  const {
    todayPlannedSession,
    todayPlannedDate,
    upcomingPlannedSession,
    upcomingPlannedDate,
    overduePlannedSession,
    overduePlannedDate,
    overduePlannedCount
  } = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const nowTime = now.getTime();
    let today: { session: Session; date: Date } | null = null;
    let upcoming: { session: Session; date: Date } | null = null;
    let overdue: { session: Session; date: Date } | null = null;
    let overdueCount = 0;

    sessions.forEach(session => {
      if (session.status !== "planned") return;
      const sessionDate = getSessionDateTime(session);
      if (!sessionDate) return;

      if (sessionDate.getTime() < nowTime) {
        overdueCount += 1;
        if (!overdue || sessionDate > overdue.date) {
          overdue = { session, date: sessionDate };
        }
        return;
      }

      if (sessionDate <= endOfToday) {
        if (!today || sessionDate < today.date) {
          today = { session, date: sessionDate };
        }
        return;
      }

      if (!upcoming || sessionDate < upcoming.date) {
        upcoming = { session, date: sessionDate };
      }
    });

    return {
      todayPlannedSession: today?.session ?? null,
      todayPlannedDate: today?.date ?? null,
      upcomingPlannedSession: upcoming?.session ?? null,
      upcomingPlannedDate: upcoming?.date ?? null,
      overduePlannedSession: overdue?.session ?? null,
      overduePlannedDate: overdue?.date ?? null,
      overduePlannedCount: overdueCount
    };
  }, [sessions, getSessionDateTime]);

  const recentSession = useMemo(() => (sessions.length > 0 ? sessions[0] : null), [sessions]);
  const latestSessionUpdate = useMemo(() => {
    return sessions.reduce<string | null>((latest, session) => {
      const candidate = session.updated_at || session.created_at || null;
      if (!candidate) return latest;
      if (!latest) return candidate;
      return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
    }, null);
  }, [sessions]);
  useEffect(() => {
    if (id) {
      fetchLead();
      fetchSessions();
      fetchLeadStatuses();
    } else {
      // If no id parameter, redirect to leads page
      navigate('/leads');
    }
  }, [id, navigate]);
  const fetchLead = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('leads').select(`
          *,
          lead_statuses(id, name, color, is_system_final)
        `).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({
          title: tPages("leadDetail.toast.leadNotFoundTitle"),
          description: tPages("leadDetail.toast.leadNotFoundDescription"),
          variant: "destructive"
        });
        navigate("/leads");
        return;
      }
      setLead(data);
      const newFormData = {
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        notes: data.notes || "",
        status: data.status || "new"
      };
      setFormData(newFormData);
      setInitialFormData(newFormData);
    } catch (error: any) {
      toast({
        title: tPages("leadDetail.toast.fetchLeadTitle"),
        description: error.message || tPages("leadDetail.toast.fetchLeadDescription"),
        variant: "destructive"
      });
      navigate("/leads");
    } finally {
      setLoading(false);
    }
  };
  const fetchSessions = async () => {
    if (!id) return;
    try {
      // Get all sessions for this lead with project information
      const {
        data,
        error
      } = await supabase.from('sessions').select(`
          *,
          projects:project_id (
            name,
            project_types (
              name
            )
          )
        `).eq('lead_id', id).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Determine archived projects for this lead
      const {
        data: userData
      } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      let filteredSessions = data || [];
      if (userId) {
        // Get user's active organization
        const {
          data: organizationId
        } = await supabase.rpc('get_user_active_organization_id');
        let archivedStatus = null;
        if (organizationId) {
          try {
            const statusQuery = await supabase.from('project_statuses').select('id').eq('organization_id', organizationId).ilike('name', 'archived').limit(1);
            archivedStatus = statusQuery.data?.[0] || null;
          } catch (err) {
            console.error('Error fetching archived status:', err);
          }
        }
        if (archivedStatus?.id) {
          const {
            data: archivedProjects
          } = await supabase.from('projects').select('id').eq('lead_id', id).eq('status_id', archivedStatus.id);
          const archivedIds = new Set((archivedProjects || []).map(p => p.id));
          filteredSessions = filteredSessions.filter(s => !s.project_id || !archivedIds.has(s.project_id));
        }
      }

      // Process sessions to include project name
      const processedSessions = (filteredSessions || []).map(session => ({
        ...session,
        project_name: session.projects?.name || undefined
      }));

      // Sort sessions: planned first, then others by session_date descending
      const sortedSessions = processedSessions.sort((a, b) => {
        if (a.status === 'planned' && b.status !== 'planned') return -1;
        if (b.status === 'planned' && a.status !== 'planned') return 1;
        if (a.status !== 'planned' && b.status !== 'planned') {
          return new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
        }
        return 0;
      });
      setSessions(sortedSessions);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
    }
  };
  const fetchLeadStatuses = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('lead_statuses').select('*').order('sort_order', {
        ascending: true
      });
      if (error) throw error;
      setLeadStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching lead statuses:', error);
    }
  };

  // Detect if notes content is truncatable to 2 lines
  useEffect(() => {
    if (!notesRef.current || !lead?.notes) {
      setIsNotesTruncatable(false);
      return;
    }
    const el = notesRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      setIsNotesTruncatable(el.scrollHeight > el.clientHeight + 1);
    });
  }, [lead?.notes, notesExpanded]);
  const handleSave = async () => {
    if (!lead || !formData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Name is required.",
        variant: "destructive"
      });
      return;
    }
    setSaving(true);
    try {
      // Find the status ID for the selected status
      const selectedStatus = leadStatuses.find(s => s.name === formData.status);
      const {
        error
      } = await supabase.from('leads').update({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
        status_id: selectedStatus?.id || null
      }).eq('id', lead.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Lead updated successfully."
      });

      // Refresh lead data
      await fetchLead();
      await fetchSessions();

      // Refresh activity timeline to show lead changes
      setActivityRefreshKey(prev => prev + 1);
    } catch (error: any) {
      toast({
        title: "Error updating lead",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
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
    } catch (error: any) {
      toast({
        title: tMessages('error.generic'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setConfirmDeleteText('');
    }
  };
  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteSession(sessionId);
    if (success) {
      fetchSessions();
    }
  };
  const handleSessionUpdated = () => {
    fetchSessions();
  };

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionSheetOpen(true);
  };

  const handleViewFullSessionDetails = () => {
    if (selectedSessionId) {
      navigate(`/sessions/${selectedSessionId}`, { state: { from: currentLocationPath } });
    }
  };

  const handleNavigateToLead = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  const handleNavigateToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };
  const handleProjectUpdated = () => {
    // Refresh sessions and activities when project changes (archive/restore should affect visibility)
    fetchSessions();
    setActivityRefreshKey(prev => prev + 1);

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
    setActivityRefreshKey(prev => prev + 1);
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
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const statusOptions = leadStatuses.map(status => ({
    value: status.name,
    label: status.name
  }));

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
  let sessionsSecondary = tPages("leadDetail.header.sessions.hint");
  if (sessionsCount) {
    const summaryParts: string[] = [];

    if (todayPlannedSession && todayPlannedDate) {
      if (todayPlannedSession.session_time) {
        const timeDisplay = formatTime(todayPlannedSession.session_time);
        summaryParts.push(tPages("leadDetail.header.sessions.today", { time: timeDisplay }));
      } else {
        summaryParts.push(tPages("leadDetail.header.sessions.todayAllDay"));
      }
    } else if (upcomingPlannedSession && upcomingPlannedDate) {
      const plannedDisplay = formatDateTime(
        upcomingPlannedSession.session_date,
        upcomingPlannedSession.session_time || undefined
      );
      summaryParts.push(tPages("leadDetail.header.sessions.next", { date: plannedDisplay }));
    } else if (overduePlannedSession && overduePlannedDate) {
      const overdueDisplay = formatDateTime(
        overduePlannedSession.session_date,
        overduePlannedSession.session_time || undefined
      );
      summaryParts.push(tPages("leadDetail.header.sessions.overdue", { date: overdueDisplay }));
    } else if (recentSession) {
      const recentDisplay = formatDate(recentSession.session_date);
      summaryParts.push(tPages("leadDetail.header.sessions.last", { date: recentDisplay }));
    }

    const hasTodayOrUpcoming = Boolean(todayPlannedSession || upcomingPlannedSession);
    if (overduePlannedCount > 0 && hasTodayOrUpcoming) {
      summaryParts.push(
        tPages("leadDetail.header.sessions.overdueCount", { count: overduePlannedCount })
      );
    }

    if (summaryParts.length > 0) {
      sessionsSecondary = summaryParts.join(" • ");
    }
  }

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
    const sessionsSecondaryClass = sessionsCount > 0 && overduePlannedCount > 0
      ? "text-amber-600"
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
    projectPrimary,
    projectSecondary,
    paymentsPrimary,
    paymentsSecondary,
    sessionsPrimary,
    sessionsSecondary,
    sessionsCount,
    overduePlannedCount,
    activitySummary,
    tPages
  ]);
  if (loading) {
    return <DetailPageLoadingSkeleton />;
  }
  if (!lead) {
    return null;
  }
  return <div className="p-4 md:p-8 max-w-full overflow-x-hidden">
      <EntityHeader
        className="mb-6"
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
              fetchLead();
              setActivityRefreshKey(prev => prev + 1);
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
              disabled={sessions.some(s => s.status === "planned")}
              disabledTooltip={tPages("leadDetail.tooltips.sessionAlreadyPlanned")}
            />

            {!settingsLoading &&
              userSettings.show_quick_status_buttons &&
              completedStatus &&
              formData.status !== completedStatus.name && (
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
              formData.status !== lostStatus.name && (
                <Button onClick={handleMarkAsLost} disabled={isUpdating} variant="destructive" size="sm" className="h-10">
                  {isUpdating ? "Updating..." : lostStatus.name}
                </Button>
              )}
          </>
        }
      />
      {/* Enhanced Sessions Section */}
      <EnhancedSessionsSection
        sessions={sessions as any}
        loading={loading}
        onSessionClick={handleSessionClick}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 max-w-full">
        {/* Left column - Lead Details (33%) */}
        <div className="lg:col-span-1 space-y-6 min-w-0">
          <UnifiedClientDetails 
            lead={lead}
            createdAt={lead.created_at}
            showQuickActions={true}
            onLeadUpdated={() => {
              fetchLead();
              setActivityRefreshKey(prev => prev + 1);
            }}
          />
        </div>

        {/* Right column - Projects and Activity Section (67%) */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <ProjectsSection leadId={lead.id} leadName={lead.name} onProjectUpdated={handleProjectUpdated} onActivityUpdated={handleActivityUpdated} onProjectClicked={handleProjectClicked} />
            <LeadActivitySection
              leadId={lead.id}
              leadName={lead.name}
              onActivityUpdated={() => {
                fetchLead();
                setActivityRefreshKey(prev => prev + 1);
              }}
            />

          {/* Always allow delete in single photographer mode */}
          {true && <div className="border border-destructive/20 bg-destructive/5 rounded-md p-4 max-w-full text-center">
              <div className="space-y-3">
                <Button variant="outline" onClick={() => setShowDeleteDialog(true)} className="w-full max-w-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  {tForms('leadDangerZone.deleteLead')}
                </Button>
                <p className="text-xs text-muted-foreground break-words">
                  {tForms('leadDangerZone.deleteWarning')}
                </p>
              </div>
            </div>}
        </div>
      </div>

      {/* Edit Session Dialog */}
      {editingSessionId && (() => {
        const session = sessions.find(s => s.id === editingSessionId);
        return session ? (
          <EditSessionDialog 
            sessionId={session.id} 
            leadId={lead.id} 
            currentDate={session.session_date} 
            currentTime={session.session_time} 
            currentNotes={session.notes} 
            currentProjectId={session.project_id} 
            currentSessionName={(session as any).session_name}
            leadName={lead.name} 
            open={!!editingSessionId} 
            onOpenChange={open => {
              if (!open) {
                setEditingSessionId(null);
              }
            }} 
            onSessionUpdated={() => {
              handleSessionUpdated();
              setEditingSessionId(null);
            }} 
          />
        ) : null;
      })()}

      {/* Delete Session Dialog */}
      <AlertDialog open={!!deletingSessionId} onOpenChange={open => !open && setDeletingSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              {tMessages('confirm.deleteSession')} {tMessages('confirm.cannotUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            if (deletingSessionId) {
              handleDeleteSession(deletingSessionId);
              setDeletingSessionId(null);
            }
          }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Lead Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={open => {
      setShowDeleteDialog(open);
      if (!open) setConfirmDeleteText('');
    }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms('deleteLeadDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForms('deleteLeadDialog.description', { name: lead.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-delete" className="sr-only">Confirmation</Label>
            <Input id="confirm-delete" placeholder={tForms('deleteLeadDialog.placeholder', { name: lead.name })} value={confirmDeleteText} onChange={e => setConfirmDeleteText(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-2">{tForms('deleteLeadDialog.cannotUndo')}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting || ![lead.name, 'DELETE'].includes(confirmDeleteText.trim())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? tForms('deleteLeadDialog.deleting') : tForms('deleteLeadDialog.deleteLead')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Session Sheet View */}
      <SessionSheetView
        sessionId={selectedSessionId || ''}
        isOpen={isSessionSheetOpen}
        onOpenChange={(open) => {
          setIsSessionSheetOpen(open);
          // Refresh sessions when sheet closes
          if (!open) {
            fetchSessions();
          }
        }}
        onViewFullDetails={handleViewFullSessionDetails}
        onNavigateToLead={handleNavigateToLead}
        onNavigateToProject={handleNavigateToProject}
        onSessionUpdated={fetchSessions}
      />

      <OnboardingTutorial
        key={`tutorial-${currentTutorialStep}`} 
        steps={isSchedulingTutorial ? schedulingTutorialSteps : leadDetailsTutorialSteps} 
        isVisible={showTutorial} 
        onComplete={handleTutorialComplete} 
        onExit={handleTutorialExit} 
        initialStepIndex={currentTutorialStep} 
      />
    </div>;
};
export default LeadDetail;
