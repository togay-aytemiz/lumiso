import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Edit, X, AlertTriangle, Calendar, FolderOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SessionStatusBadge from '@/components/SessionStatusBadge';
import { formatLongDate, formatTime } from '@/lib/utils';
import { isOverdueSession } from '@/lib/dateUtils';
import EditSessionDialog from '@/components/EditSessionDialog';
import { useSessionActions } from '@/hooks/useSessionActions';
import { UnifiedClientDetails } from '@/components/UnifiedClientDetails';
import SessionGallery from '@/components/SessionGallery';
import { getDisplaySessionName } from '@/lib/sessionUtils';
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface SessionData {
  id: string;
  session_name?: string | null;
  session_date: string;
  session_time: string;
  notes: string | null;
  location: string | null;
  status: string;
  lead_id: string;
  project_id: string | null;
  user_id: string;
  google_event_id?: string | null; // Make optional since it's not always returned
  leads?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  };
  projects?: {
    id: string;
    name: string;
    project_types?: {
      name: string;
    };
  };
}

interface SessionSheetViewProps {
  sessionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onViewFullDetails: () => void;
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
  onSessionUpdated?: () => void; // Added callback for session updates
}

export default function SessionSheetView({
  sessionId,
  isOpen,
  onOpenChange,
  onViewFullDetails,
  onNavigateToLead,
  onNavigateToProject,
  onSessionUpdated,
}: SessionSheetViewProps) {
  const { toast } = useToast();
  const { deleteSession } = useSessionActions();
  const navigate = useNavigate();
  const { t: tForms } = useFormsTranslation();
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchSession = async () => {
    if (!sessionId) return;
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          leads:lead_id (
            id,
            name,
            email,
            phone,
            notes
          ),
          projects:project_id (
            id,
            name,
            project_types (
              name
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);
    } catch (error: any) {
      console.error('Error fetching session:', error);
      toast({
        title: "Error",
        description: "Failed to load session details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchSession();
    }
  }, [isOpen, sessionId]);


  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!session) return;
    
    const success = await deleteSession(session.id);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleSessionUpdated = () => {
    fetchSession();
    setIsEditDialogOpen(false);
    onSessionUpdated?.(); // Notify parent components
  };

  const handleStatusChange = () => {
    fetchSession();
    onSessionUpdated?.(); // Notify parent components
  };

  const handleLeadClick = () => {
    if (session?.lead_id && onNavigateToLead) {
      onNavigateToLead(session.lead_id);
      onOpenChange(false);
    }
  };

  const handleProjectClick = () => {
    if (session?.project_id && onNavigateToProject) {
      onNavigateToProject(session.project_id);
      onOpenChange(false);
    }
  };

  const handleSessionClick = () => {
    navigate(`/sessions/${sessionId}`);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-5xl h-[100vh] overflow-y-auto overscroll-contain pr-2 pt-8 sm:pt-6">
          {loading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-32 bg-muted rounded"></div>
              </div>
            </div>
          ) : session ? (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="space-y-2">
                          {/* Desktop: Name + Badges on same line */}
                          <div className="hidden md:flex items-center gap-3 flex-wrap">
                             <SheetTitle className="text-xl sm:text-2xl font-bold leading-tight break-words text-left">
                               {getDisplaySessionName(session)}
                             </SheetTitle>
                            
                            {/* Session Status and Project Type Badges next to name - Desktop only */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <SessionStatusBadge
                                sessionId={session.id}
                                currentStatus={session.status as any}
                                editable={true}
                                onStatusChange={handleStatusChange}
                                className="text-sm"
                              />
                              
                              {session.projects?.project_types && (
                                <Badge variant="outline" className="text-xs">
                                  {session.projects.project_types.name.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Mobile: Name only */}
                          <div className="md:hidden">
                             <SheetTitle className="text-xl sm:text-2xl font-bold leading-tight break-words text-left">
                               {getDisplaySessionName(session)}
                             </SheetTitle>
                          </div>
                        </div>
                        
                        {/* Mobile Layout: Badges then Session Details */}
                        <div className="md:hidden space-y-4 mt-6">
                          {/* Stage and Type badges for mobile */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <SessionStatusBadge
                              sessionId={session.id}
                              currentStatus={session.status as any}
                              editable={true}
                              onStatusChange={handleStatusChange}
                              className="text-sm"
                            />
                            
                            {session.projects?.project_types && (
                              <Badge variant="outline" className="text-xs">
                                {session.projects.project_types.name.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 self-start">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onViewFullDetails}
                      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 px-2 gap-1 md:h-10 md:px-3"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="text-sm hidden md:inline">Full Details</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleEdit}
                      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 px-2 gap-1 md:h-10 md:px-3"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="text-sm hidden md:inline">Edit</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onOpenChange(false)} 
                      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground text-sm h-8 px-2 md:h-10 md:px-3"
                    >
                      <span className="hidden md:inline">Close</span>
                      <X className="h-4 w-4 md:hidden" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Overdue Warning Bar */}
              {session && isOverdueSession(session.session_date, session.status) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
                  <div className="flex items-center gap-3 text-orange-800">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">This session is overdue</p>
                      <p className="text-sm text-orange-700">Please update the session status or reschedule if needed.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Session Summary Details - Above Grid */}
              <div className="mb-6 bg-muted/30 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 text-sm">
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <label className="font-medium text-muted-foreground">Date & Time</label>
                    </div>
                    <p>{formatLongDate(session.session_date)} at {formatTime(session.session_time)}</p>
                  </div>

                  {session.projects && (
                    <>
                      <div className="hidden sm:block w-px h-12 bg-border"></div>
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <label className="font-medium text-muted-foreground">Project</label>
                        </div>
                        <button
                          onClick={handleProjectClick}
                          className="text-primary hover:underline"
                        >
                          {session.projects.name}
                        </button>
                      </div>
                    </>
                  )}

                  {(session.notes || session.location) && (
                    <>
                      <div className="hidden sm:block w-px h-12 bg-border"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                          {session.notes && (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <label className="font-medium text-muted-foreground">Notes</label>
                              </div>
                              <div className="relative group">
                                <p className="line-clamp-2 cursor-help">{session.notes}</p>
                                <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-popover border border-border rounded-md shadow-md p-3 max-w-md whitespace-pre-wrap text-sm">
                                  {session.notes}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {session.notes && session.location && (
                            <div className="hidden sm:block w-px h-12 bg-border"></div>
                          )}
                          
                          {session.location && (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <label className="font-medium text-muted-foreground">Location</label>
                              </div>
                              <div className="relative group">
                                <p className="line-clamp-2 cursor-help">{session.location}</p>
                                <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-popover border border-border rounded-md shadow-md p-3 max-w-md whitespace-pre-wrap text-sm">
                                  {session.location}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-12 gap-4 md:gap-6 w-full max-w-full overflow-hidden">
                {/* Left summary column */}
                <aside className="col-span-12 lg:col-span-4 min-w-0">
                  <div className="h-fit space-y-4 w-full max-w-full">
                    {session.leads && (
                      <UnifiedClientDetails
                        lead={{
                          id: session.leads.id,
                          name: session.leads.name,
                          email: session.leads.email,
                          phone: session.leads.phone,
                          notes: session.leads.notes,
                        }}
                        title="Client Details"
                        showQuickActions={true}
                        showClickableNames={true}
                      />
                    )}
                  </div>
                </aside>

                {/* Right detail column */}
                <main className="col-span-12 lg:col-span-8 min-w-0">
                  <div className="space-y-6 md:space-y-8 w-full max-w-full">
                    <section className="scroll-mt-[88px] w-full max-w-full overflow-hidden">
                      <div className="w-full max-w-full">
                        <SessionGallery sessionId={session.id} />
                      </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="scroll-mt-[88px] w-full max-w-full overflow-hidden">
                      <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-6">
                        <div className="space-y-4">
                          <h3 className="font-medium text-destructive">Danger Zone</h3>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsDeleteDialogOpen(true)}
                            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            size="lg"
                          >
                            Delete Session
                          </Button>
                          <p className="text-sm text-muted-foreground text-center">
                            This will permanently delete the session and all related data.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                </main>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">{tForms('sessions.sessionNotFound')}</h3>
              <p className="text-muted-foreground">{tForms('sessions.unableToLoadDetails')}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      {session && isEditDialogOpen && (
        <EditSessionDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          sessionId={session.id}
          leadId={session.lead_id}
          currentDate={session.session_date}
          currentTime={session.session_time}
          currentNotes={session.notes || ''}
          currentLocation={session.location || ''}
          currentProjectId={session.project_id}
          currentSessionName={session.session_name}
          leadName={session.leads?.name || ''}
          onSessionUpdated={handleSessionUpdated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}