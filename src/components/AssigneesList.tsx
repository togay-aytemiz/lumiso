import { useState, useEffect } from "react";
import { Users, Plus, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Assignee {
  id: string;
  name: string;
  email?: string;
  role?: string;
  profile_photo_url?: string;
}

interface AssigneesListProps {
  assignees: string[]; // Array of user IDs
  entityType: 'lead' | 'project';
  entityId: string;
  onUpdate?: () => void;
  className?: string;
}

interface OrganizationMember {
  user_id: string;
  role: string;
  full_name?: string;
  profile_photo_url?: string;
}

export function AssigneesList({ 
  assignees: initialAssignees = [], 
  entityType, 
  entityId, 
  onUpdate,
  className = "" 
}: AssigneesListProps) {
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);
  const [assigneeDetails, setAssigneeDetails] = useState<Assignee[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [isAddingAssignee, setIsAddingAssignee] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAssignees, setLoadingAssignees] = useState(true);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
  const { triggerNewAssignment } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();

  const maxVisible = 3;
  const visibleAssignees = assigneeDetails.slice(0, maxVisible);
  const overflowCount = Math.max(0, assigneeDetails.length - maxVisible);

  // Sync with parent prop changes
  useEffect(() => {
    setAssignees(initialAssignees);
  }, [initialAssignees]);

  useEffect(() => {
    fetchAssigneeDetails();
    fetchOrganizationMembers();
  }, [assignees]);

  const fetchAssigneeDetails = async () => {
    setLoadingAssignees(true);
    if (!assignees.length) {
      setAssigneeDetails([]);
      setLoadingAssignees(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, profile_photo_url')
        .in('user_id', assignees);

      if (error) throw error;

      const details = data?.map(profile => ({
        id: profile.user_id,
        name: profile.full_name || 'Unknown User',
        role: 'Member', // Will be updated with actual role from organization_members
        profile_photo_url: profile.profile_photo_url
      })) || [];

      setAssigneeDetails(details);
    } catch (error) {
      console.error('Error fetching assignee details:', error);
    } finally {
      setLoadingAssignees(false);
    }
  };

  const fetchOrganizationMembers = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!userSettings?.active_organization_id) return;

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role
        `)
        .eq('organization_id', userSettings.active_organization_id)
        .eq('status', 'active');

      if (error) throw error;

      // Fetch profile data
      if (data && data.length > 0) {
        const userIds = data.map(member => member.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', userIds);

        const membersWithProfiles = data.map(member => ({
          ...member,
          full_name: profiles?.find(p => p.user_id === member.user_id)?.full_name,
          profile_photo_url: profiles?.find(p => p.user_id === member.user_id)?.profile_photo_url
        }));

        setOrganizationMembers(membersWithProfiles || []);
        
        // Update assignee details with actual roles
        setAssigneeDetails(prev => prev.map(assignee => {
          const memberWithRole = membersWithProfiles.find(m => m.user_id === assignee.id);
          return memberWithRole ? {
            ...assignee,
            role: memberWithRole.role
          } : assignee;
        }));
      } else {
        setOrganizationMembers([]);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error);
    }
  };

  const addAssignee = async (userId: string) => {
    if (assignees.includes(userId)) return;

    // Update local state immediately for instant UI feedback
    const newAssignees = [...assignees, userId];
    setAssignees(newAssignees);
    setIsAddingAssignee(false);

    try {
      const tableName = entityType === 'lead' ? 'leads' : 'projects';
      
      const { error } = await supabase
        .from(tableName)
        .update({ assignees: newAssignees })
        .eq('id', entityId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignee added successfully"
      });

      // Send assignment notifications
      if (activeOrganization?.id) {
        await triggerNewAssignment(entityType, entityId, [userId], activeOrganization.id);
      }

      onUpdate?.();
    } catch (error: any) {
      // Revert local state on error
      setAssignees(assignees);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleRemoveClick = (userId: string, userName: string) => {
    setUserToRemove({ id: userId, name: userName });
    setShowRemoveDialog(true);
  };

  const confirmRemoveAssignee = async () => {
    if (!userToRemove) return;
    
    // Update local state immediately for instant UI feedback
    const newAssignees = assignees.filter(id => id !== userToRemove.id);
    setAssignees(newAssignees);
    setShowRemoveDialog(false);
    setUserToRemove(null);

    try {
      const { error } = await supabase
        .from(entityType === 'lead' ? 'leads' : 'projects')
        .update({ assignees: newAssignees })
        .eq('id', entityId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignee removed successfully"
      });

      onUpdate?.();
    } catch (error: any) {
      // Revert local state on error
      setAssignees([...assignees, userToRemove.id]);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const availableMembers = organizationMembers.filter(
    member => !assignees.includes(member.user_id)
  );

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className} relative min-h-[2rem]`}>
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline whitespace-nowrap">Assigned to:</span>
          <span className="sm:hidden whitespace-nowrap">Assigned:</span>
        </div>
        
        <div className="flex items-center gap-1 flex-grow min-w-0">
          {/* Reserve space for assignees to prevent layout shift */}
          <div className="flex items-center gap-1 min-h-[2rem] flex-grow">
            {/* Loading state with preserved space */}
            {loadingAssignees && assignees.length > 0 && (
              <div className="flex items-center gap-1">
                {assignees.slice(0, maxVisible).map((_, index) => (
                  <div key={`skeleton-${index}`} className="animate-fade-in">
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                ))}
                {assignees.length > maxVisible && (
                  <Skeleton className="h-8 w-8 rounded-full" />
                )}
              </div>
            )}
            
            {/* Visible assignees */}
            {!loadingAssignees && visibleAssignees.map((assignee) => (
              <Tooltip key={assignee.id}>
                <TooltipTrigger asChild>
                  <div className="relative group animate-fade-in">
                    <Avatar className="h-8 w-8 border-2 border-background">
                      {assignee.profile_photo_url ? (
                        <AvatarImage src={assignee.profile_photo_url} alt={assignee.name} />
                      ) : null}
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => handleRemoveClick(assignee.id, assignee.name)}
                      className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      disabled={loading}
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{assignee.name}</p>
                  {assignee.role && <p className="text-xs text-muted-foreground">{assignee.role}</p>}
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Overflow indicator */}
            {!loadingAssignees && overflowCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center animate-fade-in">
                    <span className="text-xs font-medium">+{overflowCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    {assigneeDetails.slice(maxVisible).map((assignee) => (
                      <div key={assignee.id} className="text-sm">
                        {assignee.name}
                        {assignee.role && <span className="text-muted-foreground ml-1">({assignee.role})</span>}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Add assignee button - Simple dropdown */}
            <div className="relative flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                disabled={loading}
                onClick={() => setIsAddingAssignee(!isAddingAssignee)}
              >
                <Plus className="h-4 w-4" />
              </Button>

              {/* Simple dropdown menu */}
              {isAddingAssignee && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-background border border-border rounded-md shadow-lg z-50">
                  <div className="p-2">
                    <div className="text-sm font-medium mb-2">Add Team Member</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableMembers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No team members available
                        </div>
                      ) : (
                        availableMembers.map((member) => (
                          <button
                            key={member.user_id}
                            className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-sm text-left"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addAssignee(member.user_id);
                            }}
                          >
                            <Avatar className="h-6 w-6">
                              {member.profile_photo_url ? (
                                <AvatarImage src={member.profile_photo_url} alt={member.full_name || 'User'} />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {getInitials(member.full_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {member.full_name || 'Unknown User'}
                              </span>
                              <Badge variant="secondary" className="text-xs w-fit">
                                {member.role}
                              </Badge>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Overlay to close dropdown when clicking outside */}
              {isAddingAssignee && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsAddingAssignee(false)}
                />
              )}
            </div>
          </div>
          
          {/* Loading overlay during updates - positioned to not affect layout */}
          {loading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToRemove?.name} from this {entityType}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRemoveAssignee} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}