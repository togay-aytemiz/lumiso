import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Settings, LogOut, ChevronUp, ChevronDown, User, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useOptionalOrganization } from "@/hooks/useOptionalOrganization";
import { Separator } from "@/components/ui/separator";

interface UserMenuProps {
  variant?: "sidebar" | "mobile" | "minimal" | "header";
  onNavigate?: () => void;
}

export function UserMenu({ variant = "sidebar", onNavigate }: UserMenuProps) {
  const { t, i18n } = useFormsTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const organizationContext = useOptionalOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isPremiumAccount =
    organizationContext?.activeOrganization?.membership_status === "premium" ||
    organizationContext?.activeOrganization?.membership_status === "complimentary";
  const premiumExpiresAt = organizationContext?.activeOrganization?.premium_expires_at ?? null;
  const formattedPremiumEndsAt = useMemo(() => {
    if (!premiumExpiresAt) return null;
    try {
      return new Intl.DateTimeFormat(i18n.language || undefined, {
        dateStyle: "medium",
      }).format(new Date(premiumExpiresAt));
    } catch {
      return null;
    }
  }, [premiumExpiresAt, i18n.language]);

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
    const shouldAttachBackground =
      variant !== "mobile" && !location.pathname.startsWith("/settings");
    const state = shouldAttachBackground
      ? { backgroundLocation: location }
      : undefined;
    navigate("/settings/profile", state ? { state } : undefined);
    setIsOpen(false);
    onNavigate?.();
  };

  const handleSubscription = () => {
    const shouldAttachBackground =
      variant !== "mobile" && !location.pathname.startsWith("/settings");
    const state = shouldAttachBackground
      ? { backgroundLocation: location }
      : undefined;
    navigate("/settings/billing/subscription", state ? { state } : undefined);
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

  const renderAvatar = (className: string) => (
    <div className="relative inline-flex">
      <Avatar className={className}>
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
      {isPremiumAccount && (
        <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 p-1 text-background shadow-lg">
          <Crown className="h-3 w-3" />
        </span>
      )}
    </div>
  );

  // Minimal variant - just avatar
  if (variant === "minimal") {
    return renderAvatar("h-8 w-8 shrink-0");
  }

  // Mobile variant - for mobile bottom sheet menus
  if (variant === "mobile") {
    return (
      <div 
        onClick={handleSettings}
        className="flex items-center gap-3 p-3 mx-3 mb-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors w-[calc(100%-24px)]"
      >
        {renderAvatar("h-10 w-10 shrink-0")}
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

  if (variant === "header") {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex items-center gap-3 pl-4 pr-3 py-2 border-l border-border/60 min-w-0",
              "rounded-lg text-left transition-colors hover:bg-muted/60 focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50 max-w-[240px] sm:max-w-[280px]"
            )}
          >
            {renderAvatar("h-10 w-10 shrink-0")}
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium text-sm text-foreground leading-tight truncate max-w-full" title={displayName}>
                {displayName}
              </div>
              {user?.email && (
                <div className="text-xs text-muted-foreground truncate max-w-full" title={user.email}>
                  {user.email}
                </div>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="end"
          className="w-[var(--radix-popover-trigger-width)] p-2"
          sideOffset={8}
        >
          <div className="flex flex-col gap-1">
            {isPremiumAccount && formattedPremiumEndsAt ? (
              <>
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 shadow-inner">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    {t("userMenu.premiumStatus")}
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {t("userMenu.premiumEnds", { date: formattedPremiumEndsAt })}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubscription}
                    className="text-[11px] font-semibold text-amber-800 underline-offset-2 hover:underline"
                  >
                    {t("userMenu.manageSubscription")}
                  </button>
                </div>
                <Separator className="my-1" />
              </>
            ) : null}
            <Button
              variant="ghost"
              onClick={handleSettings}
              className="justify-start h-9 gap-3 px-3"
            >
              <User className="h-4 w-4" />
              <span>{t('userMenu.profileSettings')}</span>
            </Button>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="justify-start h-9 gap-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('userMenu.signOut')}</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Sidebar variant - for desktop/tablet sidebar
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-3 p-3 border border-sidebar-border rounded-lg hover:bg-sidebar-accent/50 cursor-pointer transition-colors w-full">
          {renderAvatar("h-10 w-10 shrink-0")}
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
            <span>{t('userMenu.profileSettings')}</span>
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="justify-start h-9 gap-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span>{t('userMenu.signOut')}</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
