import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, AlertTriangle, Calendar as CalendarIcon, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import SessionStatusBadge from '@/components/SessionStatusBadge';
import { isOverdueSession } from '@/lib/dateUtils';
import EditSessionDialog from '@/components/EditSessionDialog';
import type { SessionPlanningStepId } from '@/features/session-planning';
import { useSessionActions } from '@/hooks/useSessionActions';
import { UnifiedClientDetails } from '@/components/UnifiedClientDetails';
import SessionGallery from '@/components/SessionGallery';
import { getDisplaySessionName } from '@/lib/sessionUtils';
import { useFormsTranslation, useMessagesTranslation } from '@/hooks/useTypedTranslation';
import { EntityHeader } from '@/components/EntityHeader';
import { buildSessionSummaryItems } from '@/lib/sessions/buildSessionSummaryItems';
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
  onSessionUpdated
}: SessionSheetViewProps) {
  const {
    toast
  } = useToast();
  const {
    deleteSession
  } = useSessionActions();
  const {
    t: tForms
  } = useFormsTranslation();
  const {
    t: tMessages
  } = useMessagesTranslation();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStartStep, setEditStartStep] = useState<SessionPlanningStepId | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const fetchSession = async () => {
    if (!sessionId) return;
    try {
      const {
        data,
        error
      } = await supabase.from('sessions').select(`
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
        `).eq('id', sessionId).single();
      if (error) throw error;
      setSession(data);
    } catch (error: any) {
      console.error('Error fetching session:', error);
      toast({
        title: "Error",
        description: "Failed to load session details",
        variant: "destructive"
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
    setEditStartStep(undefined);
    setIsEditDialogOpen(true);
  };
  const handleDelete = async () => {
    if (!session) return;
    const success = await deleteSession(session.id);
    if (success) {
      onSessionUpdated?.(); // Notify parent to refresh
      onOpenChange(false);
    }
  };
  const handleSessionUpdated = () => {
    fetchSession();
    setIsEditDialogOpen(false);
    setEditStartStep(undefined);
    onSessionUpdated?.(); // Notify parent components
  };
  const handleStatusChange = () => {
    fetchSession();
    onSessionUpdated?.(); // Notify parent components
  };
  const handleLeadClick = useCallback(() => {
    if (session?.lead_id && onNavigateToLead) {
      onNavigateToLead(session.lead_id);
      onOpenChange(false);
    }
  }, [onNavigateToLead, onOpenChange, session?.lead_id]);
  const handleProjectClick = useCallback(() => {
    if (session?.project_id && onNavigateToProject) {
      onNavigateToProject(session.project_id);
      onOpenChange(false);
    }
  }, [onNavigateToProject, onOpenChange, session?.project_id]);
  const sessionTypeLabel = session?.projects?.project_types?.name || tForms('sessionBanner.session');
  const sessionNameDisplay = session ? getDisplaySessionName(session) : '';

  const summaryItems = useMemo(
    () =>
      session
        ? buildSessionSummaryItems({
            session,
            labels: {
              dateTime: tForms('sessionSheet.dateTime'),
              project: tForms('sessionSheet.project'),
              notes: tForms('sessionSheet.notes'),
              location: tForms('sessionSheet.location'),
            },
            onProjectClick: session.project_id ? handleProjectClick : undefined,
          })
        : [],
    [session, tForms, handleProjectClick]
  );

  const overdueBanner =
    session && isOverdueSession(session.session_date, session.status) ? (
      <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-relaxed text-orange-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-600" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-orange-900">{tForms('sessionSheet.overdueWarning')}</p>
            <p>{tForms('sessionSheet.overdueDescription')}</p>
          </div>
        </div>
        <div className="pl-7">
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-700"
            onClick={() => {
              setEditStartStep('schedule');
              setIsEditDialogOpen(true);
            }}
          >
            {tForms('sessionSheet.overdueReschedule')}
          </Button>
        </div>
      </div>
    ) : undefined;

  const headerActions = session ? (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onViewFullDetails}
        className="w-full justify-center gap-2 text-sm font-medium hover:bg-accent sm:w-auto sm:px-4"
      >
        <ExternalLink className="h-4 w-4" />
        <span className="text-sm">{tForms('sessionSheet.fullDetails')}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:w-auto sm:px-3"
          >
            <span>{tForms('sessionSheet.more')}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="z-50 bg-background">
          <DropdownMenuItem role="menuitem" onSelect={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            <span>{tForms('sessionSheet.edit')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            role="menuitem"
            onSelect={() => setIsDeleteDialogOpen(true)}
            className="hover:text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            <span className="text-destructive">{tForms('sessionSheet.deleteSession')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onOpenChange(false)}
        className="hidden justify-center text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:inline-flex sm:w-auto sm:px-3"
      >
        <span>{tForms('sessionSheet.close')}</span>
      </Button>
    </>
  ) : undefined;

  const headerTitle = session ? (
    <span className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {sessionTypeLabel}
      </span>
      <span className="flex items-center gap-2 text-foreground">
        <span className="truncate">{sessionNameDisplay}</span>
        <SessionStatusBadge
          sessionId={session.id}
          currentStatus={session.status as any}
          editable={true}
          onStatusChange={handleStatusChange}
          className="text-xs sm:text-sm"
        />
      </span>
    </span>
  ) : undefined;
  return <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-5xl h-[100vh] overflow-y-auto overscroll-contain pr-2 pt-8 sm:pt-6">
          {loading ? <div className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-32 bg-muted rounded"></div>
              </div>
            </div> : session ? <>
              <div className="space-y-6 pb-6">
                <EntityHeader
                  name={sessionNameDisplay}
                  title={headerTitle}
                  summaryItems={summaryItems}
                  banner={overdueBanner}
                  actions={headerActions}
                  avatarClassName="bg-gradient-to-br from-amber-300 via-orange-400 to-orange-500 text-white ring-0"
                  avatarContent={<CalendarIcon className="h-5 w-5 text-white" aria-hidden="true" />}
                  fallbackInitials="SE"
                />

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
                          title={tForms('sessionSheet.clientDetails')}
                          showQuickActions={true}
                          showClickableNames={true}
                          onNavigateToLead={handleLeadClick}
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
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
                          <div className="space-y-4">
                            <Button
                              variant="outline"
                              onClick={() => setIsDeleteDialogOpen(true)}
                              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              size="lg"
                            >
                              {tForms('sessionSheet.deleteSession')}
                            </Button>
                            <p className="text-sm text-muted-foreground text-center">
                              {tForms('sessionSheet.deleteWarning')}
                            </p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </main>
                </div>
              </div>
            </> : <div className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">{tForms('sessions.sessionNotFound')}</h3>
              <p className="text-muted-foreground">{tForms('sessions.unableToLoadDetails')}</p>
            </div>}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      {session && isEditDialogOpen && (
        <EditSessionDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditStartStep(undefined);
            }
            setIsEditDialogOpen(open);
          }}
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
          startStep={editStartStep}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms('sessionSheet.deleteSession')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tMessages('confirm.deleteSession')} {tMessages('confirm.cannotUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tForms('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tForms('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>;
}
