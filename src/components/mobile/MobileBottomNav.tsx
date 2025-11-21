import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  HelpCircle,
  Zap,
  FileText
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BottomSheetMenu } from './BottomSheetMenu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { HelpModal } from '@/components/modals/HelpModal';
import { UserMenu } from '@/components/UserMenu';
import { TrialStatusIndicator } from '@/components/sidebar/TrialStatusIndicator';

type RgbaColor = { r: number; g: number; b: number; a: number };

const parseColor = (value: string): RgbaColor | null => {
  const hslMatch = value.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) {
    const parts = hslMatch[1].split("/").map((v) => v.trim());
    const [hueSatLight, alpha = "1"] = parts;
    const [h, s, l] = hueSatLight
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((v) => v.replace("%", ""));

    const hNum = Number(h);
    const sNum = Number(s);
    const lNum = Number(l);
    const aNum = Number(alpha);

    if ([hNum, sNum, lNum, aNum].every(Number.isFinite)) {
      const sRatio = sNum / 100;
      const lRatio = lNum / 100;
      const c = (1 - Math.abs(2 * lRatio - 1)) * sRatio;
      const x = c * (1 - Math.abs(((hNum / 60) % 2) - 1));
      const m = lRatio - c / 2;
      let r1 = 0, g1 = 0, b1 = 0;

      if (hNum >= 0 && hNum < 60) {
        r1 = c; g1 = x; b1 = 0;
      } else if (hNum < 120) {
        r1 = x; g1 = c; b1 = 0;
      } else if (hNum < 180) {
        r1 = 0; g1 = c; b1 = x;
      } else if (hNum < 240) {
        r1 = 0; g1 = x; b1 = c;
      } else if (hNum < 300) {
        r1 = x; g1 = 0; b1 = c;
      } else {
        r1 = c; g1 = 0; b1 = x;
      }

      return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255),
        a: aNum,
      };
    }
  }

  const rgbMatch = value.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const [r, g, b, a = "1"] = rgbMatch[1].split(",").map((v) => v.trim());
    const parsed = {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: Number(a),
    };
    if (Number.isFinite(parsed.r) && Number.isFinite(parsed.g) && Number.isFinite(parsed.b) && Number.isFinite(parsed.a)) {
      return parsed;
    }
  }
  return null;
};

const getEffectiveBackgroundColor = (element: HTMLElement | null): RgbaColor => {
  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    const parsed = parseColor(style.backgroundColor);
    if (parsed && parsed.a > 0.05) {
      return parsed;
    }
    if (style.backgroundImage && style.backgroundImage !== "none") {
      // Assume darker artwork behind transparent layers so we err on contrast.
      return { r: 32, g: 41, b: 64, a: 1 };
    }
    current = current.parentElement;
  }

  const fallback = parseColor(getComputedStyle(document.documentElement).backgroundColor);
  return fallback ?? { r: 255, g: 255, b: 255, a: 1 };
};

const isDarkColor = (color: RgbaColor, threshold = 0.45) => {
  const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
  return luminance < threshold;
};

interface NavTab {
  key?: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  action?: () => void;
  badge?: number;
}

export function MobileBottomNav({ hideForOnboarding = false }: { hideForOnboarding?: boolean }) {
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isBackgroundDark, setIsBackgroundDark] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const navRef = useRef<HTMLElement | null>(null);
  const { t } = useTranslation("navigation");

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
      
      setIsVisible(!isAuthRoute && !isKeyboardOpen && !hideForOnboarding);
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
  }, [location.pathname, hideForOnboarding]);

  // Sample the area behind the nav so we can boost contrast when the page background is dark.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const measureBackground = () => {
      if (typeof document.elementFromPoint !== "function") return;

      const navElement = navRef.current;
      const originalPointerEvents = navElement?.style.pointerEvents || "";

      if (navElement) {
        navElement.style.pointerEvents = "none";
      }

      const navRect = navElement?.getBoundingClientRect();
      const baseY = navRect
        ? Math.max(0, navRect.top - 4)
        : Math.max(0, window.innerHeight - 48);
      const sampleYs = [
        Math.max(0, baseY - 18),
        Math.max(0, baseY - 8),
        baseY,
      ];
      const sampleXs = [0.2, 0.5, 0.8].map((ratio) =>
        Math.min(window.innerWidth - 1, Math.max(0, window.innerWidth * ratio))
      );

      if (navElement) {
        navElement.style.pointerEvents = originalPointerEvents;
      }

      const samples: RgbaColor[] = [];

      sampleXs.forEach((x) => {
        sampleYs.forEach((y) => {
          const elementBelow = document.elementFromPoint(
            x,
            y
          ) as HTMLElement | null;
          const targetElement =
            elementBelow && elementBelow !== navElement ? elementBelow : document.body;
          const color = getEffectiveBackgroundColor(targetElement);
          samples.push(color);
        });
      });

      const darkVotes = samples.filter((color) => isDarkColor(color, 0.55)).length;
      const shouldUseDark =
        samples.length > 0 && darkVotes >= Math.max(3, Math.ceil(samples.length * 0.66));
      setIsBackgroundDark(shouldUseDark);
    };

    let frame: number | null = null;

    const scheduleMeasurement = () => {
      if (typeof window.requestAnimationFrame !== "function") {
        measureBackground();
        return;
      }
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measureBackground();
      });
    };

    measureBackground();
    window.addEventListener("scroll", scheduleMeasurement, { passive: true });
    window.addEventListener("resize", scheduleMeasurement);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", scheduleMeasurement);
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [location.pathname]);

  const handleSignOut = async () => {
    const confirmMessage = t("menu.sign_out_confirm", "Are you sure you want to sign out?");
    if (window.confirm(confirmMessage)) {
      try {
        await supabase.auth.signOut();
        navigate('/auth');
      } catch (error: unknown) {
        const description =
          error instanceof Error ? error.message : t("menu.sign_out_error", "Unable to sign out.");
        toast({
          title: t("menu.sign_out_error", "Error signing out"),
          description,
          variant: "destructive"
        });
      }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tabs: NavTab[] = [
    { key: "dashboard", title: t("menu.dashboard"), icon: LayoutDashboard, path: '/' },
    { key: "leads", title: t("menu.leads"), icon: Users, path: '/leads' },
    { key: "projects", title: t("menu.projects"), icon: FolderOpen, path: '/projects' },
    { key: "bookings", title: t("menu.sessions"), icon: CalendarRange, action: () => setBookingsOpen(true) },
    { key: "more", title: t("menu.more"), icon: MoreHorizontal, action: () => setMoreOpen(true) }
  ];

  const bookingItems = [
    {
      title: t("menu.calendar"),
      icon: CalendarDays,
      onClick: () => navigate('/calendar')
    },
    {
      title: t("menu.sessions"),
      icon: Calendar,
      onClick: () => navigate('/sessions')
    },
    {
      title: t("menu.reminders"),
      icon: Bell,
      onClick: () => navigate('/reminders')
    }
  ];

  const automationItems = [
    {
      title: t("menu.workflows"),
      icon: BarChart3,
      onClick: () => navigate('/workflows')
    },
    {
      title: t("menu.templates"),
      icon: FileText,
      onClick: () => navigate('/templates')
    }
  ];

  const moreItems = [
    {
      title: t("menu.workflows"),
      icon: Zap,
      onClick: () => setAutomationOpen(true)
    },
    {
      title: t("menu.payments"),
      icon: CreditCard,
      onClick: () => navigate('/payments')
    },
    {
      title: t("menu.settings"),
      icon: Settings,
      onClick: () => navigate('/settings'),
      testId: 'mobile-settings'
    },
    {
      title: t("menu.help"),
      icon: HelpCircle,
      onClick: () => setHelpOpen(true)
    },
    {
      title: t("menu.sign_out"),
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

  const isAutomationActive = ['/workflows', '/templates'].some(path =>
    location.pathname.startsWith(path)
  );

  const isMoreActive = ['/payments', '/settings'].some(path =>
    location.pathname.startsWith(path)
  ) || isAutomationActive;

  const activeColor = isBackgroundDark ? "text-white" : "text-primary";
  const inactiveColor = isBackgroundDark ? "text-white/70" : "text-muted-foreground";
  const navBackgroundClasses = isBackgroundDark
    ? "bg-slate-900/75 supports-[backdrop-filter]:bg-slate-900/60 backdrop-blur-xl border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
    : "bg-background/92 supports-[backdrop-filter]:bg-background/75 backdrop-blur-lg border-border/70";
  const buttonHoverClasses = isBackgroundDark ? "hover:bg-white/10 active:bg-white/15" : "hover:bg-muted/50 active:bg-muted";
  const bookingsSheetTitle = t("menu.sessions");
  const automationSheetTitle = t("mobile_sheets.automation");
  const moreSheetTitle = t("menu.more");

  if (!isVisible) return null;

  return (
    <>
      <nav 
        ref={navRef}
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-50 border-t mobile-bottom-nav transition-colors",
          navBackgroundClasses
        )}
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
            } else if (tab.key === "bookings") {
              active = isBookingsActive;
            } else if (tab.key === "more") {
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
                aria-label={tab.title}
                data-walkthrough={tab.key === "more" ? 'mobile-more-tab' : undefined}
                className={cn(
                  "flex flex-col items-center justify-center min-h-[44px] px-2 py-1 rounded-lg transition-colors relative",
                  buttonHoverClasses
                )}
              >
                <Icon 
                  className={cn(
                    "h-5 w-5 mb-1",
                    active ? activeColor : inactiveColor
                  )} 
                />
                <span 
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    active ? activeColor : inactiveColor
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
        title={bookingsSheetTitle}
        isOpen={bookingsOpen}
        onOpenChange={setBookingsOpen}
        items={bookingItems}
      />

      <BottomSheetMenu
        title={automationSheetTitle}
        isOpen={automationOpen}
        onOpenChange={setAutomationOpen}
        items={automationItems}
      />

      <BottomSheetMenu
        title={moreSheetTitle}
        isOpen={moreOpen}
        onOpenChange={setMoreOpen}
        items={moreItems}
        leadingContent={<TrialStatusIndicator variant="mobile" />}
        customContent={
          <div className="mt-4 border-t pt-4">
            <UserMenu
              variant="mobile"
              onNavigate={() => setMoreOpen(false)}
            />
          </div>
        }
      />

      <HelpModal 
        isOpen={helpOpen} 
        onOpenChange={setHelpOpen} 
      />
    </>
  );
}
