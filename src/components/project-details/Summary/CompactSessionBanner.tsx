import { Calendar, Clock, User, Folder, MoreVertical, Edit, Trash2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatLongDate, formatTime, cn } from "@/lib/utils";
import SessionStatusBadge from "@/components/SessionStatusBadge";

type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes?: string;
  status: SessionStatus;
  project_id?: string;
  leads?: {
    name: string;
  };
  projects?: {
    name: string;
    project_types?: {
      name: string;
    };
  };
}

interface CompactSessionBannerProps {
  session: Session;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusUpdate?: () => void;
  onLeadClick?: () => void;
  onProjectClick?: () => void;
  onClick?: () => void;
  showActions?: boolean;
}

const CompactSessionBanner = ({ 
  session, 
  onEdit, 
  onDelete, 
  onStatusUpdate,
  onLeadClick,
  onProjectClick,
  onClick,
  showActions = true 
}: CompactSessionBannerProps) => {
  
  const getSessionName = () => {
    if (session.projects?.project_types?.name) {
      return `${session.projects.project_types.name} Session`;
    }
    return "Session";
  };

  return (
    <Card 
      className={cn(
        "shadow-sm border border-border bg-card transition-colors",
        onClick ? "cursor-pointer hover:bg-gray-50" : "hover:shadow-md transition-shadow"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left section */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-base text-foreground truncate">
                {getSessionName()}
              </h3>
              {onClick && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <SessionStatusBadge
                sessionId={session.id}
                currentStatus={session.status}
                editable={true}
                onStatusChange={onStatusUpdate}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{formatLongDate(session.session_date)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{formatTime(session.session_time)}</span>
              </div>
              
              {session.leads?.name && (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4 flex-shrink-0" />
                  <button
                    onClick={onLeadClick}
                    className="text-primary hover:underline truncate"
                  >
                    {session.leads.name}
                  </button>
                </div>
              )}
              
              {session.projects?.name && (
                <div className="flex items-center gap-1">
                  <Folder className="h-4 w-4 flex-shrink-0" />
                  <button
                    onClick={onProjectClick}
                    className="text-primary hover:underline truncate"
                  >
                    {session.projects.name}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Right section - Actions */}
          {showActions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Session
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Session
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompactSessionBanner;