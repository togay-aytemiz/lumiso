import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import SessionBanner from "./SessionBanner";
import EditSessionDialog from "./EditSessionDialog";
import { NewSessionDialogForProject } from "./NewSessionDialogForProject";

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';
  project_id?: string;
  lead_id: string;
}

interface SessionsSectionProps {
  sessions: Session[];
  loading: boolean;
  leadId: string;
  projectId: string;
  leadName: string;
  projectName: string;
  onSessionUpdated: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionsSection({ 
  sessions, 
  loading, 
  leadId,
  projectId,
  leadName, 
  projectName, 
  onSessionUpdated, 
  onDeleteSession 
}: SessionsSectionProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const handleSessionUpdated = () => {
    onSessionUpdated();
    setEditingSessionId(null);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Sessions
            <div className="w-6 h-6 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="w-full h-4 bg-muted animate-pulse rounded" />
            <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg font-medium">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Sessions
            </div>
            <NewSessionDialogForProject
              leadId={leadId}
              leadName={leadName}
              projectName={projectName}
              projectId={projectId}
              onSessionScheduled={onSessionUpdated}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {!loading && (
                <p className="text-sm text-muted-foreground mb-3">
                  This project includes {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                </p>
              )}
              {sessions.map((session) => (
                <SessionBanner
                  key={session.id}
                  session={session}
                  leadName={leadName}
                  projectName={projectName}
                  onStatusUpdate={onSessionUpdated}
                  onEdit={() => setEditingSessionId(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No sessions linked to this project</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click the + button to add sessions to this project
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Session Dialog */}
      {editingSessionId && (() => {
        const session = sessions.find(s => s.id === editingSessionId);
        return session ? (
          <EditSessionDialog
            sessionId={session.id}
            leadId={session.lead_id}
            currentDate={session.session_date}
            currentTime={session.session_time}
            currentNotes={session.notes}
            currentProjectId={session.project_id}
            leadName={leadName}
            open={!!editingSessionId}
            onOpenChange={(open) => {
              if (!open) {
                setEditingSessionId(null);
              }
            }}
            onSessionUpdated={handleSessionUpdated}
          />
        ) : null;
      })()}
    </>
  );
}