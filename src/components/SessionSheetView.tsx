import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ExternalLink, MoreVertical, Edit, Trash2, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import EditSessionDialog from '@/components/EditSessionDialog';
import { useSessionActions } from '@/hooks/useSessionActions';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string | null;
  status: string;
  lead_id: string;
  project_id: string | null;
  user_id: string;
  google_event_id: string | null;
  leads?: {
    id: string;
    name: string;
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
}

export default function SessionSheetView({
  sessionId,
  isOpen,
  onOpenChange,
  onViewFullDetails,
  onNavigateToLead,
  onNavigateToProject,
}: SessionSheetViewProps) {
  const { toast } = useToast();
  const { deleteSession } = useSessionActions();
  
  const [session, setSession] = useState<Session | null>(null);
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
            name
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

  const getSessionName = () => {
    if (!session) return 'Session';
    
    // Use project type if available
    if (session.projects?.project_types?.name) {
      return `${session.projects.project_types.name} Session`;
    }
    
    // Fallback to generic "Session"
    return 'Session';
  };

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
  };

  const handleStatusChange = () => {
    fetchSession();
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
              <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-xl sm:text-2xl font-semibold">
                    {getSessionName()}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatLongDate(session.session_date)} at {formatTime(session.session_time)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onViewFullDetails}
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 px-2 gap-1 md:h-10 md:px-3"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm hidden md:inline">Full Details</span>
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-8 px-2 gap-1 md:h-10 md:px-3"
                      >
                        <span className="text-sm hidden md:inline">More</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Session
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
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
              </SheetHeader>

              <div className="py-6 space-y-6">
                {/* Session Details */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Session Details</h3>
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
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Session not found</h3>
              <p className="text-muted-foreground">Unable to load session details.</p>
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
          currentProjectId={session.project_id}
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