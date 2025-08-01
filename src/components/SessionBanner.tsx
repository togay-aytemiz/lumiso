import { Calendar, Clock, Badge as BadgeIcon, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getLeadStatusStyles, formatStatusText } from "@/lib/leadStatusColors";
import { cn } from "@/lib/utils";
import { useSessionActions } from "@/hooks/useSessionActions";

type SessionStatus = 'planned' | 'completed' | 'in_post_processing' | 'delivered' | 'cancelled';

interface Session {
  id: string;
  session_date: string;
  session_time: string;
  notes: string;
  status: SessionStatus;
}

interface SessionBannerProps {
  session: Session;
  leadName: string;
  onStatusUpdate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

const SessionBanner = ({ session, leadName, onStatusUpdate, onEdit, onDelete, showActions = true }: SessionBannerProps) => {
  const { updateSessionStatus } = useSessionActions();

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_post_processing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'delivered': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCardBgColor = (status: string) => {
    switch (status) {
      case 'planned': return 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20';
      case 'completed': return 'border-l-green-500 bg-green-50/30 dark:bg-green-950/20';
      case 'in_post_processing': return 'border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/20';
      case 'delivered': return 'border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/20';
      case 'cancelled': return 'border-l-red-500 bg-red-50/30 dark:bg-red-950/20';
      default: return 'border-l-primary bg-primary/5';
    }
  };

  const formatStatusText = (status: string) => {
    switch (status) {
      case 'in_post_processing': return 'In Post-Processing';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const handleStatusChange = async (newStatus: SessionStatus) => {
    const success = await updateSessionStatus(session.id, newStatus);
    if (success) {
      onStatusUpdate?.();
    }
  };

  const formatTime = (time: string) => {
    // Convert time to HH:mm format
    return time.slice(0, 5);
  };

  return (
    <Card className={cn("border-l-4", getCardBgColor(session.status))}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg">Photo Session</h3>
              {session.status === 'planned' ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground mt-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{new Date(session.session_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>{formatTime(session.session_time)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  This session has been marked as {formatStatusText(session.status).toLowerCase()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={session.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_post_processing">In Post-Processing</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            {showActions && (
              <TooltipProvider>
                <div className="flex items-center gap-1 ml-2">
                  {onEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={session.status !== 'planned'}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Edit button clicked for session:', session.id, 'status:', session.status);
                            if (session.status === 'planned') {
                              onEdit();
                            }
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{session.status === 'planned' ? 'Edit Session' : 'Can only edit planned sessions'}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {onDelete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Session</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionBanner;