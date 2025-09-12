import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTeamManagement } from "@/hooks/useTeamManagement";

interface AssigneeProfile {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  role: string;
}

interface AssigneeAvatarsProps {
  assigneeIds: string[];
  maxVisible?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function AssigneeAvatars({ 
  assigneeIds, 
  maxVisible = 3, 
  size = "sm",
  className 
}: AssigneeAvatarsProps) {
  const { teamMembers, loading } = useTeamManagement();
  const [assigneeProfiles, setAssigneeProfiles] = useState<AssigneeProfile[]>([]);

  useEffect(() => {
    if (assigneeIds.length === 0 || !teamMembers) {
      setAssigneeProfiles([]);
      return;
    }

    // Map assignee IDs to team member data
    const profiles = assigneeIds
      .map(assigneeId => {
        const member = teamMembers.find(tm => tm.user_id === assigneeId);
        if (!member) return null;
        
        return {
          id: member.user_id,
          full_name: member.full_name,
          profile_photo_url: member.profile_photo_url,
          role: member.role || member.system_role || 'Member'
        };
      })
      .filter(Boolean) as AssigneeProfile[];

    setAssigneeProfiles(profiles);
  }, [assigneeIds, teamMembers]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-xs", 
    md: "h-10 w-10 text-sm"
  };

  if (loading || assigneeIds.length === 0) {
    return null;
  }

  const visibleAssignees = assigneeProfiles.slice(0, maxVisible);
  const remainingCount = assigneeProfiles.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn("flex -space-x-1", className)}>
        {visibleAssignees.map((assignee) => (
          <Tooltip key={assignee.id}>
            <TooltipTrigger asChild>
              <Avatar className={cn(sizeClasses[size], "border-2 border-background hover:z-10 cursor-help")}>
                <AvatarImage 
                  src={assignee.profile_photo_url || undefined} 
                  alt={assignee.full_name || "User"} 
                />
                <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                  {getInitials(assignee.full_name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-center">
                <p className="font-medium">{assignee.full_name || "Unknown User"}</p>
                <p className="text-xs text-muted-foreground">{assignee.role}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                sizeClasses[size], 
                "rounded-full bg-muted border-2 border-background flex items-center justify-center text-muted-foreground font-medium cursor-help hover:z-10"
              )}>
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                {assigneeProfiles.slice(maxVisible).map((assignee) => (
                  <div key={assignee.id} className="text-center">
                    <p className="font-medium text-sm">{assignee.full_name || "Unknown User"}</p>
                    <p className="text-xs text-muted-foreground">{assignee.role}</p>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}