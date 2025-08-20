import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FolderOpen, 
  CalendarRange, 
  MoreHorizontal,
  Calendar,
  CalendarDays,
  Bell,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  User
} from 'lucide-react';
import { BottomSheetMenu } from './BottomSheetMenu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/contexts/ProfileContext';
import { useOnboarding } from '@/hooks/useOnboarding';

interface NavTab {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  action?: () => void;
  badge?: number;
}

export function MobileBottomNav({ hideForOnboarding = false }: { hideForOnboarding?: boolean }) {
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { inGuidedSetup } = useOnboarding();

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

  // Hide on auth routes, keyboard open, and during onboarding
  useEffect(() => {
    const isAuthRoute = location.pathname === '/auth';
    
    const handleResize = () => {
      // Hide when keyboard is likely open (viewport height reduced significantly)
      const isKeyboardOpen = window.visualViewport 
        ? window.visualViewport.height < window.innerHeight * 0.75
        : false;
      
      setIsVisible(!isAuthRoute && !isKeyboardOpen && !hideForOnboarding && !inGuidedSetup);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [location.pathname, hideForOnboarding, inGuidedSetup]);

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        await supabase.auth.signOut();
        navigate('/auth');
      } catch (error: any) {
        toast({
          title: "Error signing out",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tabs: NavTab[] = [
    { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { title: 'Leads', icon: Users, path: '/leads' },
    { title: 'Projects', icon: FolderOpen, path: '/projects' },
    { title: 'Bookings', icon: CalendarRange, action: () => setBookingsOpen(true) },
    { title: 'More', icon: MoreHorizontal, action: () => setMoreOpen(true) }
  ];

  const bookingItems = [
    {
      title: 'Calendar',
      icon: CalendarDays,
      onClick: () => navigate('/calendar')
    },
    {
      title: 'Sessions',
      icon: Calendar,
      onClick: () => navigate('/sessions')
    },
    {
      title: 'Reminders',
      icon: Bell,
      onClick: () => navigate('/reminders')
    }
  ];

  const moreItems = [
    {
      title: 'Analytics',
      icon: BarChart3,
      onClick: () => navigate('/analytics')
    },
    {
      title: 'Payments',
      icon: CreditCard,
      onClick: () => navigate('/payments')
    },
    {
      title: 'Settings',
      icon: Settings,
      onClick: () => navigate('/settings')
    },
    {
      title: 'Sign Out',
      icon: LogOut,
      onClick: handleSignOut,
      variant: 'destructive' as const
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const isBookingsActive = ['/calendar', '/sessions', '/reminders'].some(path =>
    location.pathname.startsWith(path)
  );

  const isMoreActive = ['/analytics', '/payments', '/settings'].some(path =>
    location.pathname.startsWith(path)
  );

  if (!isVisible) return null;

  return (
    <>
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t supports-[backdrop-filter]:bg-background/50 mobile-bottom-nav"
        style={{ 
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          position: 'fixed',
          bottom: 0,
        }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            let active = false;
            
            if (tab.path) {
              active = isActive(tab.path);
            } else if (tab.title === 'Bookings') {
              active = isBookingsActive;
            } else if (tab.title === 'More') {
              active = isMoreActive;
            }

            const handleTabPress = () => {
              if (tab.path) {
                if (active) {
                  scrollToTop();
                } else {
                  navigate(tab.path);
                }
              } else if (tab.action) {
                tab.action();
              }
            };

            return (
              <button
                key={index}
                onClick={handleTabPress}
                className={cn(
                  "flex flex-col items-center justify-center min-h-[44px] px-2 py-1 rounded-lg transition-colors relative",
                  "hover:bg-muted/50 active:bg-muted"
                )}
              >
                <Icon 
                  className={cn(
                    "h-5 w-5 mb-1",
                    active ? "text-primary" : "text-muted-foreground"
                  )} 
                />
                <span 
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {tab.title}
                </span>
                
                {tab.badge && tab.badge > 0 && (
                  <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <BottomSheetMenu
        title="Bookings"
        isOpen={bookingsOpen}
        onOpenChange={setBookingsOpen}
        items={bookingItems}
      />

      <BottomSheetMenu
        title="More"
        isOpen={moreOpen}
        onOpenChange={setMoreOpen}
        items={moreItems}
        customContent={
          <div className="mt-4 border-t pt-4">
            <div 
              onClick={() => {
                navigate('/settings/profile');
                setMoreOpen(false);
              }}
              className="flex items-center gap-3 p-3 mx-3 mb-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors w-[calc(100%-24px)]"
            >
              <img 
                src={profile?.profile_photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}`}
                alt={profile?.full_name || userEmail?.split('@')[0] || "User"}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground leading-tight line-clamp-2">
                  {profile?.full_name || userEmail?.split("@")[0] || "User"}
                </div>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}