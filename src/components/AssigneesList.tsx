import { useState, useEffect } from "react";
import { Users, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Assignee {
  id: string;
  name: string;
  email?: string;
  role?: string;
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
}

export function AssigneesList({ 
  assignees = [], 
  entityType, 
  entityId, 
  onUpdate,
  className = "" 
}: AssigneesListProps) {
  const [assigneeDetails, setAssigneeDetails] = useState<Assignee[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [isAddingAssignee, setIsAddingAssignee] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const maxVisible = 3;
  const visibleAssignees = assigneeDetails.slice(0, maxVisible);
  const overflowCount = Math.max(0, assigneeDetails.length - maxVisible);

  useEffect(() => {
    fetchAssigneeDetails();
    fetchOrganizationMembers();
  }, [assignees]);

  const fetchAssigneeDetails = async () => {
    if (!assignees.length) {
      setAssigneeDetails([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', assignees);

      if (error) throw error;

      const details = data?.map(profile => ({
        id: profile.user_id,
        name: profile.full_name || 'Unknown User',
        role: 'Member' // Default role, could be enhanced later
      })) || [];

      setAssigneeDetails(details);
    } catch (error) {
      console.error('Error fetching assignee details:', error);
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

      // Fetch profile data separately
      if (data && data.length > 0) {
        const userIds = data.map(member => member.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const membersWithProfiles = data.map(member => ({
          ...member,
          full_name: profiles?.find(p => p.user_id === member.user_id)?.full_name
        }));

        setOrganizationMembers(membersWithProfiles || []);
      } else {
        setOrganizationMembers([]);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error);
    }
  };

  const addAssignee = async (userId: string) => {
    if (assignees.includes(userId)) return;

    setLoading(true);
    try {
      const newAssignees = [...assignees, userId];
      
      const { error } = await supabase
        .from(entityType === 'lead' ? 'leads' : 'projects')
        .update({ assignees: newAssignees })
        .eq('id', entityId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignee added successfully"
      });

      onUpdate?.();
      setIsAddingAssignee(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeAssignee = async (userId: string) => {
    setLoading(true);
    try {
      const newAssignees = assignees.filter(id => id !== userId);
      
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Assigned to:</span>
          <span className="sm:hidden">Assigned:</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Visible assignees */}
          {visibleAssignees.map((assignee) => (
            <Tooltip key={assignee.id}>
              <TooltipTrigger asChild>
                <div className="relative group">
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => removeAssignee(assignee.id)}
                    className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
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
          {overflowCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
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

          {/* Add assignee button */}
          <Popover open={isAddingAssignee} onOpenChange={setIsAddingAssignee}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search team members..." />
                <CommandList>
                  <CommandEmpty>No team members found.</CommandEmpty>
                  <CommandGroup>
                    {availableMembers.map((member) => (
                      <CommandItem
                        key={member.user_id}
                        value={member.full_name || member.user_id}
                        onSelect={() => addAssignee(member.user_id)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Avatar className="h-6 w-6">
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
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </TooltipProvider>
  );
}