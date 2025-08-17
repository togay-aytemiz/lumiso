import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, X } from "lucide-react";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfile } from "@/contexts/ProfileContext";

interface AssigneesPickerProps {
  value: string[];
  onChange: (assignees: string[]) => void;
  disabled?: boolean;
}

export function AssigneesPicker({ value, onChange, disabled }: AssigneesPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { teamMembers, loading } = useTeamManagement();
  const { profile } = useProfile();
  const isMobile = useIsMobile();
  
  // Debug logs
  console.log('AssigneesPicker - teamMembers:', teamMembers);
  console.log('AssigneesPicker - profile:', profile);
  console.log('AssigneesPicker - value:', value);
  
  // Get current user info to auto-add as first assignee
  const currentUserId = profile?.user_id;
  const currentUserName = profile?.full_name || "You";
  
  // Filter team members based on search
  const filteredMembers = teamMembers.filter(member => {
    const searchLower = searchTerm.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower)
    );
  });

  // Get assignee details for display
  const getAssigneeDetails = (userId: string) => {
    if (userId === currentUserId) {
      return {
        name: currentUserName,
        email: "",
        avatar: profile?.profile_photo_url || "",
        initials: currentUserName.split(' ').map(n => n[0]).join('').toUpperCase()
      };
    }
    
    const member = teamMembers.find(m => m.user_id === userId);
    return {
      name: member?.full_name || "Unknown",
      email: member?.email || "",
      avatar: member?.profile_photo_url || "",
      initials: (member?.full_name || "U").split(' ').map(n => n[0]).join('').toUpperCase()
    };
  };

  const handleToggleAssignee = (userId: string) => {
    console.log('handleToggleAssignee called with:', userId);
    console.log('Current value:', value);
    
    if (value.includes(userId)) {
      // Don't allow removing the creator (first assignee)
      if (userId === currentUserId && value[0] === currentUserId) {
        console.log('Cannot remove creator');
        return;
      }
      const newValue = value.filter(id => id !== userId);
      console.log('Removing user, new value:', newValue);
      onChange(newValue);
    } else {
      const newValue = [...value, userId];
      console.log('Adding user, new value:', newValue);
      onChange(newValue);
    }
  };

  const handleConfirmSelection = () => {
    setOpen(false);
    setSearchTerm("");
  };

  const AssigneesList = () => (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 p-3 border-b" onClick={(e) => e.stopPropagation()}>
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none p-0 h-auto focus-visible:ring-0"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading team members...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {teamMembers.length === 0 
              ? "No team members yet. Invite from Team Management."
              : "No members match your search."
            }
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredMembers.map((member) => {
              const isSelected = value.includes(member.user_id);
              const isCreator = member.user_id === currentUserId;
              const isDisabled = isCreator && value[0] === currentUserId; // Can't uncheck creator
              
              console.log('Rendering member:', member, 'isSelected:', isSelected);
              
              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Member clicked:', member.user_id, 'disabled:', isDisabled);
                    if (!isDisabled) {
                      handleToggleAssignee(member.user_id);
                    }
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      console.log('Checkbox changed for:', member.user_id, 'checked:', checked);
                      if (!isDisabled) {
                        handleToggleAssignee(member.user_id);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.profile_photo_url || ""} />
                    <AvatarFallback className="text-xs">
                      {(member.full_name || "U").split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {member.full_name || "Unknown"}
                      {isCreator && " (You)"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {member.email || "No email"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-3 border-t" onClick={(e) => e.stopPropagation()}>
        <Button onClick={handleConfirmSelection} className="w-full">
          Add Selected
        </Button>
      </div>
    </div>
  );

  // Use forwardRef for the trigger to avoid ref warnings
  const Trigger = forwardRef<HTMLButtonElement>((props, ref) => (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      disabled={disabled}
      className="h-8 gap-1 text-xs"
      {...props}
    >
      <Plus className="h-3 w-3" />
      Add
    </Button>
  ));
  
  Trigger.displayName = "Trigger";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between min-h-[24px]">
        <h4 className="text-sm font-medium">Assignees</h4>
        <div className="w-[60px] flex justify-end">
          {loading ? (
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
          ) : teamMembers.length > 0 ? (
            <>
              {isMobile ? (
                <Drawer open={open} onOpenChange={setOpen}>
                  <DrawerTrigger asChild>
                    <Trigger />
                  </DrawerTrigger>
                  <DrawerContent className="h-[80vh]">
                    <DrawerHeader>
                      <DrawerTitle>Select Team Members</DrawerTitle>
                    </DrawerHeader>
                    <AssigneesList />
                  </DrawerContent>
                </Drawer>
              ) : (
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Trigger />
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-80 p-0" 
                    align="end"
                  >
                    <AssigneesList />
                  </PopoverContent>
                </Popover>
              )}
            </>
          ) : null}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {value.map((userId, index) => {
          const assignee = getAssigneeDetails(userId);
          const isCreator = userId === currentUserId && index === 0;
          
          return (
            <Badge
              key={userId}
              variant="secondary"
              className="flex items-center gap-2 px-2 py-1 h-auto"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={assignee.avatar} />
                <AvatarFallback className="text-xs">
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{assignee.name}</span>
              {!isCreator && !disabled && (
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter(id => id !== userId));
                  }}
                />
              )}
            </Badge>
          );
        })}
        
        {value.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No assignees selected
          </div>
        )}
      </div>
    </div>
  );
}