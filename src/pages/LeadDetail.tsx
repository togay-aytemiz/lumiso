import { useState, useEffect, useMemo } from "react";
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
import ScheduleSessionDialog from "@/components/ScheduleSessionDialog";
import EditSessionDialog from "@/components/EditSessionDialog";
import ActivitySection from "@/components/ActivitySection";
import SessionBanner from "@/components/SessionBanner";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import Layout from "@/components/Layout";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  due_date: string;
  notes: string;
  status: string;
  created_at: string;
}

type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: SessionStatus;
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
  const [deletingSession, setDeletingSession] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    due_date: "",
    notes: "",
    status: "new" as string
  });

  // Track initial form data to detect changes
  const [initialFormData, setInitialFormData] = useState({
    name: "",
    email: "",
    phone: "",
    due_date: "",
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
    }
  }, [id]);

  const fetchLead = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
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
        due_date: data.due_date || "",
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
      // Get all sessions for this lead
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Sort sessions: planned first, then others by session_date descending
      const sortedSessions = (data || []).sort((a, b) => {
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
      const { error } = await supabase
        .from('leads')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          due_date: formData.due_date || null,
          notes: formData.notes.trim() || null,
          status: formData.status as any
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

  const handleMarkAsCompleted = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'completed' })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead marked as completed.",
      });

      // Refresh lead data
      await fetchLead();
      await fetchSessions();
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

  const handleMarkAsLost = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'lost' })
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead marked as lost.",
      });

      // Refresh lead data
      await fetchLead();
      await fetchSessions();
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

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
    { value: "proposal_sent", label: "Proposal Sent" },
    { value: "booked", label: "Booked" },
    { value: "completed", label: "Completed" },
    { value: "lost", label: "Lost" }
  ];


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
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{lead.name || 'Lead Details'}</h1>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getLeadStatusStyles(lead.status).className}`}>
                  {formatStatusText(lead.status)}
                </span>
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

                {formData.status !== "completed" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white h-10"
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Completed
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mark Lead as Completed?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to mark "{lead.name}" as completed? This will update the lead's status to "Completed".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleMarkAsCompleted}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {saving ? "Updating..." : "Completed"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {formData.status !== "lost" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        disabled={saving}
                        variant="destructive"
                        size="sm"
                        className="h-10"
                      >
                        Lost
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mark Lead as Lost?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to mark "{lead.name}" as lost? This will update the lead's status to "Lost".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleMarkAsLost}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {saving ? "Updating..." : "Lost"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                    onStatusUpdate={handleSessionUpdated}
                  />
                  <div className="flex gap-2 mt-3 justify-end">
                    {session.status === 'planned' && (
                      <EditSessionDialog
                        sessionId={session.id}
                        currentDate={session.session_date}
                        currentTime={session.session_time}
                        currentNotes={session.notes}
                        leadName={lead.name}
                        onSessionUpdated={handleSessionUpdated}
                      />
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Session
                        </Button>
                      </AlertDialogTrigger>
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
                            onClick={() => handleDeleteSession(session.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Session
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left column - Lead Details (25%) */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Information</CardTitle>
                <CardDescription>
                  Created on {new Date(lead.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Enter lead name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
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

                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => handleInputChange("due_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      placeholder="Enter any notes about this lead"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Save Changes Button - Full width, primary styling */}
                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || !hasChanges}
                    size="sm"
                    className="w-full"
                    variant={hasChanges ? "default" : "secondary"}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Right column - Activity Section (75%) */}
          <div className="lg:col-span-3">
            <ActivitySection leadId={lead.id} leadName={lead.name} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeadDetail;