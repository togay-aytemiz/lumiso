import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit, ExternalLink, Calendar, User, FolderOpen, FileText, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSessionActions } from '@/hooks/useSessionActions';
import ProjectDetailsLayout from '@/components/project-details/ProjectDetailsLayout';
import { UnifiedClientDetails } from '@/components/UnifiedClientDetails';
import SessionGallery from '@/components/SessionGallery';
import { getDisplaySessionName } from '@/lib/sessionUtils';

interface Session {
  id: string;
  session_name: string | null;
  session_date: string;
  session_time: string;
  notes: string | null;
  location: string | null;
  status: string;
  lead_id: string;
  project_id: string | null;
  user_id: string;
  google_event_id: string | null;
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

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deleteSession } = useSessionActions();
  
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchSession = async () => {
    if (!id) return;
    
    console.log('SessionDetail: Starting to fetch session data for ID:', id);
    const startTime = performance.now();
    
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
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const endTime = performance.now();
      console.log(`SessionDetail: Fetch completed in ${endTime - startTime}ms`);
      
      setSession(data);
    } catch (error: any) {
      console.error('SessionDetail: Error fetching session:', error);
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
    console.log('SessionDetail: Component mounted, session ID:', id);
    fetchSession();
  }, [id]);


  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!session) return;
    
    const success = await deleteSession(session.id);
    if (success) {
      navigate('/sessions');
    }
  };

  const handleSessionUpdated = () => {
    fetchSession();
    setIsEditDialogOpen(false);
  };

  const handleStatusChange = () => {
    fetchSession();
  };

  const handleLeadClick = () => {
    if (session?.lead_id) {
      navigate(`/leads/${session.lead_id}`);
    }
  };

  const handleProjectClick = () => {
    if (session?.project_id) {
      navigate(`/projects/${session.project_id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Session not found</h2>
          <p className="text-muted-foreground mb-4">The session you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/sessions')}>
            Return to Sessions
          </Button>
        </div>
      </div>
    );
  }

  const header = (
    <div className="border-b bg-background">
      <div className="max-w-full mx-auto px-6 py-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="space-y-2">
                  {/* Desktop: Name + Badges on same line */}
                  <div className="hidden md:flex items-center gap-3 flex-wrap">
                    <ArrowLeft 
                      className="h-6 w-6 cursor-pointer text-foreground hover:text-[hsl(var(--accent-foreground))] transition-colors" 
                      strokeWidth={2.5}
                      onClick={() => navigate('/sessions')}
                    />
                     <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words text-left">
                       {getDisplaySessionName(session)}
                     </h1>
                    
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
                    <div className="flex items-center gap-3">
                      <ArrowLeft 
                        className="h-6 w-6 cursor-pointer text-foreground hover:text-[hsl(var(--accent-foreground))] transition-colors" 
                        strokeWidth={2.5}
                        onClick={() => navigate('/sessions')}
                      />
                       <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words text-left">
                         {getDisplaySessionName(session)}
                       </h1>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Layout: Badges */}
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
              variant="outline" 
              size="lg"
              onClick={handleEdit}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Session</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const leftContent = session.leads && (
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
  );

  const sessionDetailsCard = (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Session Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
              <p className="text-sm">
                {formatLongDate(session.session_date)} at {formatTime(session.session_time)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Client</label>
              <p className="text-sm">
                <button
                  onClick={handleLeadClick}
                  className="text-primary hover:underline"
                >
                  {session.leads?.name || 'Unknown Client'}
                </button>
              </p>
            </div>

            {session.projects && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Project</label>
                <p className="text-sm">
                  <button
                    onClick={handleProjectClick}
                    className="text-primary hover:underline"
                  >
                    {session.projects.name}
                  </button>
                </p>
              </div>
            )}

            {session.projects?.project_types && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Project Type</label>
                <p className="text-sm">{session.projects.project_types.name}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <SessionStatusBadge
                  sessionId={session.id}
                  currentStatus={session.status as any}
                  editable={true}
                  onStatusChange={handleStatusChange}
                />
              </div>
            </div>

            {session.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="text-sm">{session.notes}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const sections = [
    {
      id: 'session-gallery',
      title: 'Session Gallery',
      content: <SessionGallery sessionId={session.id} />
    }
  ];

  const dangerZone = (
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
  );

  const isOverdue = isOverdueSession(session.session_date, session.status);

  return (
    <div className="min-h-screen bg-background">
      {header}
      
      {/* Overdue Warning Bar */}
      {isOverdue && (
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-3">
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
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="bg-muted/30 rounded-lg p-4 mb-6">
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

        <ProjectDetailsLayout
          header={<></>}
          left={leftContent}
          sections={sections}
          rightFooter={dangerZone}
        />
      </div>

      {/* Edit Dialog */}
      {isEditDialogOpen && (
        <ErrorBoundary 
          onError={(error) => {
            console.error('Error in EditSessionDialog:', error);
            setIsEditDialogOpen(false);
          }}
        >
          <EditSessionDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            sessionId={session.id}
            leadId={session.lead_id}
            currentSessionName={session.session_name || ''}
            currentDate={session.session_date}
            currentTime={session.session_time}
            currentNotes={session.notes || ''}
            currentLocation={session.location || ''}
            currentProjectId={session.project_id}
            leadName={session.leads?.name || ''}
            onSessionUpdated={handleSessionUpdated}
          />
        </ErrorBoundary>
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
    </div>
  );
}