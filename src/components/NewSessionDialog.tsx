import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Search, ChevronDown, Check } from "lucide-react";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  sessionStatus: 'none' | 'planned' | 'completed';
  hasScheduledSession: boolean;
}

interface NewSessionDialogProps {
  onSessionScheduled?: () => void;
  children?: React.ReactNode;
}

const NewSessionDialog = ({ onSessionScheduled, children }: NewSessionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const { createSessionEvent } = useCalendarSync();
  const { triggerSessionScheduled } = useWorkflowTriggers();
  const { scheduleSessionReminders } = useSessionReminderScheduling();
  const { t: tForms } = useFormsTranslation();
  const { t: tCommon } = useCommonTranslation();
  
  const [sessionData, setSessionData] = useState({
    session_date: "",
    session_time: "",
    notes: "",
    location: ""
  });

  const [newLeadData, setNewLeadData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: ""
  });

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open]);

  // Fetch projects when a lead is selected
  useEffect(() => {
    if (selectedLeadId && !isNewLead) {
      fetchProjects(selectedLeadId);
    } else {
      setProjects([]);
      setSelectedProjectId("");
    }
  }, [selectedLeadId, isNewLead]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      // First get all leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, name, email, phone')
        .order('name', { ascending: true });

      if (leadsError) throw leadsError;

      // Then get sessions for these leads
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('lead_id, status');

      if (sessionsError) throw sessionsError;

      // Process leads to determine session status
      const processedLeads = (leadsData || []).map(lead => {
        const leadSessions = sessionsData?.filter(session => session.lead_id === lead.id) || [];
        const hasScheduledSession = leadSessions.some(session => session.status === 'planned');
        const hasCompletedSession = leadSessions.some(session => session.status === 'completed');
        
        let sessionStatus: 'none' | 'planned' | 'completed' = 'none';
        if (hasScheduledSession) {
          sessionStatus = 'planned';
        } else if (hasCompletedSession) {
          sessionStatus = 'completed';
        }
        
        return {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          sessionStatus,
          hasScheduledSession
        };
      });
      
      setLeads(processedLeads);
    } catch (error: any) {
      toast({
        title: tCommon('status.error'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchProjects = async (leadId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('lead_id', leadId)
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      setProjects(projectsData || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const handleSubmit = async () => {
    if (!sessionData.session_date || !sessionData.session_time) {
      toast({
        title: tCommon('status.error'),
        description: tForms('validation.session_date_time_required'),
        variant: "destructive"
      });
      return;
    }

    if (!isNewLead && !selectedLeadId) {
      toast({
        title: tCommon('status.error'),
        description: tForms('validation.lead_required'),
        variant: "destructive"
      });
      return;
    }

    if (isNewLead && !newLeadData.name.trim()) {
      toast({
        title: tCommon('status.error'),
        description: tForms('validation.lead_name_required'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');

      if (!organizationId) {
        throw new Error("Organization required");
      }

      let leadId = selectedLeadId;

      // Create new lead if needed
      if (isNewLead) {
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            user_id: user.id,
            organization_id: organizationId,
            name: newLeadData.name.trim(),
            email: newLeadData.email.trim() || null,
            phone: newLeadData.phone.trim() || null,
            notes: newLeadData.notes.trim() || null,
            status: 'booked'
          })
          .select('id')
          .single();

        if (leadError) throw leadError;
        leadId = newLead.id;
      } else {
        // Update existing lead status to booked
        const { error: updateError } = await supabase
          .from('leads')
          .update({ status: 'booked' })
          .eq('id', selectedLeadId);

        if (updateError) throw updateError;
      }

      // Create session
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          lead_id: leadId,
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          notes: sessionData.notes.trim() || null,
          location: sessionData.location.trim() || null,
          project_id: selectedProjectId || null
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // Get lead name for calendar sync
      const leadName = isNewLead ? newLeadData.name : leads.find(l => l.id === leadId)?.name || 'Unknown Client';
      
      // Sync to Google Calendar
      if (newSession) {
        createSessionEvent(
          {
            id: newSession.id,
            lead_id: leadId,
            session_date: sessionData.session_date,
            session_time: sessionData.session_time,
            notes: sessionData.notes.trim() || undefined
          },
          { name: leadName }
        );
      }

      // Trigger workflow for session scheduled
      try {
        const workflowResult = await triggerSessionScheduled(newSession.id, organizationId, {
          session_date: sessionData.session_date,
          session_time: sessionData.session_time,
          location: sessionData.location,
          client_name: leadName,
          lead_id: leadId,
          project_id: selectedProjectId,
          status: 'planned'
        });
      } catch (workflowError) {
        console.error('❌ Error triggering session_scheduled workflow:', workflowError);
        toast({
          title: tForms('sessions.warningTitle'),
          description: tForms('sessions.sessionCreatedWarning'),
          variant: "default"
        });
      }

      // Schedule session reminders
      try {
        await scheduleSessionReminders(newSession.id);
      } catch (reminderError) {
        console.error('❌ Error scheduling session reminders:', reminderError);
        // Don't block session creation if reminder scheduling fails
      }

      toast({
        title: tCommon('actions.success'),
        description: tCommon('messages.success.save'),
      });

      // Reset form and close dialog
      setSessionData({
        session_date: "",
        session_time: "",
        notes: "",
        location: ""
      });
      setNewLeadData({
        name: "",
        email: "",
        phone: "",
        notes: ""
      });
      setSelectedLeadId("");
      setSelectedProjectId("");
      setIsNewLead(false);
      setOpen(false);
      
      // Notify parent component
      if (onSessionScheduled) {
        onSessionScheduled();
      }
    } catch (error: any) {
      console.error('❌ CRITICAL ERROR in session creation:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack?.substring(0, 500)
      });
      
      toast({
        title: tCommon('status.error'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSessionDataChange = (field: keyof typeof sessionData, value: string) => {
    setSessionData(prev => ({
      ...prev,
      [field]: value
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
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isDirty = Boolean(
    sessionData.session_date.trim() ||
    sessionData.session_time.trim() ||
    sessionData.notes.trim() ||
    sessionData.location.trim() ||
    (isNewLead && (newLeadData.name.trim() || newLeadData.email.trim() || newLeadData.phone.trim() || newLeadData.notes.trim())) ||
    (!isNewLead && selectedLeadId)
  );

  const handleDirtyClose = () => {
    if (window.confirm(tCommon('messages.confirm.unsaved_changes'))) {
      setSessionData({
        session_date: "",
        session_time: "",
        notes: "",
        location: ""
      });
      setNewLeadData({
        name: "",
        email: "",
        phone: "",
        notes: ""
      });
      setSelectedLeadId("");
      setSelectedProjectId("");
      setIsNewLead(false);
      setOpen(false);
    }
  };

  const footerActions = [
    {
      label: tCommon('buttons.cancel'),
      onClick: () => setOpen(false),
      variant: "outline" as const,
      disabled: loading
    },
    {
      label: loading ? tCommon('actions.saving') : tCommon('buttons.save'),
      onClick: handleSubmit,
      disabled: loading || !sessionData.session_date || !sessionData.session_time || (!selectedLeadId && !newLeadData.name.trim()),
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
        <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {tCommon('buttons.add')}
        </Button>
      )}

      <AppSheetModal
        title={tForms('sessions.schedule_new')}
        isOpen={open}
        onOpenChange={setOpen}
        size="lg"
        dirty={isDirty}
        onDirtyClose={handleDirtyClose}
        footerActions={footerActions}
      >
        <div className="grid gap-4">
          {/* Lead Selection */}
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
              <Label htmlFor="existing-lead">{tForms('sessions.select_existing_client')}</Label>
            </div>
            
            {!isNewLead && (
              <div className="space-y-2">
                <Label htmlFor="lead-search">{tForms('labels.select_client')}</Label>
                <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={dropdownOpen}
                      className="w-full justify-between text-left h-auto min-h-[40px]"
                      disabled={loadingLeads}
                    >
                      {selectedLeadId ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col">
                            <span className="font-medium">{leads.find(lead => lead.id === selectedLeadId)?.name}</span>
                            {leads.find(lead => lead.id === selectedLeadId)?.email && (
                              <span className="text-xs text-muted-foreground">{leads.find(lead => lead.id === selectedLeadId)?.email}</span>
                            )}
                          </div>
                          {leads.find(lead => lead.id === selectedLeadId) && (
                            <Badge
                              variant={
                                leads.find(lead => lead.id === selectedLeadId)?.sessionStatus === 'planned' ? 'destructive' :
                                leads.find(lead => lead.id === selectedLeadId)?.sessionStatus === 'completed' ? 'secondary' : 'outline'
                              }
                              className="text-xs"
                            >
                             {leads.find(lead => lead.id === selectedLeadId)?.sessionStatus === 'none' ? tForms('sessions.available') : 
                              leads.find(lead => lead.id === selectedLeadId)?.sessionStatus === 'planned' ? tForms('sessions.scheduled') :
                              leads.find(lead => lead.id === selectedLeadId)?.sessionStatus === 'completed' ? tForms('sessions.completed') :
                              leads.find(lead => lead.id === selectedLeadId)?.sessionStatus}
                            </Badge>
                          )}
                        </div>
                      ) : loadingLeads ? (
                        tForms('sessions.loading_clients')
                      ) : (
                        tForms('placeholders.select_client_placeholder')
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
                    <div className="p-3 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder={tForms('placeholders.search_by_name_or_email')}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {loadingLeads ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {tForms('sessions.loading_clients')}
                        </div>
                      ) : filteredLeads.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {searchTerm ? tForms('sessions.no_clients_match') : tForms('sessions.no_clients_found')}
                        </div>
                      ) : (
                        filteredLeads.map((lead) => (
                          <div
                            key={lead.id}
                            onClick={() => {
                              if (!lead.hasScheduledSession) {
                                setSelectedLeadId(lead.id);
                                setDropdownOpen(false);
                                setSearchTerm("");
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0",
                              lead.hasScheduledSession && "opacity-50 cursor-not-allowed hover:bg-transparent",
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
                              <div className="flex flex-col">
                                <span className="font-medium">{lead.name}</span>
                                {lead.email && (
                                  <span className="text-xs text-muted-foreground">{lead.email}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                               <Badge
                                 variant={
                                   lead.sessionStatus === 'planned' ? 'destructive' :
                                   lead.sessionStatus === 'completed' ? 'secondary' : 'outline'
                                 }
                                 className="text-xs"
                               >
                                 {lead.sessionStatus === 'none' ? tForms('sessions.available') : 
                                  lead.sessionStatus === 'planned' ? tForms('sessions.scheduled') :
                                  lead.sessionStatus === 'completed' ? tForms('sessions.completed') :
                                  lead.sessionStatus}
                               </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
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
              <Label htmlFor="new-lead">{tForms('sessions.create_new_client')}</Label>
            </div>

            {isNewLead && (
              <div className="space-y-3 pl-6 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="new-name">{tForms('labels.name')} *</Label>
                  <Input
                    id="new-name"
                    value={newLeadData.name}
                    onChange={(e) => handleNewLeadDataChange("name", e.target.value)}
                    placeholder={tForms('placeholders.enterName')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">{tForms('labels.email')}</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newLeadData.email}
                    onChange={(e) => handleNewLeadDataChange("email", e.target.value)}
                    placeholder={tForms('placeholders.enterEmail')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-phone">{tForms('labels.phone')}</Label>
                  <Input
                    id="new-phone"
                    value={newLeadData.phone}
                    onChange={(e) => handleNewLeadDataChange("phone", e.target.value)}
                    placeholder={tForms('placeholders.enterPhone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-notes">{tForms('labels.notes')}</Label>
                  <Textarea
                    id="new-notes"
                    value={newLeadData.notes}
                    onChange={(e) => handleNewLeadDataChange("notes", e.target.value)}
                    placeholder={tForms('placeholders.additionalNotes')}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Session Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">{tForms('labels.session_date')} & {tForms('labels.session_time')}</h4>
            
            <div className="space-y-2">
              <Label htmlFor="session_date">{tForms('labels.session_date')} *</Label>
              <Input
                id="session_date"
                type="date"
                value={sessionData.session_date}
                onChange={(e) => handleSessionDataChange("session_date", e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_time">{tForms('labels.session_time')} *</Label>
              <Input
                id="session_time"
                type="time"
                value={sessionData.session_time}
                onChange={(e) => handleSessionDataChange("session_time", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_location">{tForms('labels.location')}</Label>
              <Textarea
                id="session_location"
                value={sessionData.location}
                onChange={(e) => handleSessionDataChange("location", e.target.value)}
                placeholder={tForms('placeholders.enter_location')}
                rows={2}
              />
            </div>

            {/* Project selection - only show for existing leads */}
            {!isNewLead && selectedLeadId && (
              <div className="space-y-2">
                <Label htmlFor="project">{tForms('sessions.select_project')}</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={projects.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={projects.length === 0 ? tForms('sessions.no_projects') : tForms('sessions.select_project')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="session_notes">{tForms('labels.notes')}</Label>
              <Textarea
                id="session_notes"
                value={sessionData.notes}
                onChange={(e) => handleSessionDataChange("notes", e.target.value)}
                placeholder={tForms('placeholders.enterNotes')}
                rows={3}
              />
            </div>
          </div>
        </div>
      </AppSheetModal>
    </>
  );
};

export default NewSessionDialog;