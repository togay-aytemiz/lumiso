import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X, Users } from "lucide-react";
import { useTeamManagement } from "@/hooks/useTeamManagement";
import { useProfile } from "@/contexts/ProfileContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface InlineAssigneesPickerProps {
  value: string[];
  onChange: (assignees: string[]) => void;
  disabled?: boolean;
}

export function InlineAssigneesPicker({ value, onChange, disabled }: InlineAssigneesPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showTeamList, setShowTeamList] = useState(false);
  const { teamMembers, loading: teamLoading } = useTeamManagement();
  const { profile, loading: profileLoading } = useProfile();
  const teamSectionRef = useRef<HTMLDivElement>(null);
  const expandedSectionRef = useRef<HTMLDivElement>(null);
  
  // Get current user info
  const currentUserId = profile?.user_id;
  const currentUserName = profile?.full_name || "You";
  
  // Auto-add current user as first assignee if not already added
  useEffect(() => {
    if (currentUserId && !value.includes(currentUserId)) {
      onChange([currentUserId, ...value]);
    }
  }, [currentUserId]);
  
  // Filter team members based on search and exclude already selected
  const filteredMembers = teamMembers.filter(member => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      member.full_name?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower);
    
    const notAlreadySelected = !value.includes(member.user_id);
    
    return matchesSearch && notAlreadySelected;
  });

  // Get assignee details for display
  const getAssigneeDetails = (userId: string) => {
    if (userId === currentUserId) {
      return {
        name: currentUserName,
        email: "",
        avatar: profile?.profile_photo_url || "",
        initials: currentUserName.split(' ').map(n => n[0]).join('').toUpperCase(),
        isLoading: profileLoading
      };
    }
    
    const member = teamMembers.find(m => m.user_id === userId);
    
    // Still loading team data
    if (!member && teamLoading) {
      return {
        name: "Loading...",
        email: "",
        avatar: "",
        initials: "...",
        isLoading: true
      };
    }
    
    // Member not found but loading is done - this is a real issue
    if (!member) {
      return {
        name: `User ${userId.slice(0, 8)}`,
        email: "Unknown user",
        avatar: "",
        initials: "?",
        isLoading: false,
        isError: true
      };
    }
    
    // Member found but no name - use fallback
    const displayName = member.full_name || member.email?.split('@')[0] || `User ${userId.slice(0, 8)}`;
    
    return {
      name: displayName,
      email: member.email || "",
      avatar: member.profile_photo_url || "",
      initials: displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      isLoading: false,
      isGenerated: member.is_generated_name
    };
  };

  const handleAddMember = (userId: string) => {
    onChange([...value, userId]);
    setSearchTerm("");
  };

  const handleRemoveMember = (userId: string) => {
    // Don't allow removing the creator (current user)
    if (userId === currentUserId) return;
    onChange(value.filter(id => id !== userId));
  };

  const toggleTeamList = () => {
    const newState = !showTeamList;
    setShowTeamList(newState);
    setSearchTerm("");
    
    if (newState) {
      // Expanding - scroll to show the section
      setTimeout(() => {
        if (expandedSectionRef.current) {
          expandedSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          });
        }
      }, 150); // Small delay to let animation start
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Assignees</Label>
        
        {/* Current Assignees */}
        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-lg bg-muted/30">
          {value.length === 0 ? (
            <div className="text-sm text-muted-foreground">No assignees selected</div>
          ) : (
            value.map((userId) => {
              const assignee = getAssigneeDetails(userId);
              const isCreator = userId === currentUserId;
              
              // Show loading state for assignees being fetched
              if (assignee?.isLoading) {
                return (
                  <div key={userId} className="flex items-center gap-2 px-3 py-2 animate-pulse">
                    <div className="h-6 w-6 bg-muted rounded-full" />
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                );
              }
              
              // Don't render if we don't have assignee data at all
              if (!assignee) {
                return null;
              }
              
              return (
                <Badge
                  key={userId}
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 h-auto bg-background border animate-fade-in",
                    assignee.isError && "border-destructive/50 bg-destructive/5"
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className={cn(
                      "text-xs",
                      assignee.isError && "bg-destructive/20 text-destructive"
                    )}>
                      {assignee.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "text-sm font-medium",
                    assignee.isGenerated && "italic opacity-75"
                  )}>
                    {assignee.name}
                  </span>
                  {!isCreator && !disabled && (
                    <X
                      className="h-4 w-4 cursor-pointer hover:text-destructive transition-colors"
                      onClick={() => handleRemoveMember(userId)}
                    />
                  )}
                </Badge>
              );
            })
          )}
        </div>
      </div>

      {/* Add Team Members Section */}
      <div className="space-y-3" ref={teamSectionRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTeamList}
          disabled={disabled || teamMembers.length <= 1}
          className="w-full transition-colors duration-200"
        >
          <Users className="h-4 w-4 mr-2" />
          {showTeamList ? "Hide Team Members" : "Add Team Members"}
        </Button>

        {/* Animated Expandable Section */}
        <div
          ref={expandedSectionRef}
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            showTeamList 
              ? "max-h-96 opacity-100 animate-accordion-down" 
              : "max-h-0 opacity-0 animate-accordion-up"
          )}
        >
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30 animate-fade-in">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 transition-colors duration-200"
              />
            </div>

            {/* Team Members List */}
            <div className="space-y-2 max-h-48 overflow-y-auto overflow-x-hidden">
              {filteredMembers.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4 animate-fade-in">
                  {teamMembers.length <= 1
                    ? "No other team members to add"
                    : "No members match your search"
                  }
                </div>
              ) : (
                filteredMembers.map((member, index) => (
                  <div
                    key={member.user_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-200",
                      "hover:bg-background border hover:shadow-sm",
                      "animate-fade-in"
                    )}
                    style={{ 
                      animationDelay: `${index * 50}ms` // Stagger animation
                    }}
                    onClick={() => handleAddMember(member.user_id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profile_photo_url || ""} />
                      <AvatarFallback className="text-sm">
                        {(member.full_name || "U").split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {member.full_name || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {member.email || "No email"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}