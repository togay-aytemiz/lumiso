import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MoreVertical, Edit, Trash2, ExternalLink, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        .eq('id', id)
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
    fetchSession();
  }, [id]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="max-w-full mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <ArrowLeft 
                    className="h-6 w-6 cursor-pointer text-foreground hover:text-[hsl(var(--accent-foreground))] transition-colors" 
                    strokeWidth={2.5}
                    onClick={() => navigate('/sessions')}
                  />
                  <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">
                    {getSessionName()}
                  </h1>
                  
                  {/* Session Status and Project Type Badges */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <SessionStatusBadge
                      sessionId={session.id}
                      currentStatus={session.status as any}
                      editable={true}
                      onStatusChange={handleStatusChange}
                      className="text-sm"
                    />
                    
                    {session.projects?.project_types && (
                      <Badge variant="outline" className="text-sm px-3 py-1">
                        {session.projects.project_types.name.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Session Date & Time */}
                <p className="text-muted-foreground text-lg">
                  {formatLongDate(session.session_date)} at {formatTime(session.session_time)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 self-start">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="gap-2"
                  >
                    <span>More Actions</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Session</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Session</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full mx-auto px-6 py-6 space-y-6">
        {/* Session Details */}
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
      </div>

      {/* Edit Dialog */}
      {isEditDialogOpen && (
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
    </div>
  );
}