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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Save, Trash2, Calendar, Clock, FileText, CheckCircle, MoreHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ClientDetailsList from "@/components/ClientDetailsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ScheduleSessionDialog from "@/components/ScheduleSessionDialog";
import EditSessionDialog from "@/components/EditSessionDialog";
import ActivitySection from "@/components/ActivitySection";
import SessionBanner from "@/components/SessionBanner";
import { ProjectsSection } from "@/components/ProjectsSection";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { formatDate, cn } from "@/lib/utils";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useLeadStatusActions } from "@/hooks/useLeadStatusActions";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
  status_id?: string;
  created_at: string;
}

type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: SessionStatus;
  project_id?: string;
  project_name?: string;
}

// Helpers: validation and phone normalization (TR defaults)
const isValidEmail = (email?: string | null) => !!email && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);

function normalizeTRPhone(phone?: string | null): null | { e164: string; e164NoPlus: string } {
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
  return { e164, e164NoPlus: e164.slice(1) };
}

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [lead, setLead] = useState<Lead | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  
  // User settings and status actions
  const { settings: userSettings, loading: settingsLoading } = useUserSettings();
  const { markAsCompleted, markAsLost, isUpdating } = useLeadStatusActions({
    leadId: lead?.id || '',
    onStatusChange: () => {
      fetchLead();
      setActivityRefreshKey(prev => prev + 1);
    }
  });

  // UI state for Lead Information card
  const [editOpen, setEditOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const [isNotesTruncatable, setIsNotesTruncatable] = useState(false);


  // Get system status labels for buttons (refresh when leadStatuses changes)
  const completedStatus = leadStatuses.find(s => s.is_system_final && (s.name.toLowerCase().includes('completed') || s.name.toLowerCase().includes('delivered'))) || 
                          leadStatuses.find(s => s.name === 'Completed');
  const lostStatus = leadStatuses.find(s => s.is_system_final && (s.name.toLowerCase().includes('lost') || s.name.toLowerCase().includes('not interested'))) || 
                     leadStatuses.find(s => s.name === 'Lost');
  
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
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_statuses(id, name, color, is_system_final)
        `)
        .eq('id', id)
        .maybeSingle();

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
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          projects:project_id (
            name
          )
        `)
        .eq('lead_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Process sessions to include project name
      const processedSessions = (data || []).map(session => ({
        ...session,
        project_name: session.projects?.name || undefined
      }));

      // Sort sessions: planned first, then others by session_date descending
      const sortedSessions = processedSessions.sort((a, b) => {
        if (a.status === 'planned' && b.status !== 'planned') return -1;
        if (b.status === 'planned' && a.status !== 'planned') return 1;
        
        // For non-planned sessions, sort by session_date descending (newest first)
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

  // Detect if notes content is truncatable to 2 lines
  useEffect(() => {
    if (!notesRef.current || !lead?.notes) { setIsNotesTruncatable(false); return; }
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
      
      const { error } = await supabase
        .from('leads')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          notes: formData.notes.trim() || null,
          status: formData.status,
          status_id: selectedStatus?.id || null
        })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead updated successfully.",
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
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead deleted successfully.",
      });

      navigate("/leads");
    } catch (error: any) {
      toast({
        title: "Error deleting lead",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

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

  const handleSessionScheduled = () => {
    fetchSessions();
  };

  const handleSessionUpdated = () => {
    fetchSessions();
  };

  const handleProjectUpdated = () => {
    // Refresh sessions to get updated project names in session cards
    fetchSessions();
    // Force ActivitySection to refresh by updating its key
    setActivityRefreshKey(prev => prev + 1);
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{lead.name || 'Lead Details'}</h1>
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
            </div>
            <p className="text-muted-foreground">Edit lead information</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Header Action Buttons */}
            <div className="flex flex-wrap gap-2 lg:gap-4">
              <ScheduleSessionDialog 
                leadId={lead.id} 
                leadName={lead.name}
                onSessionScheduled={handleSessionScheduled}
                disabled={sessions.some(s => s.status === 'planned')}
                disabledTooltip="A planned session already exists."
              />

              {!settingsLoading && userSettings.show_quick_status_buttons && completedStatus && formData.status !== completedStatus.name && (
                <Button 
                  onClick={handleMarkAsCompleted}
                  disabled={isUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white h-10"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isUpdating ? "Updating..." : completedStatus.name}
                </Button>
              )}

              {!settingsLoading && userSettings.show_quick_status_buttons && lostStatus && formData.status !== lostStatus.name && (
                <Button 
                  onClick={handleMarkAsLost}
                  disabled={isUpdating}
                  variant="destructive"
                  size="sm"
                  className="h-10"
                >
                  {isUpdating ? "Updating..." : lostStatus.name}
                </Button>
              )}
            </div>

            {/* More Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the lead
                        "{lead.name}" and remove all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting..." : "Delete Lead"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Sessions Section */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id}>
                <SessionBanner 
                  session={session} 
                  leadName={lead.name}
                  projectName={session.project_name}
                  onStatusUpdate={handleSessionUpdated}
                  onEdit={() => setEditingSessionId(session.id)}
                  onDelete={() => setDeletingSessionId(session.id)}
                />
                
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left column - Lead Details (25%) */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="relative">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Client Details</CardTitle>
                <CardDescription className="text-xs">
                  Created on {formatDate(lead.created_at)}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFormData({
                    name: lead.name || "",
                    email: lead.email || "",
                    phone: lead.phone || "",
                    notes: lead.notes || "",
                    status: lead.status || formData.status,
                  });
                  setInitialFormData({
                    name: lead.name || "",
                    email: lead.email || "",
                    phone: lead.phone || "",
                    notes: lead.notes || "",
                    status: lead.status || formData.status,
                  });
                  setEditOpen(true);
                }}
                aria-label="Edit lead information"
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-sm h-8 px-2"
              >
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <ClientDetailsList
                name={lead.name}
                email={lead.email}
                phone={lead.phone}
                notes={lead.notes}
                showQuickActions
              />
            </CardContent>
          </Card>

          {/* Edit Lead Modal */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Edit Lead</DialogTitle>
                <DialogDescription>Update lead details below.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      await handleSave();
                      setEditOpen(false);
                    }}
                    disabled={saving || !hasChanges}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right column - Projects and Activity Section (75%) */}
        <div className="lg:col-span-3 space-y-6">
          <ProjectsSection 
            leadId={lead.id} 
            leadName={lead.name} 
            onProjectUpdated={handleProjectUpdated}
            onActivityUpdated={handleActivityUpdated}
          />
          <ActivitySection key={activityRefreshKey} leadId={lead.id} leadName={lead.name} />
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
            leadName={lead.name}
            open={!!editingSessionId}
            onOpenChange={(open) => {
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
      <AlertDialog open={!!deletingSessionId} onOpenChange={(open) => !open && setDeletingSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deletingSessionId) {
                  handleDeleteSession(deletingSessionId);
                  setDeletingSessionId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadDetail;