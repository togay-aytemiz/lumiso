import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, UserPlus, FolderPlus, CalendarClock, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ADD_ACTION_EVENTS,
  type AddActionEventDetail,
  type AddActionType,
} from "@/constants/addActionEvents";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { ProjectCreationWizardSheet } from "@/features/project-creation";
import NewSessionDialog from "@/components/NewSessionDialog";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { toast } from "@/hooks/use-toast";

import "./AddAction.css";

interface AddActionProps {
  className?: string;
}

interface AddActionRouteConfig {
  matcher: (pathname: string) => boolean;
  label: string;
  primaryAction: AddActionType | null;
}

const matchesRoute = (pathname: string, route: string) => {
  if (route === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === route || pathname.startsWith(`${route}/`);
};

export function AddAction({ className }: AddActionProps) {
  const location = useLocation();
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const { isInGuidedSetup, currentStepInfo } = useOnboarding();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
    left: number;
    strategy: "absolute" | "fixed";
  }>({ top: 0, right: 16, left: 16, strategy: "absolute" });
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );

  const actionLabels = useMemo(
    () => ({
      lead: t("leads.addLead"),
      project: t("projects.addProject"),
      session: t("sessions.addButton"),
      addNew: tCommon("buttons.addNew"),
    }),
    [t, tCommon]
  );

  const mobileActionLabels = useMemo(
    () => ({
      lead: "Kişi",
      project: "Proje",
      session: "Seans",
      addNew: "Ekle",
    }),
    []
  );

  const labels = isMobile ? mobileActionLabels : actionLabels;
  const isLeadOnboardingStep = isInGuidedSetup && currentStepInfo?.id === 1;
  const isSchedulingStep = isInGuidedSetup && currentStepInfo?.id === 4 && matchesRoute(location.pathname, "/leads");
  const isProjectsExploreStep =
    isInGuidedSetup &&
    currentStepInfo?.id === 3 &&
    matchesRoute(location.pathname, "/projects");
  const onboardingLockTitle = t("addAction.onboarding.lockedTitle", {
    defaultValue: "Finish your first mission",
  });
  const onboardingLockDescription = t("addAction.onboarding.lockedDescription", {
    defaultValue: "Add your first lead to unlock project and session creation.",
  });
  const onboardingLockLabel = t("addAction.onboarding.lockedLabel", {
    defaultValue: "Locked for onboarding",
  });
  const projectsExploreLockTitle = t("projects.messages.exploreLockAddActionTitle", {
    defaultValue: "Add menu disabled during this walkthrough",
  });
  const projectsExploreLockDescription = t("projects.messages.exploreLockAddActionDescription", {
    defaultValue: "Finish the Projects page mission before creating new leads, projects, or sessions.",
  });
  const schedulingLockTitle = t("leads.messages.schedulingLockAddActionTitle", {
    defaultValue: "Add menu disabled during this mission",
  });
  const schedulingLockDescription = t("leads.messages.schedulingLockAddActionDescription", {
    defaultValue: "Complete the scheduling mission by opening a lead and planning a session before adding new items.",
  });

  const routeConfigs = useMemo<AddActionRouteConfig[]>(() => {
    const addNewRoutes = [
      "/",
      "/dashboard",
      "/analytics",
      "/payments",
      "/workflows",
      "/templates",
    ];

    return [
      {
        matcher: (pathname) => matchesRoute(pathname, "/leads"),
        label: labels.lead,
        primaryAction: "lead",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/projects"),
        label: labels.project,
        primaryAction: "project",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/calendar"),
        label: labels.session,
        primaryAction: "session",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/sessions"),
        label: labels.session,
        primaryAction: "session",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/reminders"),
        label: labels.session,
        primaryAction: "session",
      },
      {
        matcher: (pathname) => addNewRoutes.some((route) => matchesRoute(pathname, route)),
        label: labels.addNew,
        primaryAction: null,
      },
    ];
  }, [labels]);

  const currentConfig = useMemo<AddActionRouteConfig>(() => {
    const match = routeConfigs.find((config) => config.matcher(location.pathname));

    if (match) {
      return match;
    }

    return {
      matcher: () => true,
      label: labels.addNew,
      primaryAction: null,
    };
  }, [routeConfigs, location.pathname, labels.addNew]);

  const isActionLocked = useCallback(
    (type: AddActionType) => {
      if (isSchedulingStep) return true;
      return isLeadOnboardingStep && type !== "lead";
    },
    [isLeadOnboardingStep, isSchedulingStep]
  );

  const primaryLabel = isLeadOnboardingStep
    ? labels.lead
    : currentConfig.label ?? tCommon("buttons.new");
  const recommendedType: AddActionType | null =
    isLeadOnboardingStep ? "lead" : isSchedulingStep ? null : currentConfig.primaryAction;

  const openFallbackDialog = useCallback((type: AddActionType) => {
    switch (type) {
      case "lead":
        setLeadDialogOpen(true);
        break;
      case "project":
        setProjectWizardOpen(true);
        break;
      case "session":
        setSessionDialogOpen(true);
        break;
    }
  }, []);

  const openMenu = useCallback(() => {
    if (isSchedulingStep) {
      toast({
        title: schedulingLockTitle,
        description: schedulingLockDescription,
      });
      return;
    }
    if (isProjectsExploreStep) {
      toast({
        title: projectsExploreLockTitle,
        description: projectsExploreLockDescription,
      });
      return;
    }
    setMenuVisible(true);
    requestAnimationFrame(() => {
      setMenuOpen(true);
    });
  }, [
    isProjectsExploreStep,
    isSchedulingStep,
    projectsExploreLockDescription,
    projectsExploreLockTitle,
    schedulingLockDescription,
    schedulingLockTitle,
  ]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      closeMenu();
      return;
    }

    openMenu();
  }, [closeMenu, menuOpen, openMenu]);

  const showLockedNotice = useCallback(() => {
    toast({
      title: onboardingLockTitle,
      description: onboardingLockDescription,
    });
  }, [onboardingLockDescription, onboardingLockTitle]);

  const showProjectsExploreLockedNotice = useCallback(() => {
    toast({
      title: projectsExploreLockTitle,
      description: projectsExploreLockDescription,
    });
  }, [projectsExploreLockDescription, projectsExploreLockTitle]);

  const showSchedulingLockedNotice = useCallback(() => {
    toast({
      title: schedulingLockTitle,
      description: schedulingLockDescription,
    });
  }, [schedulingLockDescription, schedulingLockTitle]);

  const handlePrimaryButtonClick = () => {
    if (isSchedulingStep) {
      showSchedulingLockedNotice();
      return;
    }
    if (isProjectsExploreStep) {
      showProjectsExploreLockedNotice();
      return;
    }
    if (recommendedType) {
      if (isActionLocked(recommendedType)) {
        showLockedNotice();
        if (!menuOpen) {
          openMenu();
        }
        return;
      }

      if (menuOpen) {
        closeMenu();
      }

      handleAction(recommendedType);
      return;
    }

    toggleMenu();
  };

  const handleAction = (type: AddActionType) => {
    if (isSchedulingStep) {
      showSchedulingLockedNotice();
      return;
    }
    if (isProjectsExploreStep) {
      showProjectsExploreLockedNotice();
      return;
    }
    if (isActionLocked(type)) {
      showLockedNotice();
      return;
    }

    if (typeof window === "undefined") {
      openFallbackDialog(type);
      return;
    }
    const eventName = ADD_ACTION_EVENTS[type];
    const event = new CustomEvent<AddActionEventDetail>(eventName, {
      detail: { source: "header", type },
      cancelable: true,
    });
    const wasCancelled = !window.dispatchEvent(event);
    if (!wasCancelled) {
      openFallbackDialog(type);
    }
  };

  const addActionDescriptions = useMemo(
    () => ({
      lead: t("addAction.descriptions.lead", {
        defaultValue: "Yeni kişi kayıtlarıyla müşteri listenizi büyütün.",
      }),
      project: t("addAction.descriptions.project", {
        defaultValue: "Projelerinizi planlayın ve ekibinizi organize edin.",
      }),
      session: t("addAction.descriptions.session", {
        defaultValue: "Takviminize yeni seanslar ekleyin ve ilerlemeyi takip edin.",
      }),
    }),
    [t]
  );

  const dropdownItems: Array<{
    type: AddActionType;
    label: string;
    description: string;
    icon: JSX.Element;
  }> = [
    {
      type: "lead",
      label: labels.lead,
      description: addActionDescriptions.lead,
      icon: <UserPlus className="h-6 w-6" aria-hidden="true" />,
    },
    {
      type: "project",
      label: labels.project,
      description: addActionDescriptions.project,
      icon: <FolderPlus className="h-6 w-6" aria-hidden="true" />,
    },
    {
      type: "session",
      label: labels.session,
      description: addActionDescriptions.session,
      icon: <CalendarClock className="h-6 w-6" aria-hidden="true" />,
    },
  ];

  useEffect(() => {
    if (!menuVisible) {
      return;
    }

    const updateMenuPosition = () => {
      if (!triggerRef.current) {
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const horizontalPadding = 16;
      const verticalOffset = 16;

      const computedTop = Math.min(
        Math.max(rect.bottom + verticalOffset, horizontalPadding),
        viewportHeight - verticalOffset
      );
      const isMobileViewport = viewportWidth < 640;

      if (isMobileViewport) {
        setMenuPosition({
          top: computedTop,
          right: horizontalPadding,
          left: horizontalPadding,
          strategy: "fixed",
        });
        return;
      }

      const computedRight = Math.max(viewportWidth - rect.right, horizontalPadding);

      setMenuPosition({
        top: computedTop,
        right: computedRight,
        left: horizontalPadding,
        strategy: "absolute",
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuVisible]);

  useEffect(() => {
    if (menuOpen && firstCardRef.current) {
      firstCardRef.current.focus();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    closeMenu();
  }, [closeMenu, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!menuOpen && menuVisible) {
      const timeout = window.setTimeout(() => {
        setMenuVisible(false);
      }, 360);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    if (menuOpen) {
      setMenuVisible(true);
    }
  }, [menuOpen, menuVisible]);

  const isFixedPosition = menuPosition.strategy === "fixed";
  const totalHorizontalPadding = menuPosition.left + menuPosition.right;
  const panelWidth = isFixedPosition ? `calc(100vw - ${totalHorizontalPadding}px)` : undefined;

  const primaryButtonControlsMenu = !recommendedType;
  const isGloballyLocked = isSchedulingStep || isProjectsExploreStep;

  return (
    <>
      <div
        ref={triggerRef}
        className={cn(
          "group relative flex items-center overflow-hidden rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-50 via-slate-100 to-white text-slate-900 transition-all duration-300 focus-within:ring-2 focus-within:ring-slate-300/70 focus-within:ring-offset-2 focus-within:ring-offset-background",
          isGloballyLocked && "opacity-70",
          className
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-slate-950/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        />
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "group/button relative z-10 rounded-l-full rounded-r-none px-3 text-sm font-semibold tracking-tight text-slate-900 transition-all duration-200 hover:bg-slate-900/5 hover:text-slate-950 focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12 sm:px-5 sm:text-base",
            isMobile ? "h-10" : "h-12",
            isGloballyLocked && "cursor-not-allowed"
          )}
          onClick={handlePrimaryButtonClick}
          aria-label={primaryLabel ?? tCommon("buttons.new")}
          aria-haspopup={primaryButtonControlsMenu ? "menu" : undefined}
          aria-expanded={primaryButtonControlsMenu ? menuOpen : undefined}
        >
          <Plus className="h-5 w-5 text-slate-600 transition-transform duration-200 group-hover/button:scale-110 group-hover/button:text-slate-800 group-focus-visible/button:scale-110 group-focus-visible/button:text-slate-800" />
          <span
            className="inline whitespace-nowrap text-sm text-slate-600 transition-colors duration-200 group-hover/button:text-slate-800 group-focus-visible/button:text-slate-800 sm:text-base"
            data-add-action-label
          >
            <span
              className="add-action-label"
              data-add-action-label-text={primaryLabel}
            >
              {primaryLabel}
            </span>
          </span>
        </Button>
        <Button
          type="button"
          className={cn(
            "group/button relative z-10 rounded-l-none rounded-r-full px-0 text-slate-700 transition-all duration-200 hover:bg-slate-900/5 hover:text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12 sm:w-12",
            isMobile ? "h-10 w-10" : "h-12 w-12",
            isGloballyLocked && "cursor-not-allowed"
          )}
          variant="ghost"
          aria-label={tCommon("buttons.moreOptions")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 h-7 w-px -translate-y-1/2 bg-slate-300"
          />
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 group-hover/button:-translate-y-0.5",
              menuOpen && "rotate-180"
            )}
          />
        </Button>
      </div>

      {menuVisible ? (
        <div
          role="dialog"
          aria-modal="true"
          data-state={menuOpen ? "open" : "closed"}
          className="add-action-overlay fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 p-3 sm:p-4 sm:justify-end backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeMenu();
            }
          }}
        >
          <div
            className="relative mx-auto w-full max-w-lg sm:max-w-2xl lg:max-w-3xl"
            style={{
              top: menuPosition.top,
              right: isFixedPosition ? undefined : menuPosition.right,
              left: isFixedPosition ? menuPosition.left : undefined,
              width: panelWidth,
              position: menuPosition.strategy,
            }}
          >
            <div
              data-state={menuOpen ? "open" : "closed"}
              className="add-action-panel rounded-3xl border border-white/10 bg-gradient-to-br from-white via-white/95 to-white/90 p-4 sm:p-6 shadow-2xl shadow-slate-900/20 ring-1 ring-white/40"
            >
              <div className="mb-4 space-y-1 sm:mb-5">
                <p className="text-sm font-medium uppercase tracking-normal text-muted-foreground sm:tracking-wide">
                  {t("addAction.title", { defaultValue: "Hızlı Ekle" })}
                </p>
                <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                  {t("addAction.subtitle", {
                    defaultValue: "Kişi ekle, proje başlat ya da seans planla",
                  })}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {dropdownItems.map((item, index) => {
                  const isRecommended = recommendedType === item.type;
                  const isLocked = isActionLocked(item.type);
                  const itemDescription = isLocked ? onboardingLockDescription : item.description;

                  const hoverClasses = !isLocked
                    ? "hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    : "";

                  return (
                    <button
                      key={item.type}
                      ref={index === 0 ? firstCardRef : undefined}
                      type="button"
                      aria-disabled={isLocked}
                      data-locked={isLocked ? "true" : undefined}
                      onClick={() => {
                        if (isLocked) {
                          showLockedNotice();
                          return;
                        }
                        handleAction(item.type);
                        closeMenu();
                      }}
                      className={cn(
                        "add-action-card group relative flex h-full flex-col rounded-2xl border border-transparent bg-gradient-to-b from-white via-white/90 to-white/80 p-4 text-left shadow-lg shadow-slate-900/5 transition duration-300 ease-out focus-visible:outline-none sm:p-5",
                        hoverClasses,
                        isRecommended &&
                          "border-primary/40 bg-gradient-to-b from-primary/10 via-white/90 to-white/80 shadow-primary/20",
                        isLocked &&
                          "cursor-not-allowed border-slate-200/80 bg-gradient-to-b from-slate-50/70 via-white/85 to-white/75 opacity-80 backdrop-blur-sm focus-visible:ring-0"
                      )}
                      style={{ transitionDelay: menuOpen ? `${index * 70}ms` : "0ms" }}
                    >
                      {isLocked ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="flex items-center gap-2 rounded-2xl bg-slate-800/95 px-3.5 py-2 text-[11px] font-semibold tracking-wide text-slate-50 shadow-md sm:px-4">
                            <Lock className="h-5 w-5" aria-hidden="true" />
                            <span className="text-center leading-tight">{onboardingLockLabel}</span>
                          </span>
                        </div>
                      ) : isRecommended ? (
                        <span className="absolute right-4 top-4 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary sm:right-5 sm:top-5 sm:px-3">
                          {t("addAction.recommended", { defaultValue: "Önerilen" })}
                        </span>
                      ) : null}
                      <div className="flex w-full flex-1 items-start gap-3 sm:flex-col sm:items-start sm:gap-5">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:-translate-y-1 group-hover:rotate-3 group-hover:scale-105 sm:h-14 sm:w-14">
                          {item.icon}
                        </span>
                        <div className="flex flex-1 flex-col gap-1.5">
                          <p className="text-base font-semibold leading-tight text-foreground">
                            {item.label}
                          </p>
                          <p className={cn("text-sm text-muted-foreground", isLocked && "text-muted-foreground/90")}>
                            {itemDescription}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <EnhancedAddLeadDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        onClose={() => setLeadDialogOpen(false)}
      />

      <ProjectCreationWizardSheet
        isOpen={projectWizardOpen}
        onOpenChange={setProjectWizardOpen}
        entrySource="header-add-action"
      />

      <NewSessionDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        showDefaultTrigger={false}
      />
    </>
  );
}
