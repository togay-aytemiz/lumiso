import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  const [assigneeProfiles, setAssigneeProfiles] = useState<AssigneeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assigneeIds.length === 0) {
      setAssigneeProfiles([]);
      setLoading(false);
      return;
    }

    const fetchAssigneeProfiles = async () => {
      try {
        // Get the current user's organization
        const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
        if (!organizationId) return;

        // Get organization members
        const { data: members, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id, role')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .in('user_id', assigneeIds);

        if (membersError) throw membersError;

        // Get profiles for the members
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', assigneeIds);

        if (profilesError) throw profilesError;

        // Combine member roles with profile data
        const profiles = members?.map(member => {
          const profile = profilesData?.find(p => p.user_id === member.user_id);
          return {
            id: member.user_id,
            full_name: profile?.full_name || null,
            profile_photo_url: profile?.profile_photo_url || null,
            role: member.role
          };
        }) || [];

        setAssigneeProfiles(profiles);
      } catch (error) {
        console.error('Error fetching assignee profiles:', error);
        setAssigneeProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAssigneeProfiles();
  }, [assigneeIds]);

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