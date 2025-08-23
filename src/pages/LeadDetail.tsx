import { useState, useEffect, useMemo, useRef } from "react";
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
import { ArrowLeft, Save, Calendar, Clock, FileText, CheckCircle, FolderPlus, User, Activity, CheckSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UnifiedClientDetails } from "@/components/UnifiedClientDetails";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ScheduleSessionDialog from "@/components/ScheduleSessionDialog";
import EditSessionDialog from "@/components/EditSessionDialog";
import SessionSheetView from "@/components/SessionSheetView";
import { EnhancedProjectDialog } from "@/components/EnhancedProjectDialog";
import ActivitySection from "@/components/ActivitySection";
import CompactSessionBanner from "@/components/project-details/Summary/CompactSessionBanner";
import { ProjectsSection } from "@/components/ProjectsSection";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { AssigneesList } from "@/components/AssigneesList";
import { formatDate, cn } from "@/lib/utils";
import { useOrganizationQuickSettings } from "@/hooks/useOrganizationQuickSettings";
import EnhancedSessionsSection from "@/components/EnhancedSessionsSection";
import { useLeadStatusActions } from "@/hooks/useLeadStatusActions";
import { usePermissions } from "@/hooks/usePermissions";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
  status_id?: string;
  created_at: string;
  assignees?: string[];
  user_id: string;
}
type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';
interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: SessionStatus;
  project_id?: string;
  lead_id: string;
  project_name?: string;
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
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
  const {
    hasPermission,
    canEditLead
  } = usePermissions();
  const [userCanEdit, setUserCanEdit] = useState(false);

  const {
    currentStep,
    completeCurrentStep
  } = useOnboardingV2();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [hasProjects, setHasProjects] = useState(false);
  const [hasViewedProject, setHasViewedProject] = useState(false);
  const [isSchedulingTutorial, setIsSchedulingTutorial] = useState(false);
  const [hasScheduledSession, setHasScheduledSession] = useState(false);

  // Check if projects exist for this lead
  useEffect(() => {
    const checkProjects = async () => {
      if (!lead?.id) return;
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's active organization ID
        const {
          data: organizationId
        } = await supabase.rpc('get_user_active_organization_id');
        if (!organizationId) return;
        const {
          data,
          error
        } = await supabase.from("projects").select("id").eq("lead_id", lead.id).eq("organization_id", organizationId);
        if (error) throw error;
        const projectsExist = (data || []).length > 0;
        setHasProjects(projectsExist);
        console.log('🔍 Projects check:', {
          leadId: lead.id,
          projectsExist,
          projectCount: (data || []).length
        });
      } catch (error) {
        console.error("Error checking projects:", error);
      }
    };
    checkProjects();
  }, [lead?.id, activityRefreshKey]); // Re-check when activity refreshes (which happens after project creation)

  // Dynamically update tutorial steps based on hasProjects
  const leadDetailsTutorialSteps: TutorialStep[] = useMemo(() => [{
    id: 4,
    title: "Welcome to Lead Details! 📋",
    description: "This is where you manage all information about a specific lead. Let's explore what you can see and do here:",
    content: <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Client Information</h4>
              <p className="text-sm text-muted-foreground">View and edit contact details, notes, and lead status on the left side.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FolderPlus className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Projects Section</h4>
              <p className="text-sm text-muted-foreground">This is where you'll convert leads into actual projects with timelines and deliverables.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Activity Timeline</h4>
              <p className="text-sm text-muted-foreground">Track all interactions, changes, and progress over time.</p>
            </div>
          </div>
        </div>,
    mode: "modal",
    canProceed: true
  }, {
    id: 5,
    title: "Create Your First Project",
    description: "Great! Now let's turn this lead into a project. Click the 'Add Project' button below to get started!",
    content: null,
    mode: "floating",
    canProceed: hasProjects,
    // Dynamic based on projects existence
    requiresAction: true,
    // Always require action for this step
    disabledTooltip: "Create a project first to continue"
  }, {
    id: 6,
    title: "Perfect! Now Explore Your Project Features",
    description: "Excellent! Click on the project card below to explore all the powerful project management features:",
    content: <div className="text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full"></span>
            <span>Track payments and billing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full"></span>
            <span>Manage photography sessions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full"></span>
            <span>Organize project todos and tasks</span>
          </div>
        </div>,
    mode: "floating",
    canProceed: hasViewedProject,
    // Dynamic based on whether user viewed project
    requiresAction: !hasViewedProject,
    // Only require action if hasn't viewed project
    disabledTooltip: hasViewedProject ? undefined : "Click on your project to continue"
  }, {
    id: 7,
    title: "🎉 Congratulations! Tutorial Complete!",
    description: "Amazing work! You've mastered the fundamentals - from creating leads and converting them to projects, to managing client details and tracking progress. You're now equipped with everything you need to grow your photography business efficiently.",
    content: <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800">You can access all your projects anytime from the Projects page in the sidebar!</p>
        </div>,
    mode: "modal",
    canProceed: true
  }], [hasProjects, hasViewedProject]);

  // Scheduling tutorial steps
  const schedulingTutorialSteps: TutorialStep[] = useMemo(() => [{
    id: 3,
    title: "Schedule Your Photo Session",
    description: "Perfect! Now let's schedule a photo session for this client. Click the 'Schedule Session' button below to open the scheduling form.",
    content: <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Session Scheduling</h4>
              <p className="text-sm text-muted-foreground">Choose date and time that works for both you and your client.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Calendar Integration</h4>
              <p className="text-sm text-muted-foreground">Sessions automatically sync with your calendar for better organization.</p>
            </div>
          </div>
        </div>,
    mode: "floating",
    canProceed: hasScheduledSession,
    requiresAction: !hasScheduledSession,
    disabledTooltip: "Schedule a session to continue"
  }, {
    id: 4,
    title: "🎉 Session Scheduled Successfully!",
    description: "Excellent! You've successfully scheduled your first photo session. You can now view and manage all your sessions from the Calendar page, and they'll appear in your session timeline here.",
    content: <div className="space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">Your session has been added to your calendar and you can find it in the Calendar page!</p>
          </div>
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Sessions appear in your lead's activity timeline</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Update session status as you progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Associate sessions with projects for better organization</span>
            </div>
          </div>
        </div>,
    mode: "modal",
    canProceed: true
  }], [hasScheduledSession]);

  // Check if we should show tutorial when component mounts
  useEffect(() => {
    const continueTutorial = location.state?.continueTutorial;
    const tutorialStep = location.state?.tutorialStep;
    const tutorialType = location.state?.tutorialType;
    
    console.log('🔍 LeadDetail tutorial check:', {
      continueTutorial,
      tutorialStep,
      tutorialType,
      locationState: location.state,
      currentStep,
      pathname: location.pathname
    });

    // Check if we should show tutorial either from navigation state OR onboarding progress
    const shouldShowFromState = continueTutorial && tutorialStep;
    const shouldShowFromProgress = currentStep === 2; // User completed first step, now on leads

    if (shouldShowFromState) {
      if (tutorialType === 'scheduling') {
        console.log('🚀 Starting scheduling tutorial from navigation state at step:', tutorialStep);
        setIsSchedulingTutorial(true);
        setShowTutorial(true);
        setCurrentTutorialStep(tutorialStep - 3); // Convert to 0-based index for scheduling steps
      } else {
        console.log('🚀 Starting lead details tutorial from navigation state at step:', tutorialStep);
        setShowTutorial(true);
        setCurrentTutorialStep(tutorialStep - 4); // Convert to 0-based index for our steps array
      }
    } else if (shouldShowFromProgress) {
      console.log('🚀 Starting lead details tutorial from onboarding progress');
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

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      if (isSchedulingTutorial) {
        // For scheduling tutorial, complete step 5 (scheduling step)
        await completeCurrentStep();
        setShowTutorial(false);
        console.log('🎉 Scheduling tutorial completed! Navigating back to getting-started');
        navigate('/getting-started');
      } else {
        // For regular lead details tutorial that includes project creation
        // Complete both Step 2 (leads) and Step 3 (projects) since this tutorial covers both
        await completeCurrentStep(); // Complete current step (Step 2)
        await completeCurrentStep(); // Complete next step (Step 3) since we created projects
        setShowTutorial(false);
        console.log('🎉 Lead details tutorial completed! Both Step 2 & 3 completed, navigating back to getting-started');
        navigate('/getting-started');
      }
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

  // Handle project clicked during tutorial
  const handleProjectClicked = () => {
    console.log('🔍 Project clicked - enabling Next button');
    setHasViewedProject(true);
  };

  const handleSessionScheduled = () => {
    console.log('🔍 Session scheduled - advancing tutorial');
    setHasScheduledSession(true);
    setActivityRefreshKey(prev => prev + 1); // Refresh activities to show new session
    fetchSessions();
  };

  // Debug tutorial step changes
  useEffect(() => {
    console.log('🔍 Tutorial step changed to:', currentTutorialStep, 'showTutorial:', showTutorial, 'step array length:', leadDetailsTutorialSteps.length);
    if (showTutorial && leadDetailsTutorialSteps[currentTutorialStep]) {
      console.log('🎯 Current tutorial step details:', leadDetailsTutorialSteps[currentTutorialStep]);
    }
  }, [currentTutorialStep, showTutorial]);

  // Check edit permissions when lead data loads
  useEffect(() => {
    const checkEditPermissions = async () => {
      if (lead) {
        const canEdit = await canEditLead(lead.user_id, lead.assignees);
        setUserCanEdit(canEdit);
      }
    };
    checkEditPermissions();
  }, [lead, canEditLead]);

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
          title: "Lead not found",
          description: "The requested lead could not be found.",
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
        title: "Error fetching lead",
        description: error.message,
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
        title: 'Success',
        description: 'Lead and all related data deleted successfully.'
      });
      navigate('/leads');
    } catch (error: any) {
      toast({
        title: 'Error deleting lead',
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
    try {
      const {
        error
      } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Session deleted successfully."
      });
      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error deleting session",
        description: error.message,
        variant: "destructive"
      });
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
      navigate(`/sessions/${selectedSessionId}`);
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
      console.log('🚀 Project created! Advancing tutorial from step', currentTutorialStep, 'to step 2 (Step 6)');
      // Use setTimeout to ensure state update happens after component re-render
      setTimeout(() => {
        setCurrentTutorialStep(2); // Move to "Now Explore Your Project" step (Step 6)
        console.log('✅ Tutorial step updated to:', 2);
      }, 100);
    } else {
      console.log('🔍 Not advancing tutorial. showTutorial:', showTutorial, 'currentTutorialStep:', currentTutorialStep, '(expected: 1 for Step 5)');
    }
  };
  const handleActivityUpdated = () => {
    // Force ActivitySection to refresh when activities are updated in project modal
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
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading lead details...</p>
        </div>
      </div>;
  }
  if (!lead) {
    return null;
  }
  return <div className="p-4 md:p-8 max-w-full overflow-x-hidden">
      <div className="mb-6">
        {/* Mobile/Tablet Layout */}
        <div className="flex flex-col gap-4 lg:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold truncate min-w-0">{lead.name || 'Lead Details'}</h1>
              <div className="flex-shrink-0">
                <LeadStatusBadge leadId={lead.id} currentStatusId={lead.status_id} currentStatus={lead.status} onStatusChange={() => {
                fetchLead();
                setActivityRefreshKey(prev => prev + 1);
              }} editable={true} statuses={leadStatuses} />
              </div>
            </div>
            
            {/* Assignees List - Mobile: separate row */}
            <div className="mt-3">
              <AssigneesList assignees={lead.assignees || []} entityType="lead" entityId={lead.id} onUpdate={() => {
              fetchLead();
              setActivityRefreshKey(prev => prev + 1);
            }} />
            </div>
          </div>
          
          <div className="flex-shrink-0">
            {/* Header Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {hasPermission('create_sessions') && <ScheduleSessionDialog leadId={lead.id} leadName={lead.name} onSessionScheduled={handleSessionScheduled} disabled={sessions.some(s => s.status === 'planned')} disabledTooltip="A planned session already exists." />}

              {!settingsLoading && userSettings.show_quick_status_buttons && completedStatus && formData.status !== completedStatus.name && <Button onClick={handleMarkAsCompleted} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white h-10 w-full sm:w-auto" size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isUpdating ? "Updating..." : completedStatus.name}
                </Button>}

              {!settingsLoading && userSettings.show_quick_status_buttons && lostStatus && formData.status !== lostStatus.name && <Button onClick={handleMarkAsLost} disabled={isUpdating} variant="destructive" size="sm" className="h-10 w-full sm:w-auto">
                  {isUpdating ? "Updating..." : lostStatus.name}
                </Button>}
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0 flex items-center gap-4">
            <h1 className="text-2xl font-bold truncate min-w-0">{lead.name || 'Lead Details'}</h1>
            <div className="flex-shrink-0">
              <LeadStatusBadge leadId={lead.id} currentStatusId={lead.status_id} currentStatus={lead.status} onStatusChange={() => {
              fetchLead();
              setActivityRefreshKey(prev => prev + 1);
            }} editable={true} statuses={leadStatuses} />
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Assignees List - Desktop: far right with stable container */}
            <div className="min-w-0 transition-all duration-300 ease-out transform">
              <AssigneesList assignees={lead.assignees || []} entityType="lead" entityId={lead.id} onUpdate={() => {
              fetchLead();
              setActivityRefreshKey(prev => prev + 1);
            }} />
            </div>
            
            {/* Header Action Buttons - Desktop: stays in place */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {hasPermission('create_sessions') && <ScheduleSessionDialog leadId={lead.id} leadName={lead.name} onSessionScheduled={handleSessionScheduled} disabled={sessions.some(s => s.status === 'planned')} disabledTooltip="A planned session already exists." />}

              {!settingsLoading && userSettings.show_quick_status_buttons && completedStatus && formData.status !== completedStatus.name && <Button onClick={handleMarkAsCompleted} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white h-10" size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isUpdating ? "Updating..." : completedStatus.name}
                </Button>}

              {!settingsLoading && userSettings.show_quick_status_buttons && lostStatus && formData.status !== lostStatus.name && <Button onClick={handleMarkAsLost} disabled={isUpdating} variant="destructive" size="sm" className="h-10">
                  {isUpdating ? "Updating..." : lostStatus.name}
                </Button>}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Sessions Section */}
      <EnhancedSessionsSection
        sessions={sessions}
        loading={loading}
        onSessionClick={handleSessionClick}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8 max-w-full">
        {/* Left column - Lead Details (25%) */}
        <div className="lg:col-span-1 space-y-6 min-w-0">
          <UnifiedClientDetails 
            lead={lead}
            showQuickActions={true}
            onLeadUpdated={() => {
              fetchLead();
              setActivityRefreshKey(prev => prev + 1);
            }}
          />
        </div>

        {/* Right column - Projects and Activity Section (75%) */}
        <div className="lg:col-span-3 space-y-6 min-w-0">
          <ProjectsSection leadId={lead.id} leadName={lead.name} onProjectUpdated={handleProjectUpdated} onActivityUpdated={handleActivityUpdated} onProjectClicked={handleProjectClicked} />
          <ActivitySection key={activityRefreshKey} leadId={lead.id} leadName={lead.name} />

          {hasPermission('delete_leads') && <div className="border border-destructive/20 bg-destructive/5 rounded-md p-4 max-w-full text-center">
              <div className="space-y-3">
                <Button variant="outline" onClick={() => setShowDeleteDialog(true)} className="w-full max-w-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Delete Lead
                </Button>
                <p className="text-xs text-muted-foreground break-words">
                  This will permanently delete the lead and ALL related data: projects, sessions, reminders/notes, payments, services, and activities.
                </p>
              </div>
            </div>}
        </div>
      </div>

      {/* Edit Session Dialog */}
      {editingSessionId && (() => {
      const session = sessions.find(s => s.id === editingSessionId);
      return session ? <EditSessionDialog sessionId={session.id} leadId={lead.id} currentDate={session.session_date} currentTime={session.session_time} currentNotes={session.notes} currentProjectId={session.project_id} leadName={lead.name} open={!!editingSessionId} onOpenChange={open => {
        if (!open) {
          setEditingSessionId(null);
        }
      }} onSessionUpdated={() => {
        handleSessionUpdated();
        setEditingSessionId(null);
      }} /> : null;
    })()}

      {/* Delete Session Dialog */}
      <AlertDialog open={!!deletingSessionId} onOpenChange={open => !open && setDeletingSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
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
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Type the lead's name ("{lead.name}") or DELETE to confirm. This will permanently delete the lead and ALL related data including projects, sessions, reminders/notes, payments, services, and activities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-delete" className="sr-only">Confirmation</Label>
            <Input id="confirm-delete" placeholder={`Type "${lead.name}" or "DELETE"`} value={confirmDeleteText} onChange={e => setConfirmDeleteText(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-2">This action cannot be undone.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting || ![lead.name, 'DELETE'].includes(confirmDeleteText.trim())} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete Lead'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Session Sheet View */}
      <SessionSheetView
        sessionId={selectedSessionId || ''}
        isOpen={isSessionSheetOpen}
        onOpenChange={setIsSessionSheetOpen}
        onViewFullDetails={handleViewFullSessionDetails}
        onNavigateToLead={handleNavigateToLead}
        onNavigateToProject={handleNavigateToProject}
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