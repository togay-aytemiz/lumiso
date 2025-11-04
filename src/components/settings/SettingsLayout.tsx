import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUp,
  Bell,
  CreditCard,
  FileText,
  FolderOpen,
  LifeBuoy,
  Lock,
  Package,
  Settings,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useTranslation } from "react-i18next";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import SettingsHelpSheet from "@/components/settings/SettingsHelpSheet";
import StickySectionNav, {
  type StickySectionNavItem,
} from "@/components/navigation/StickySectionNav";
import { useSettingsNavigation } from "@/hooks/useSettingsNavigation";
import { useToast } from "@/hooks/use-toast";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { settingsClasses, settingsTokens } from "@/theme/settingsTokens";

interface NavItem {
  title: string;
  href: string;
  icon: typeof User;
  testId: string;
  variant?: "danger";
}

const personalSettingsItems: NavItem[] = [
  {
    title: "profile",
    href: "/settings/profile",
    icon: User,
    testId: "profile-section",
  },
  {
    title: "notifications",
    href: "/settings/notifications",
    icon: Bell,
    testId: "notifications-section",
  },
];

const organizationSettingsItems: NavItem[] = [
  {
    title: "general",
    href: "/settings/general",
    icon: Settings,
    testId: "general-section",
  },
  {
    title: "projects",
    href: "/settings/projects",
    icon: FolderOpen,
    testId: "projects-section",
  },
  {
    title: "leads",
    href: "/settings/leads",
    icon: UserCheck,
    testId: "leads-section",
  },
  {
    title: "services",
    href: "/settings/services",
    icon: Package,
    testId: "services-section",
  },
  {
    title: "contracts",
    href: "/settings/contracts",
    icon: FileText,
    testId: "contracts-section",
  },
  {
    title: "billing",
    href: "/settings/billing",
    icon: CreditCard,
    testId: "billing-section",
  },
  {
    title: "dangerZone",
    href: "/settings/danger-zone",
    icon: AlertTriangle,
    testId: "danger-section",
    variant: "danger",
  },
];

const pageMetadata: Record<
  string,
  { titleKey: string; descriptionKey?: string }
> = {
  "/settings/profile": {
    titleKey: "settings.profile.title",
    descriptionKey: "settings.profile.description",
  },
  "/settings/notifications": {
    titleKey: "settings.notifications.title",
    descriptionKey: "settings.notifications.description",
  },
  "/settings/general": {
    titleKey: "settings.general.title",
    descriptionKey: "settings.general.description",
  },
  "/settings/projects": {
    titleKey: "settings.projects.title",
    descriptionKey: "settings.projects.description",
  },
  "/settings/leads": {
    titleKey: "settings.leads.title",
    descriptionKey: "settings.leads.description",
  },
  "/settings/services": {
    titleKey: "settings.services.title",
    descriptionKey: "settings.services.description",
  },
  "/settings/contracts": {
    titleKey: "settings.contracts.title",
    descriptionKey: "settings.contracts.description",
  },
  "/settings/billing": {
    titleKey: "settings.billing.title",
    descriptionKey: "settings.billing.description",
  },
  "/settings/danger-zone": {
    titleKey: "settings.dangerZone.title",
    descriptionKey: "settings.dangerZone.description",
  },
};

const CLOSE_TARGET = "__settings_close__";
const LAST_NON_SETTINGS_PATH_KEY = "lumiso:last-non-settings-path";

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    hasCategoryChanges,
    cancelCategoryChanges,
    saveCategoryChanges,
    categoryChanges,
  } = useSettingsContext();
  const { shouldLockNavigation } = useOnboarding();
  const { t } = useTranslation("navigation");
  const { t: tCommon } = useTranslation("common");
  const { t: tPages } = useTranslation("pages");
  const { toast } = useToast();

  const currentPath = location.pathname;
  const hasChanges = hasCategoryChanges(currentPath);

  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastPathRef.current !== null) {
      return;
    }

    const locationState = (location.state as { from?: string } | null) ?? null;
    if (locationState?.from) {
      lastPathRef.current = locationState.from;
      return;
    }

    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(LAST_NON_SETTINGS_PATH_KEY);
      if (stored) {
        lastPathRef.current = stored;
        return;
      }
    }

    lastPathRef.current = "/";
  }, [location.state]);

  const exitSettings = useCallback(() => {
    const target = lastPathRef.current ?? "/";
    navigate(target, { replace: true });
  }, [navigate]);

  const [modalState, setModalState] = useState<"enter" | "idle" | "exit">(
    "enter"
  );
  const [showHelp, setShowHelp] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopRightOffset, setScrollTopRightOffset] = useState(24);
  const [domSectionNavItems, setDomSectionNavItems] = useState<
    StickySectionNavItem[]
  >([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setModalState("idle"), 200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const runCloseAnimation = useCallback(() => {
    if (closeTimeoutRef.current) return;
    setShowHelp(false);
    setModalState("exit");
    closeTimeoutRef.current = window.setTimeout(() => {
      exitSettings();
    }, 180);
  }, [exitSettings]);

  const updateScrollTopPosition = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const container = contentRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const offset = Math.max(window.innerWidth - rect.right + 24, 16);
    setScrollTopRightOffset(offset);
  }, []);

  const refreshDomSectionNavItems = useCallback(() => {
    const container = contentRef.current;
    if (!container) {
      setDomSectionNavItems([]);
      return;
    }

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-settings-section='true']")
    );

    const mapped = nodes
      .map((node) => {
        const id = node.id?.trim();
        const title =
          node.getAttribute("data-settings-section-title")?.trim() ?? "";
        if (!id || !title) {
          return null;
        }
        return { id, title };
      })
      .filter((item): item is StickySectionNavItem => item !== null);

    const unique = mapped.filter(
      (item, index, array) =>
        array.findIndex((candidate) => candidate.id === item.id) === index
    );

    setDomSectionNavItems(unique);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const container = contentRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 240);
    };

    container.scrollTo({ top: 0 });
    handleScroll();
    updateScrollTopPosition();
    refreshDomSectionNavItems();

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateScrollTopPosition);

    let frame = 0;
    let observer: MutationObserver | null = null;

    if ("MutationObserver" in window) {
      observer = new MutationObserver(() => {
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        frame = window.requestAnimationFrame(() => {
          refreshDomSectionNavItems();
        });
      });

      observer.observe(container, {
        subtree: true,
        childList: true,
      });
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollTopPosition);
    };
  }, [currentPath, refreshDomSectionNavItems, updateScrollTopPosition]);

  const handleScrollToTop = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const {
    showGuard,
    message: guardMessage,
    handleNavigationAttempt,
    handleModalClose,
    handleDiscardChanges,
    handleStayOnPage,
    handleSaveAndExit,
  } = useSettingsNavigation({
    isDirty: hasChanges,
    onDiscard: () => {
      cancelCategoryChanges(currentPath);
      toast({
        title: tCommon("toast.settingsDiscardedTitle"),
        description: tCommon("toast.settingsDiscardedDescription"),
      });
    },
    onSaveAndExit: async () => {
      await saveCategoryChanges(currentPath);
      toast({
        title: tCommon("toast.settingsSavedTitle"),
        description: tCommon("toast.settingsSavedDescription"),
      });
    },
    navigationHandler: (target) => {
      if (target === CLOSE_TARGET || target === null) {
        runCloseAnimation();
        return;
      }
      if (target) {
        navigate(target, { replace: true });
      }
    },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (handleModalClose()) {
          runCloseAnimation();
        } else {
          // Guard modal is shown by the hook
          handleNavigationAttempt(CLOSE_TARGET);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runCloseAnimation, handleModalClose, handleNavigationAttempt]);

  const isItemLocked = useCallback(
    (itemHref: string) => {
      if (shouldLockNavigation) {
        const isUnlocked = itemHref === "/settings";
        return !isUnlocked;
      }
      return false;
    },
    [shouldLockNavigation]
  );

  const handleCloseClick = useCallback(() => {
    if (handleModalClose()) {
      runCloseAnimation();
    } else {
      handleNavigationAttempt(CLOSE_TARGET);
    }
  }, [runCloseAnimation, handleModalClose, handleNavigationAttempt]);

  const handleNavItemInteraction = useCallback(
    (event: React.MouseEvent, itemHref: string) => {
      if (isItemLocked(itemHref)) {
        event.preventDefault();
        return;
      }

      if (!handleNavigationAttempt(itemHref)) {
        event.preventDefault();
      }
    },
    [handleNavigationAttempt, isItemLocked]
  );

  const headerMeta = useMemo(() => {
    const metadata = pageMetadata[currentPath];
    if (metadata) {
      return metadata;
    }

    // Attempt to match settings index routes
    const matchedEntry = Object.entries(pageMetadata).find(([path]) =>
      currentPath.startsWith(path)
    );
    return matchedEntry ? matchedEntry[1] : null;
  }, [currentPath]);

  const headerTitle = headerMeta
    ? tPages(headerMeta.titleKey)
    : t("settings.title");
  const headerDescription =
    headerMeta && headerMeta.descriptionKey
      ? tPages(headerMeta.descriptionKey)
      : undefined;

  const helpKey = useMemo(() => {
    const segments = currentPath.split("/").filter(Boolean);
    const rawKey = segments[segments.length - 1] ?? "profile";
    return rawKey.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  }, [currentPath]);

  const helpContent = (
    settingsHelpContent as Record<
      string,
      typeof settingsHelpContent.profile | undefined
    >
  )[helpKey];

  useEffect(() => {
    setShowHelp(false);
  }, [currentPath]);

  useEffect(() => {
    if (!helpContent) {
      setShowHelp(false);
    }
  }, [helpContent]);

  const mobileNavItems = useMemo(() => {
    return [...personalSettingsItems, ...organizationSettingsItems];
  }, []);

  const contextSectionNavItems = useMemo(() => {
    const sections = categoryChanges[currentPath] ?? {};
    return Object.entries(sections)
      .map(([id, section]) => ({
        id,
        title: section.sectionName,
      }))
      .filter((item) => Boolean(item.title?.trim()));
  }, [categoryChanges, currentPath]);

  const sectionNavItems = useMemo(() => {
    const merged: StickySectionNavItem[] = [];
    const seenIds = new Set<string>();

    contextSectionNavItems.forEach((item) => {
      if (item.id && !seenIds.has(item.id) && item.title) {
        merged.push(item);
        seenIds.add(item.id);
      }
    });

    domSectionNavItems.forEach((item) => {
      if (item.id && !seenIds.has(item.id) && item.title) {
        merged.push(item);
        seenIds.add(item.id);
      }
    });

    return merged;
  }, [contextSectionNavItems, domSectionNavItems]);

  const sectionNavIds = useMemo(
    () => sectionNavItems.map((item) => item.id),
    [sectionNavItems]
  );

  const renderNavLink = useCallback(
    (item: NavItem) => {
      const Icon = item.icon;
      const isActive = currentPath === item.href;
      const itemHasChanges = hasCategoryChanges(item.href);
      const locked = isItemLocked(item.href);

      const linkContent = (
        <div
          className={cn(
            "settings-nav-item group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
            "justify-center md:justify-start border border-transparent",
            isActive
              ? "bg-[linear-gradient(135deg,_hsl(var(--accent-100)),_hsl(var(--accent-300)))] text-[hsl(var(--accent-900))] shadow-[0_26px_45px_-32px_hsl(var(--accent-400)_/_0.95)] border-[hsl(var(--accent-300))]"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
            item.variant === "danger" &&
              (isActive
                ? "bg-destructive/10 text-destructive"
                : "text-destructive hover:bg-destructive/10 hover:text-destructive"),
            locked && "cursor-not-allowed opacity-60"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 flex-shrink-0 transition-colors",
              isActive &&
                item.variant !== "danger" &&
                "text-[hsl(var(--accent-700))]",
              !isActive && "text-muted-foreground/80"
            )}
          />
          <span className="hidden truncate text-sm font-medium md:flex md:items-center md:gap-2">
            {t(`settings.${item.title}`)}
            {itemHasChanges && (
              <span className="inline-flex h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-500" />
            )}
            {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
          </span>
          {itemHasChanges && (
            <span className="md:hidden absolute -top-1 -right-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
          )}
        </div>
      );

      if (locked) {
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <div
                data-walkthrough={item.testId}
                onClick={(event) => handleNavItemInteraction(event, item.href)}
              >
                {linkContent}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs">
              <p>{t("settings.completeGuidedSetup")}</p>
            </TooltipContent>
          </Tooltip>
        );
      }

      return (
        <NavLink
          key={item.href}
          to={item.href}
          replace
          data-walkthrough={item.testId}
          onClick={(event) => handleNavItemInteraction(event, item.href)}
        >
          {linkContent}
        </NavLink>
      );
    },
    [currentPath, handleNavItemInteraction, hasCategoryChanges, isItemLocked, t]
  );

  const containerStyle: CSSProperties = {
    "--settings-rail-width": settingsTokens.railWidth,
    "--settings-overlay-shadow": settingsTokens.overlayShadow,
  } as CSSProperties;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-6 md:py-10",
          "backdrop-blur supports-[backdrop-filter]:bg-slate-950/30 bg-slate-950/30 dark:bg-slate-950/50",
          modalState === "enter" && "settings-overlay-enter",
          modalState === "exit" && "settings-overlay-exit"
        )}
        onMouseDown={() => {
          if (closeTimeoutRef.current) return;
          if (handleModalClose()) {
            runCloseAnimation();
          } else {
            handleNavigationAttempt(CLOSE_TARGET);
          }
        }}
      >
        <div
          className={cn(
            "relative flex h-full max-h-[min(960px,calc(100vh-2rem))] w-full max-w-[92rem] overflow-hidden rounded-3xl border border-border/70 bg-[hsl(var(--background))] shadow-[var(--settings-overlay-shadow)]",
            modalState === "enter" && "settings-modal-enter",
            modalState === "exit" && "settings-modal-exit"
          )}
          style={containerStyle}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex h-full w-full">
            <aside
              className="hidden h-full shrink-0 flex-col border-r border-border/70 bg-muted/10 backdrop-blur-sm md:flex"
              style={{ width: "var(--settings-rail-width)" }}
            >
              <div className="flex-1 overflow-y-auto px-3 py-6">
                <div className="space-y-6">
                  <section>
                    <p
                      className={cn(
                        settingsClasses.railSectionLabel,
                        "px-2 text-muted-foreground/70"
                      )}
                    >
                      {t("settings.personalSettings")}
                    </p>
                    <nav className="mt-3 space-y-1.5">
                      {personalSettingsItems.map(renderNavLink)}
                    </nav>
                  </section>
                  <section>
                    <p
                      className={cn(
                        settingsClasses.railSectionLabel,
                        "px-2 text-muted-foreground/70"
                      )}
                    >
                      {t("settings.organizationSettings")}
                    </p>
                    <nav className="mt-3 space-y-1.5">
                      {organizationSettingsItems.map(renderNavLink)}
                    </nav>
                  </section>
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--background))]">
              <header className="sticky top-0 z-30 border-b border-border/60 bg-[hsl(var(--background))] px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))] sm:px-6">
                <div
                  key={currentPath}
                  className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between settings-header-motion"
                >
                  <div className="min-w-0 space-y-1 py-4">
                    <h1 className={cn(settingsClasses.headerTitle, "truncate")}>
                      {headerTitle}
                    </h1>
                    {headerDescription && (
                      <p className={settingsClasses.headerDescription}>
                        {headerDescription}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden whitespace-nowrap sm:inline-flex"
                      disabled={!helpContent}
                      onClick={() => {
                        if (!helpContent) return;
                        setShowHelp(true);
                      }}
                    >
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      {tCommon("buttons.needHelp")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCloseClick}
                      aria-label={tCommon("buttons.close")}
                      className="h-8 w-8 rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <nav className="mt-3 flex gap-2 overflow-x-auto border-t border-border/50 pt-3 md:hidden">
                  {mobileNavItems.map((item) => {
                    const isActive = currentPath === item.href;
                    return (
                      <NavLink
                        key={`mobile-${item.href}`}
                        to={item.href}
                        replace
                        onClick={(event) =>
                          handleNavItemInteraction(event, item.href)
                        }
                        className={cn(
                          "settings-nav-item inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          isActive
                            ? "border-[hsl(var(--sidebar-active))] bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-active-foreground))]"
                            : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {t(`settings.${item.title}`)}
                      </NavLink>
                    );
                  })}
                </nav>
                {sectionNavItems.length > 0 && (
                  <div className="mt-3 hidden border-t border-border/50 pt-3 md:block">
                    <StickySectionNav
                      items={sectionNavItems}
                      align="start"
                      navClassName="justify-start"
                      observeIds={sectionNavIds}
                      fallbackActiveId={sectionNavIds[0]}
                      disableSticky
                      className="border-0 bg-transparent px-0 py-0"
                    />
                  </div>
                )}
              </header>

              <div
                key={`${currentPath}-content`}
                ref={contentRef}
                className="relative flex-1 overflow-y-auto bg-[hsl(var(--background))] settings-content-motion"
              >
                <Outlet />
                {showScrollTop && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleScrollToTop}
                    onMouseDown={(event) => event.stopPropagation()}
                    className={cn(
                      "fixed z-[60] h-11 w-11 rounded-full border-transparent bg-[hsl(var(--accent-200))] text-[hsl(var(--accent-900))] shadow-lg transition-all hover:bg-[hsl(var(--accent-300))] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-400))] focus-visible:ring-offset-2",
                      hasChanges ? "bottom-24 md:bottom-28" : "bottom-5 md:bottom-6"
                    )}
                    style={{ right: `${scrollTopRightOffset}px` }}
                    aria-label={tCommon("buttons.backToTop", {
                      defaultValue: "Back to top",
                    })}
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {helpContent && (
        <SettingsHelpSheet
          open={showHelp}
          onOpenChange={setShowHelp}
          helpContent={helpContent}
        />
      )}

      <NavigationGuardDialog
        open={showGuard}
        onDiscard={handleDiscardChanges}
        onStay={handleStayOnPage}
        onSaveAndExit={handleSaveAndExit}
        message={guardMessage}
      />
    </>
  );
}
