import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, ChevronUp, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserMenuProps {
  variant?: "sidebar" | "mobile" | "minimal";
  onNavigate?: () => void;
}

export function UserMenu({ variant = "sidebar", onNavigate }: UserMenuProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
      setIsOpen(false);
      onNavigate?.();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleSettings = () => {
    navigate("/settings/profile");
    setIsOpen(false);
    onNavigate?.();
  };

  // Get display values with fallbacks
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (user?.email) return user.email.split('@')[0];
    return "User";
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const displayName = getDisplayName();
  const initials = getInitials();

  // Minimal variant - just avatar
  if (variant === "minimal") {
    return (
      <Avatar className="h-8 w-8 shrink-0">
        {profile?.profile_photo_url && (
          <AvatarImage 
            src={profile.profile_photo_url} 
            alt={displayName}
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  // Mobile variant - for mobile bottom sheet menus
  if (variant === "mobile") {
    return (
      <div 
        onClick={handleSettings}
        className="flex items-center gap-3 p-3 mx-3 mb-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors w-[calc(100%-24px)]"
      >
        <Avatar className="h-10 w-10 shrink-0">
          {profile?.profile_photo_url && (
            <AvatarImage 
              src={profile.profile_photo_url} 
              alt={displayName}
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground leading-tight line-clamp-2">
            {displayName}
          </div>
          {user?.email && (
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          )}
        </div>
        <ChevronUp className="h-4 w-4 text-muted-foreground rotate-90 shrink-0" />
      </div>
    );
  }

  // Sidebar variant - for desktop/tablet sidebar
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-3 p-3 border border-sidebar-border rounded-lg hover:bg-sidebar-accent/50 cursor-pointer transition-colors w-full">
          <Avatar className="h-10 w-10 shrink-0">
            {profile?.profile_photo_url && (
              <AvatarImage 
                src={profile.profile_photo_url} 
                alt={displayName}
                className="object-cover"
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-sidebar-foreground leading-tight line-clamp-1">
              {displayName}
            </div>
            {user?.email && (
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            )}
          </div>
          <ChevronUp 
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-0' : 'rotate-180'
            }`} 
          />
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        side="top" 
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-2 bg-popover border-sidebar-border"
        sideOffset={8}
        avoidCollisions={false}
      >
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            onClick={handleSettings}
            className="justify-start h-9 gap-3 px-3 hover:bg-sidebar-accent"
          >
            <User className="h-4 w-4" />
            <span>Profile settings</span>
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="justify-start h-9 gap-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}