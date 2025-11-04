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
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Lock,
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
import {
  personalSettingsItems,
  organizationSettingsItems,
  pageMetadata,
  type SettingsNavItem,
} from "@/components/settings/settingsNavConfig";
import { useSettingsNavigation } from "@/hooks/useSettingsNavigation";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import { settingsClasses, settingsTokens } from "@/theme/settingsTokens";

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
  const isMobile = useIsMobile();
  const isSettingsRoot = currentPath === "/settings";
  const showMobileBackButton = isMobile && !isSettingsRoot;
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
  const contentRef = useRef<HTMLElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopRightOffset, setScrollTopRightOffset] = useState(24);
  const [domSectionNavItems, setDomSectionNavItems] = useState<
    StickySectionNavItem[]
  >([]);
  const mobileDirectoryScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopContentScrollRef = useRef<HTMLDivElement | null>(null);

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
  const handleDirectoryScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      mobileDirectoryScrollRef.current = node;
      if (isMobile && isSettingsRoot) {
        contentRef.current = node;
      }
    },
    [isMobile, isSettingsRoot]
  );

  const handleDetailScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      mobileDetailScrollRef.current = node;
      if (isMobile && !isSettingsRoot) {
        contentRef.current = node;
      }
    },
    [isMobile, isSettingsRoot]
  );

  const handleDesktopContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      desktopContentScrollRef.current = node;
      if (!isMobile) {
        contentRef.current = node;
      }
    },
    [isMobile]
  );

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
  }, [
    currentPath,
    isMobile,
    isSettingsRoot,
    refreshDomSectionNavItems,
    updateScrollTopPosition,
  ]);

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

  const handleMobileBackToDashboard = useCallback(() => {
    const target = "/settings";
    if (!handleNavigationAttempt(target)) {
      return;
    }
    navigate(target, { replace: true });
  }, [handleNavigationAttempt, navigate]);

  const handleMobileNavClick = useCallback(
    (itemHref: string) => {
      if (isItemLocked(itemHref)) {
        return;
      }
      if (!handleNavigationAttempt(itemHref)) {
        return;
      }
      navigate(itemHref);
    },
    [handleNavigationAttempt, isItemLocked, navigate]
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

  const mobileSections = useMemo(
    () => [
      {
        id: "personal",
        label: t("settings.personalSettings"),
        items: personalSettingsItems.filter((item) => item.variant !== "danger"),
      },
      {
        id: "organization",
        label: t("settings.organizationSettings"),
        items: organizationSettingsItems.filter(
          (item) => item.variant !== "danger"
        ),
      },
    ],
    [t]
  );

  const renderDirectoryButton = useCallback(
    (item: SettingsNavItem, variant: "mobile" | "desktop") => {
      const Icon = item.icon;
      const locked = isItemLocked(item.href);
      const itemHasChanges = hasCategoryChanges(item.href);
      const metadata = pageMetadata[item.href];
      const description =
        metadata?.descriptionKey ? tPages(metadata.descriptionKey) : undefined;

      const baseButtonClasses =
        "group flex w-full items-center gap-4 px-4 py-3 text-left transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-400))] focus-visible:ring-offset-2";

      const enabledClasses =
        variant === "mobile"
          ? "hover:bg-muted/40 active:translate-x-[1px]"
          : "rounded-2xl border border-border/60 bg-card shadow-sm hover:border-[hsl(var(--accent-300))] hover:shadow-md hover:-translate-y-[1px]";

      const disabledClasses =
        variant === "mobile"
          ? "cursor-not-allowed opacity-50"
          : "cursor-not-allowed opacity-40";

      return (
        <button
          key={`settings-directory-${item.href}`}
          type="button"
          onClick={() => handleMobileNavClick(item.href)}
          disabled={locked}
          data-walkthrough={item.testId}
          className={cn(
            baseButtonClasses,
            locked ? disabledClasses : enabledClasses
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-[hsl(var(--accent-600))]">
            <Icon className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-semibold text-foreground">
              {t(`settings.${item.title}`)}
            </span>
            {description && (
              <span className="truncate text-xs text-muted-foreground">
                {description}
              </span>
            )}
          </span>
          {itemHasChanges && (
            <span className="mr-2 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
          )}
          {locked ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          )}
        </button>
      );
    },
    [
      handleMobileNavClick,
      hasCategoryChanges,
      isItemLocked,
      t,
      tPages,
    ]
  );

  const renderSettingsDirectory = useCallback(
    (variant: "mobile" | "desktop") => {
      const containerClasses =
        variant === "mobile"
          ? "flex flex-col gap-6 px-4 py-6 sm:px-6"
          : "flex flex-col gap-8 px-6 py-8";

      return (
        <div className={containerClasses}>
          {mobileSections.map((section) => (
            <section key={section.id} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                {section.label}
              </p>
              {variant === "mobile" ? (
                <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
                  <div className="divide-y divide-border/60">
                    {section.items.map((item) =>
                      renderDirectoryButton(item, "mobile")
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((item) =>
                    renderDirectoryButton(item, "desktop")
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      );
    },
    [mobileSections, renderDirectoryButton]
  );

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

  const shouldShowScrollTopButton =
    showScrollTop && !(isMobile && isSettingsRoot);

  const sectionNavIds = useMemo(
    () => sectionNavItems.map((item) => item.id),
    [sectionNavItems]
  );

  const headerClassName = cn(
    "sticky top-0 z-30 px-4 sm:px-6",
    "border-b border-border/60 bg-[hsl(var(--background))] py-3 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]"
  );

  const desktopHeaderElement = (
    <header className={headerClassName}>
      <div
        key={currentPath}
        className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between settings-header-motion"
      >
        <div className="flex w-full items-center gap-3 py-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className={cn(settingsClasses.headerTitle, "truncate")}>
              {headerTitle}
            </h1>
            {headerDescription && (
              <p className={settingsClasses.headerDescription}>
                {headerDescription}
              </p>
            )}
          </div>
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
  );

  const mobileBackLabel = tCommon("buttons.back", {
    defaultValue: "Back",
  });

  const mobileHeaderElement = (
    <header className="sticky top-0 z-30 border-b border-border bg-[hsl(var(--background))]">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {showMobileBackButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMobileBackToDashboard}
            className="h-10 w-10 shrink-0 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-400))] focus-visible:ring-offset-2"
            aria-label={mobileBackLabel}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={cn(settingsClasses.headerTitle, "truncate")}>
            {headerTitle}
          </h1>
          {headerDescription && (
            <p className={cn(settingsClasses.headerDescription, "mt-1")}>
              {headerDescription}
            </p>
          )}
        </div>
      </div>
    </header>
  );

  const helpSheet = helpContent ? (
    <SettingsHelpSheet
      open={showHelp}
      onOpenChange={setShowHelp}
      helpContent={helpContent}
    />
  ) : null;

  const guardDialog = (
    <NavigationGuardDialog
      open={showGuard}
      onDiscard={handleDiscardChanges}
      onStay={handleStayOnPage}
      onSaveAndExit={handleSaveAndExit}
      message={guardMessage}
    />
  );

  const renderNavLink = useCallback(
    (item: SettingsNavItem) => {
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

  useEffect(() => {
    if (isMobile) {
      contentRef.current = isSettingsRoot
        ? mobileDirectoryScrollRef.current
        : mobileDetailScrollRef.current;
    } else {
      contentRef.current = desktopContentScrollRef.current;
    }
  }, [isMobile, isSettingsRoot, currentPath]);

  if (isMobile) {
    return (
      <>
        <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--background))]">
          {mobileHeaderElement}
          <main className="relative flex-1 min-h-0 overflow-hidden bg-[hsl(var(--background))]">
            <div
              className={cn(
                "flex h-full w-[200%] transition-transform duration-300 ease-in-out will-change-transform"
              )}
              style={{
                transform: `translateX(${isSettingsRoot ? "0%" : "-50%"})`,
              }}
            >
              <section
                ref={handleDirectoryScrollRef}
                className="flex h-full w-1/2 min-h-0 flex-col overflow-y-auto bg-[hsl(var(--background))] pb-8"
                aria-hidden={!isSettingsRoot}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {renderSettingsDirectory("mobile")}
              </section>
              <section
                ref={handleDetailScrollRef}
                className="flex h-full w-1/2 min-h-0 flex-col overflow-y-auto bg-[hsl(var(--background))] pb-8"
                aria-hidden={isSettingsRoot}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <Outlet />
                {shouldShowScrollTopButton && (
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
              </section>
            </div>
          </main>
        </div>
        {helpSheet}
        {guardDialog}
      </>
    );
  }

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
              {desktopHeaderElement}

              <div
                key={`${currentPath}-content`}
                ref={handleDesktopContentRef}
                className="relative flex-1 overflow-y-auto bg-[hsl(var(--background))] settings-content-motion"
              >
                {isSettingsRoot ? (
                  renderSettingsDirectory("desktop")
                ) : (
                  <>
                    <Outlet />
                    {shouldShowScrollTopButton && (
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {helpSheet}
      {guardDialog}
    </>
  );
}
