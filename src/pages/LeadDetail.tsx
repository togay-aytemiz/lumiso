import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Calendar, Clock, FileText, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ScheduleSessionDialog from "@/components/ScheduleSessionDialog";
import EditSessionDialog from "@/components/EditSessionDialog";

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

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: string;
}

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [lead, setLead] = useState<Lead | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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
      fetchSession();
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

  const fetchSession = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('lead_id', id)
        .eq('status', 'scheduled')
        .maybeSingle();

      if (error) throw error;
      setSession(data);
    } catch (error: any) {
      console.error('Error fetching session:', error);
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
      await fetchSession();
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

  const handleDeleteSession = async () => {
    if (!session) return;

    setDeletingSession(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session deleted successfully."
      });

      setSession(null);
    } catch (error: any) {
      toast({
        title: "Error deleting session",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeletingSession(false);
    }
  };

  const handleSessionScheduled = () => {
    fetchSession();
  };

  const handleSessionUpdated = () => {
    fetchSession();
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
      await fetchSession();
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-2">
            <Button 
              onClick={handleBack} 
              variant="outline" 
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {location.state?.from === 'dashboard' ? 'Back to Dashboard' : 
               location.state?.from === 'all-sessions' ? 'Back to All Sessions' : 'Back to All Leads'}
            </Button>
          </div>
          
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Lead Details</h1>
              <p className="text-muted-foreground">Edit lead information</p>
            </div>
            
            {/* Header Action Buttons */}
            <div className="flex flex-wrap gap-2 lg:gap-4">
              {!session && (
                <ScheduleSessionDialog 
                  leadId={lead.id} 
                  leadName={lead.name}
                  onSessionScheduled={handleSessionScheduled}
                />
              )}
              
              <Button 
                onClick={handleSave} 
                disabled={saving || !hasChanges}
                variant="secondary"
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>

              {formData.status !== "completed" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Completed
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
                        {saving ? "Updating..." : "Mark as Completed"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
            <CardDescription>
              Update the lead's details below. Created on {new Date(lead.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
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
                  rows={4}
                />
              </div>
            </div>

            {/* Session Information */}
            {session ? (
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Scheduled Session</h3>
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Date:</span>
                    <span>{new Date(session.session_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Time:</span>
                    <span>{session.session_time}</span>
                  </div>
                  {session.notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="font-medium">Notes:</span>
                      <span className="flex-1">{session.notes}</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <EditSessionDialog
                      sessionId={session.id}
                      currentDate={session.session_date}
                      currentTime={session.session_time}
                      currentNotes={session.notes}
                      onSessionUpdated={handleSessionUpdated}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={deletingSession}>
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
                            onClick={handleDeleteSession}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingSession ? "Deleting..." : "Delete Session"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Delete Lead - Keep at bottom as destructive action */}
            <div className="flex justify-start pt-6 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={deleting}
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Lead
                  </Button>
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
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LeadDetail;