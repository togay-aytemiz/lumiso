import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface UserMenuProps {
  mode?: "desktop" | "tablet" | "mobile";
}

export function UserMenu({ mode }: UserMenuProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { profile, loading } = useProfile();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  
  // Get user email from auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate("/auth");
    setIsOpen(false);
  };

  const handleSettings = () => {
    if (isMobile) {
      navigate("/settings/profile");
    } else {
      navigate("/settings");
    }
    setIsOpen(false);
  };

  // Get display values with fallbacks
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    return userEmail || "User";
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
    if (userEmail) {
      return userEmail.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const displayName = getDisplayName();
  const initials = getInitials();

  // Mobile mode - direct navigation
  if (isMobile) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSettings}
        className="h-10 w-10 p-0 rounded-full"
      >
        <Avatar className="h-8 w-8">
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
      </Button>
    );
  }

  // Desktop/Tablet mode - bottom sheet
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-full hover:bg-muted/50 transition-all duration-200"
        >
          <Avatar className="h-8 w-8">
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
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="bottom" 
        className="h-auto max-h-[300px] rounded-t-xl border-t [&>button]:hidden"
      >
        <div className="flex flex-col gap-4 pb-4 pt-2">
          {/* Header */}
          <div className="flex items-center gap-3 pt-2">
            <Avatar className="h-10 w-10">
              {profile?.profile_photo_url && (
                <AvatarImage 
                  src={profile.profile_photo_url} 
                  alt={displayName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {displayName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {userEmail}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={handleSettings}
              className="justify-start h-10 gap-3 px-3"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="justify-start h-10 gap-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}