import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, UserPlus, FolderPlus, CalendarClock } from "lucide-react";

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

  const actionLabels = useMemo(
    () => ({
      lead: t("leads.addLead"),
      project: t("projects.addProject"),
      session: t("sessions.addButton"),
      addNew: tCommon("buttons.addNew"),
    }),
    [t, tCommon]
  );

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
        label: actionLabels.lead,
        primaryAction: "lead",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/projects"),
        label: actionLabels.project,
        primaryAction: "project",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/calendar"),
        label: actionLabels.session,
        primaryAction: "session",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/sessions"),
        label: actionLabels.session,
        primaryAction: "session",
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/reminders"),
        label: actionLabels.session,
        primaryAction: "session",
      },
      {
        matcher: (pathname) => addNewRoutes.some((route) => matchesRoute(pathname, route)),
        label: actionLabels.addNew,
        primaryAction: null,
      },
    ];
  }, [actionLabels]);

  const currentConfig = useMemo<AddActionRouteConfig>(() => {
    const match = routeConfigs.find((config) => config.matcher(location.pathname));

    if (match) {
      return match;
    }

    return {
      matcher: () => true,
      label: actionLabels.addNew,
      primaryAction: null,
    };
  }, [routeConfigs, location.pathname, actionLabels.addNew]);

  const primaryLabel = currentConfig.label ?? tCommon("buttons.new");
  const recommendedType = currentConfig.primaryAction;

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
    setMenuVisible(true);
    requestAnimationFrame(() => {
      setMenuOpen(true);
    });
  }, []);

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

  const handlePrimaryButtonClick = () => {
    if (recommendedType) {
      if (menuOpen) {
        closeMenu();
      }

      handleAction(recommendedType);
      return;
    }

    toggleMenu();
  };

  const handleAction = (type: AddActionType) => {
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
      label: actionLabels.lead,
      description: addActionDescriptions.lead,
      icon: <UserPlus className="h-6 w-6" aria-hidden="true" />,
    },
    {
      type: "project",
      label: actionLabels.project,
      description: addActionDescriptions.project,
      icon: <FolderPlus className="h-6 w-6" aria-hidden="true" />,
    },
    {
      type: "session",
      label: actionLabels.session,
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

  return (
    <>
      <div
        ref={triggerRef}
        className={cn(
          "group relative flex items-center overflow-hidden rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-50 via-slate-100 to-white text-slate-900 transition-all duration-300 focus-within:ring-2 focus-within:ring-slate-300/70 focus-within:ring-offset-2 focus-within:ring-offset-background",
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
          className="group/button relative z-10 h-12 rounded-l-full rounded-r-none px-4 text-sm font-semibold tracking-tight text-slate-900 transition-all duration-200 hover:bg-slate-900/5 hover:text-slate-950 focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-5"
          onClick={handlePrimaryButtonClick}
          aria-label={primaryLabel ?? tCommon("buttons.new")}
          aria-haspopup={primaryButtonControlsMenu ? "menu" : undefined}
          aria-expanded={primaryButtonControlsMenu ? menuOpen : undefined}
        >
          <Plus className="h-4 w-4 text-slate-600 transition-transform duration-200 group-hover/button:scale-110 group-hover/button:text-slate-800 group-focus-visible/button:scale-110 group-focus-visible/button:text-slate-800" />
          <span
            className="hidden whitespace-nowrap text-base text-slate-600 transition-colors duration-200 group-hover/button:text-slate-800 group-focus-visible/button:text-slate-800 sm:inline"
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
          className="group/button relative z-10 h-12 w-11 rounded-l-none rounded-r-full px-0 text-slate-700 transition-all duration-200 hover:bg-slate-900/5 hover:text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 sm:w-12"
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

                  return (
                    <button
                      key={item.type}
                      ref={index === 0 ? firstCardRef : undefined}
                      type="button"
                      onClick={() => {
                        handleAction(item.type);
                        closeMenu();
                      }}
                      className={cn(
                        "add-action-card group relative flex h-full flex-col rounded-2xl border border-transparent bg-gradient-to-b from-white via-white/90 to-white/80 p-4 text-left shadow-lg shadow-slate-900/5 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary sm:p-5",
                        isRecommended &&
                          "border-primary/40 bg-gradient-to-b from-primary/10 via-white/90 to-white/80 shadow-primary/20"
                      )}
                      style={{ transitionDelay: menuOpen ? `${index * 70}ms` : "0ms" }}
                    >
                      {isRecommended ? (
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
                          <p className="text-sm text-muted-foreground">
                            {item.description}
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
