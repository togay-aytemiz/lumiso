import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  SettingsAnchorRegistryProvider,
  useRegisteredSettingsAnchors,
} from "@/contexts/SettingsAnchorRegistryContext";
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
const MOBILE_SECTION_MIN_GAP = 10;
const MOBILE_SECTION_EXTRA_REDUCTION = 70;
const DESKTOP_SECTION_MAX_OFFSET = 112;
const DESKTOP_SECTION_EXTRA_REDUCTION = 60;

type SettingsLocationState = {
  from?: string;
  backgroundLocation?: Location;
};

type SettingsLayoutProps = {
  enableOverlay?: boolean;
};

function SettingsLayoutInner({ enableOverlay = true }: SettingsLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState =
    (location.state as SettingsLocationState | null) ?? null;
  const isMobile = useIsMobile();
  const shouldUseOverlay = enableOverlay && !isMobile;
  const backgroundLocationFromState = shouldUseOverlay
    ? locationState?.backgroundLocation ?? null
    : null;
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
  const registeredAnchors = useRegisteredSettingsAnchors();

  const currentPath = location.pathname;
  const isSettingsRoot = currentPath === "/settings";
  const showMobileBackButton = isMobile && !isSettingsRoot;
  const hasChanges = hasCategoryChanges(currentPath);

  const backgroundLocationRef = useRef<Location | null>(
    backgroundLocationFromState
  );
  useEffect(() => {
    if (!shouldUseOverlay) {
      backgroundLocationRef.current = null;
      return;
    }
    if (backgroundLocationFromState) {
      backgroundLocationRef.current = backgroundLocationFromState;
    }
  }, [backgroundLocationFromState, shouldUseOverlay]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!shouldUseOverlay) {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [shouldUseOverlay]);

  useEffect(() => {
    if (!shouldUseOverlay) {
      return;
    }
    if (backgroundLocationRef.current && !backgroundLocationFromState) {
      navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: { backgroundLocation: backgroundLocationRef.current },
      });
    }
  }, [
    shouldUseOverlay,
    backgroundLocationFromState,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  const stableBackgroundLocation = shouldUseOverlay
    ? backgroundLocationFromState ?? backgroundLocationRef.current
    : null;

  const settingsNavigationState = useMemo(() => {
    if (!shouldUseOverlay || !stableBackgroundLocation) {
      return undefined;
    }
    return { backgroundLocation: stableBackgroundLocation };
  }, [shouldUseOverlay, stableBackgroundLocation]);

  const pushSettingsPath = useCallback(
    (target: string, options?: { replace?: boolean }) => {
      if (settingsNavigationState) {
        navigate(target, { ...options, state: settingsNavigationState });
      } else if (options) {
        navigate(target, options);
      } else {
        navigate(target);
      }
    },
    [navigate, settingsNavigationState]
  );

  const hasBackgroundLocation =
    shouldUseOverlay && Boolean(stableBackgroundLocation);

  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastPathRef.current !== null) {
      return;
    }

    if (locationState?.from) {
      lastPathRef.current = locationState.from;
      return;
    }

    if (stableBackgroundLocation) {
      lastPathRef.current = `${stableBackgroundLocation.pathname}${stableBackgroundLocation.search}${stableBackgroundLocation.hash}`;
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
  }, [locationState, stableBackgroundLocation]);

  const exitSettings = useCallback(() => {
    if (hasBackgroundLocation) {
      navigate(-1);
      return;
    }
    const target = lastPathRef.current ?? "/";
    navigate(target, { replace: true });
  }, [hasBackgroundLocation, navigate]);

  const [modalState, setModalState] = useState<"enter" | "idle" | "exit">(
    "enter"
  );
  const [showHelp, setShowHelp] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | undefined>();
  const contentRef = useRef<HTMLElement | null>(null);
  const [domSectionNavItems, setDomSectionNavItems] = useState<
    StickySectionNavItem[]
  >([]);
  const mobileDirectoryScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopContentScrollRef = useRef<HTMLDivElement | null>(null);
  const sectionScrollOffsetRef = useRef(140);
  const anchorNavHeightRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setModalState("idle"), 200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = undefined;
      }
    };
  }, []);

  const runCloseAnimation = useCallback(() => {
    if (closeTimeoutRef.current) return;
    setShowHelp(false);
    setModalState("exit");
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = undefined;
      exitSettings();
    }, 180);
  }, [exitSettings]);

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

    container.scrollTo({ top: 0 });
    refreshDomSectionNavItems();

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
    };
  }, [
    currentPath,
    isMobile,
    isSettingsRoot,
    refreshDomSectionNavItems,
  ]);

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
        pushSettingsPath(target, { replace: true });
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
    const target = lastPathRef.current ?? "/";
    if (!handleNavigationAttempt(target)) {
      return;
    }
    pushSettingsPath(target, { replace: true });
  }, [handleNavigationAttempt, pushSettingsPath]);

  const handleMobileNavClick = useCallback(
    (itemHref: string) => {
      if (isItemLocked(itemHref)) {
        return;
      }
      if (!handleNavigationAttempt(itemHref)) {
        return;
      }
      const shouldReplace = !isMobile && hasBackgroundLocation;
      if (shouldReplace) {
        pushSettingsPath(itemHref, { replace: true });
        return;
      }
      pushSettingsPath(itemHref);
    },
    [
      handleNavigationAttempt,
      hasBackgroundLocation,
      isItemLocked,
      isMobile,
      pushSettingsPath,
    ]
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

  const mobileSections = useMemo(() => {
    const dangerItems = organizationSettingsItems.filter(
      (item) => item.variant === "danger"
    );
    const sections = [
      {
        id: "personal",
        label: t("settings.personalSettings"),
        items: personalSettingsItems,
      },
      {
        id: "organization",
        label: t("settings.organizationSettings"),
        items: organizationSettingsItems.filter(
          (item) => item.variant !== "danger"
        ),
      },
    ];

    if (dangerItems.length > 0) {
      sections.push({
        id: "danger",
        label: t("settings.dangerZone"),
        items: dangerItems,
      });
    }

    return sections;
  }, [t]);

  const renderDirectoryButton = useCallback(
    (item: SettingsNavItem, variant: "mobile" | "desktop") => {
      const Icon = item.icon;
      const locked = isItemLocked(item.href);
      const itemHasChanges = hasCategoryChanges(item.href);
      const metadata = pageMetadata[item.href];
      const description = metadata?.descriptionKey
        ? tPages(metadata.descriptionKey)
        : undefined;

      const baseButtonClasses =
        variant === "mobile"
          ? "group flex w-full items-center gap-4 px-4 py-3 text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-400))] focus-visible:ring-offset-2"
          : "group flex w-full items-center justify-between gap-6 rounded-3xl border border-border/60 bg-card px-6 py-5 text-left shadow-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent-400))] focus-visible:ring-offset-2";

      const isDangerVariant = item.variant === "danger";
      const isDangerMobile = isDangerVariant && variant === "mobile";

      const enabledClasses =
        variant === "mobile"
          ? isDangerMobile
            ? "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 active:translate-x-[1px]"
            : "hover:bg-muted/40 active:translate-x-[1px]"
          : "hover:-translate-y-1 hover:border-[hsl(var(--accent-300))] hover:shadow-[0_26px_45px_-30px_rgba(15,23,42,0.55)]";

      const disabledClasses =
        variant === "mobile"
          ? "cursor-not-allowed opacity-50"
          : "cursor-not-allowed opacity-40";

      const iconWrapperClasses = cn(
        "flex items-center justify-center rounded-2xl transition-all duration-200",
        variant === "desktop" && "h-12 w-12 rounded-3xl",
        variant === "mobile" && "h-11 w-11",
        isDangerMobile
          ? "bg-destructive/20 text-destructive"
          : cn(
              "bg-muted text-[hsl(var(--accent-600))]",
              variant === "desktop" &&
                "group-hover:bg-[hsl(var(--accent-100))] group-hover:text-[hsl(var(--accent-800))]"
            )
      );

      const iconClasses = cn(
        variant === "desktop" ? "h-6 w-6" : "h-5 w-5",
        "transition-transform duration-200",
        variant === "desktop" && "group-hover:scale-110"
      );

      const textWrapperClasses = cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        variant === "desktop" && "w-full"
      );

      const titleClasses = cn(
        "truncate text-sm font-semibold",
        isDangerMobile ? "text-destructive" : "text-foreground"
      );

      const descriptionClasses = cn(
        "truncate text-xs",
        isDangerMobile ? "text-destructive/80" : "text-muted-foreground"
      );

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
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-4",
              variant === "desktop" && "flex-col items-start gap-3"
            )}
          >
            <span className={iconWrapperClasses}>
              <Icon className={iconClasses} />
            </span>
            <span className={textWrapperClasses}>
              <span className={titleClasses}>
                {t(`settings.${item.title}`)}
              </span>
              {description && (
                <span className={descriptionClasses}>{description}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {itemHasChanges && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
            )}
            {locked ? (
              <Lock
                className={cn(
                  "h-4 w-4",
                  isDangerMobile
                    ? "text-destructive/80"
                    : "text-muted-foreground"
                )}
              />
            ) : (
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  variant === "desktop" &&
                    "group-hover:translate-x-1 group-hover:scale-110",
                  variant === "mobile" && "group-hover:translate-x-0.5",
                  isDangerMobile ? "text-destructive" : "text-muted-foreground"
                )}
              />
            )}
          </div>
        </button>
      );
    },
    [handleMobileNavClick, hasCategoryChanges, isItemLocked, t, tPages]
  );

  const renderSettingsDirectory = useCallback(
    (variant: "mobile" | "desktop") => {
      const containerClasses =
        variant === "mobile"
          ? "flex flex-col gap-6 px-4 py-6 sm:px-6"
          : "flex flex-col gap-8 px-6 py-8";

      const sectionsToRender =
        variant === "mobile"
          ? mobileSections
          : mobileSections.filter((section) => section.id !== "danger");

      return (
        <div className={containerClasses}>
          {sectionsToRender.map((section) => (
            <section key={section.id} className="space-y-3">
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-muted-foreground/70",
                  section.id === "danger" &&
                    variant === "mobile" &&
                    "text-destructive/80"
                )}
              >
                {section.label}
              </p>
              {variant === "mobile" ? (
                <div
                  className={cn(
                    "overflow-hidden rounded-3xl border bg-card shadow-sm",
                    section.id === "danger"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border/60"
                  )}
                >
                  <div
                    className={cn(
                      "divide-y",
                      section.id === "danger"
                        ? "divide-destructive/20"
                        : "divide-border/60"
                    )}
                  >
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

    registeredAnchors.forEach((item) => {
      if (item.id && !seenIds.has(item.id) && item.label) {
        merged.push({ id: item.id, title: item.label });
        seenIds.add(item.id);
      }
    });

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
  }, [contextSectionNavItems, domSectionNavItems, registeredAnchors]);

  const hasMultipleSections = sectionNavItems.length > 1;

  const sectionNavIds = useMemo(
    () => sectionNavItems.map((item) => item.id),
    [sectionNavItems]
  );

  const getSectionScrollOffset = useCallback(
    (forceTop?: boolean) => {
      if (forceTop) {
        return 0;
      }
      const baseOffset = sectionScrollOffsetRef.current ?? 0;
      if (isMobile) {
        const reduced = baseOffset - MOBILE_SECTION_EXTRA_REDUCTION;
        return Math.max(reduced, MOBILE_SECTION_MIN_GAP);
      }
      const anchorHeight = anchorNavHeightRef.current ?? 0;
      const adjusted =
        baseOffset - anchorHeight - DESKTOP_SECTION_EXTRA_REDUCTION;
      return Math.max(Math.min(adjusted, DESKTOP_SECTION_MAX_OFFSET), 0);
    },
    [isMobile]
  );

  const scrollToSection = useCallback(
    (targetId: string, options?: { forceTop?: boolean }) => {
      if (typeof window === "undefined") {
        return;
      }

      const forceTop = options?.forceTop ?? false;
      const container = contentRef.current;
      const behavior: ScrollBehavior = "smooth";

      if (forceTop) {
        if (container) {
          container.scrollTo({ top: 0, behavior });
        } else {
          window.scrollTo({ top: 0, behavior });
        }
        return;
      }

      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      const resolvedOffset = getSectionScrollOffset();

      if (container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetTop =
          targetRect.top - containerRect.top + container.scrollTop;

        container.scrollTo({
          top: targetTop - resolvedOffset,
          behavior,
        });
        return;
      }

      const viewportTargetTop =
        window.scrollY + target.getBoundingClientRect().top;

      window.scrollTo({
        top: viewportTargetTop - resolvedOffset,
        behavior,
      });
    },
    [getSectionScrollOffset]
  );

  const anchorAwareSectionNavItems = useMemo(
    () =>
      sectionNavItems.map((item, index) => ({
        ...item,
        onSelect: () => scrollToSection(item.id, { forceTop: index === 0 }),
      })),
    [scrollToSection, sectionNavItems]
  );

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (!hash) {
      return;
    }

    const timeouts: number[] = [];
    let attempts = 0;

    const focusTargetSection = () => {
      const target = document.getElementById(hash);
      if (!target) {
        return false;
      }
      scrollToSection(hash);
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
      }
      target.focus({ preventScroll: true });
      return true;
    };

    const tryScroll = () => {
      if (focusTargetSection()) {
        return;
      }
      if (attempts >= 4) {
        return;
      }
      attempts += 1;
      const timeoutId = window.setTimeout(tryScroll, 100);
      timeouts.push(timeoutId);
    };

    const initialTimeout = window.setTimeout(tryScroll, 0);
    timeouts.push(initialTimeout);

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [location.hash, registeredAnchors, scrollToSection]);

  const anchorNavPages = [
    "/settings/leads",
    "/settings/projects",
    "/settings/services",
    "/settings/profile",
    "/settings/general",
    "/settings/notifications",
  ];

  const isAnchorEligible = anchorNavPages.some(
    (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`)
  );

  const shouldShowMobileAnchorNav =
    isMobile &&
    !isSettingsRoot &&
    isAnchorEligible &&
    hasMultipleSections;

  const headerClassName = cn(
    "sticky top-0 z-30 px-4 sm:px-6",
    "border-b border-border/60 bg-[hsl(var(--background))] py-3 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]"
  );

  const desktopHeaderElement = (
    <header className={headerClassName} data-settings-header="true">
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
          {shouldUseOverlay && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCloseClick}
              aria-label={tCommon("buttons.close")}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {hasMultipleSections && (
        <div
          className="mt-3 hidden border-t border-border/50 pt-3 md:block"
          data-settings-anchor-nav="true"
        >
          <StickySectionNav
            items={anchorAwareSectionNavItems}
            align="start"
            navClassName="justify-start"
            observeIds={sectionNavIds}
            fallbackActiveId={sectionNavIds[0]}
            disableSticky
            className="border-0 bg-transparent px-0 py-0"
            minItemsToShow={2}
          />
        </div>
      )}
    </header>
  );

  const mobileBackLabel = tCommon("buttons.back", {
    defaultValue: "Back",
  });

  const mobileHeaderElement = (
    <header
      className="sticky top-0 z-30 border-b border-border bg-[hsl(var(--background))]"
      data-settings-header="true"
    >
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {showMobileBackButton && (
          <Button
            type="button"
            variant="tinted"
            colorScheme="slate"
            size="icon"
            onClick={handleMobileBackToDashboard}
            className="h-10 w-10 shrink-0"
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
      {shouldShowMobileAnchorNav && (
        <div
          className="border-t border-border/60 px-4 py-2 sm:px-6"
          data-settings-anchor-nav="true"
        >
          <StickySectionNav
            items={anchorAwareSectionNavItems}
            align="start"
            navClassName="justify-start"
            observeIds={sectionNavIds}
            fallbackActiveId={sectionNavIds[0]}
            disableSticky
            className="border-0 bg-transparent px-0 py-0"
            minItemsToShow={2}
          />
        </div>
      )}
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
              item.variant === "danger"
                ? "text-destructive"
                : isActive
                ? "text-[hsl(var(--accent-700))]"
                : "text-muted-foreground/80"
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
          {...(settingsNavigationState
            ? { state: settingsNavigationState }
            : {})}
          data-walkthrough={item.testId}
          onClick={(event) => handleNavItemInteraction(event, item.href)}
        >
          {linkContent}
        </NavLink>
      );
    },
    [
      currentPath,
      handleNavItemInteraction,
      hasCategoryChanges,
      isItemLocked,
      settingsNavigationState,
      t,
    ]
  );

  const containerStyle: CSSProperties = {
    "--settings-rail-width": settingsTokens.railWidth,
    "--settings-overlay-shadow": settingsTokens.overlayShadow,
  } as CSSProperties;

  const shouldShowDesktopSidebar = !isMobile && !isSettingsRoot;
  const desktopSidebarStyle = !isMobile
    ? {
        width: shouldShowDesktopSidebar ? "var(--settings-rail-width)" : "0px",
      }
    : undefined;

  useLayoutEffect(() => {
    if (isMobile || !isSettingsRoot) {
      return;
    }
    pushSettingsPath("/settings/profile", { replace: true });
  }, [isMobile, isSettingsRoot, pushSettingsPath]);

  useEffect(() => {
    if (isMobile) {
      contentRef.current = isSettingsRoot
        ? mobileDirectoryScrollRef.current
        : mobileDetailScrollRef.current;
    } else {
      contentRef.current = desktopContentScrollRef.current;
    }
  }, [isMobile, isSettingsRoot, currentPath]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const setOffsetVariable = () => {
      const headerEl = document.querySelector(
        "[data-settings-header='true']"
      ) as HTMLElement | null;
      if (!headerEl) {
        return;
      }

      const headerHeight = headerEl.getBoundingClientRect().height;
      const anchorNavEl = headerEl.querySelector(
        "[data-settings-anchor-nav='true']"
      ) as HTMLElement | null;
      const anchorHeight = anchorNavEl?.getBoundingClientRect().height ?? 0;
      const baseGap = 12;
      const computedOffset = Math.max(
        headerHeight - anchorHeight + baseGap,
        64
      );

      sectionScrollOffsetRef.current = computedOffset;
      anchorNavHeightRef.current = anchorHeight;
      document.documentElement.style.setProperty(
        "--settings-section-offset",
        `${Math.round(computedOffset)}px`
      );
    };

    setOffsetVariable();

    const handleResize = () => setOffsetVariable();
    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;
    const headerEl = document.querySelector(
      "[data-settings-header='true']"
    ) as HTMLElement | null;
    if (headerEl && "ResizeObserver" in window) {
      observer = new ResizeObserver(() => setOffsetVariable());
      observer.observe(headerEl);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [isMobile, isSettingsRoot, shouldUseOverlay, currentPath]);

  if (isMobile) {
    return (
      <>
        <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--background))]">
          {mobileHeaderElement}
          <main className="relative flex-1 min-h-0 overflow-hidden bg-[hsl(var(--background))]">
            <div
              ref={handleDirectoryScrollRef}
              className={cn(
                "absolute inset-0 z-10 flex flex-col overflow-y-auto bg-[hsl(var(--background))] pb-8 transition-transform duration-300 ease-in-out will-change-transform",
                isSettingsRoot
                  ? "translate-x-0 pointer-events-auto"
                  : "-translate-x-full pointer-events-none"
              )}
              aria-hidden={!isSettingsRoot}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {renderSettingsDirectory("mobile")}
            </div>
            <div
              ref={handleDetailScrollRef}
              className={cn(
                "absolute inset-0 z-20 flex flex-col overflow-y-auto bg-[hsl(var(--background))] pb-8 transition-transform duration-300 ease-in-out will-change-transform",
                isSettingsRoot
                  ? "translate-x-full pointer-events-none"
                  : "translate-x-0 pointer-events-auto"
              )}
              aria-hidden={isSettingsRoot}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <Outlet />
            </div>
          </main>
        </div>
        {helpSheet}
        {guardDialog}
      </>
    );
  }

  const desktopContent = (
    <div className="flex h-full w-full">
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col overflow-hidden transition-all duration-500 md:flex",
          shouldShowDesktopSidebar
            ? "md:border-r md:border-border/70 md:bg-muted/10 md:backdrop-blur-sm md:opacity-100"
            : "md:-translate-x-6 md:border-transparent md:bg-transparent md:opacity-0"
        )}
        style={{
          ...desktopSidebarStyle,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        aria-hidden={!shouldShowDesktopSidebar}
      >
        {shouldShowDesktopSidebar && (
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
        )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );

  const desktopPanel = (
    <div
      className={cn(
        "relative flex h-full w-full max-w-[92rem] overflow-hidden rounded-3xl border border-border/70 bg-[hsl(var(--background))] shadow-[var(--settings-overlay-shadow)]",
        shouldUseOverlay
          ? "max-h-[min(960px,calc(100vh-2rem))]"
          : "min-h-[600px]",
        shouldUseOverlay && modalState === "enter" && "settings-modal-enter",
        shouldUseOverlay && modalState === "exit" && "settings-modal-exit"
      )}
      style={containerStyle}
      onMouseDown={
        shouldUseOverlay ? (event) => event.stopPropagation() : undefined
      }
    >
      {desktopContent}
    </div>
  );

  if (!shouldUseOverlay) {
    return (
      <>
        <div className="flex min-h-screen w-full justify-center bg-[hsl(var(--background))] px-3 py-6 sm:px-6 md:py-10">
          {desktopPanel}
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
        {desktopPanel}
      </div>

      {helpSheet}
      {guardDialog}
    </>
  );
}

export default function SettingsLayout(props: SettingsLayoutProps) {
  return (
    <SettingsAnchorRegistryProvider>
      <SettingsLayoutInner {...props} />
    </SettingsAnchorRegistryProvider>
  );
}
