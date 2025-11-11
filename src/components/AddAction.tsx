import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ADD_ACTION_EVENTS,
  type AddActionEventDetail,
  type AddActionType,
} from "@/constants/addActionEvents";

interface AddActionProps {
  className?: string;
}

interface AddActionRouteConfig {
  matcher: (pathname: string) => boolean;
  label: string;
  primaryAction: AddActionType | null;
  openMenuOnPrimary: boolean;
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
        openMenuOnPrimary: false,
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/projects"),
        label: actionLabels.project,
        primaryAction: "project",
        openMenuOnPrimary: false,
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/calendar"),
        label: actionLabels.session,
        primaryAction: "session",
        openMenuOnPrimary: false,
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/sessions"),
        label: actionLabels.lead,
        primaryAction: "lead",
        openMenuOnPrimary: false,
      },
      {
        matcher: (pathname) => matchesRoute(pathname, "/reminders"),
        label: actionLabels.lead,
        primaryAction: "lead",
        openMenuOnPrimary: false,
      },
      {
        matcher: (pathname) => addNewRoutes.some((route) => matchesRoute(pathname, route)),
        label: actionLabels.addNew,
        primaryAction: null,
        openMenuOnPrimary: true,
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
      openMenuOnPrimary: true,
    };
  }, [routeConfigs, location.pathname, actionLabels.addNew]);

  const primaryLabel = currentConfig.label ?? tCommon("buttons.new");

  const handlePrimaryButtonClick = () => {
    if (currentConfig.openMenuOnPrimary) {
      setMenuOpen((previous) => !previous);
      return;
    }

    if (currentConfig.primaryAction) {
      setMenuOpen(false);
      handleAction(currentConfig.primaryAction);
    }
  };

  const handleAction = (type: AddActionType) => {
    if (typeof window === "undefined") return;
    const eventName = ADD_ACTION_EVENTS[type];
    const event = new CustomEvent<AddActionEventDetail>(eventName, {
      detail: { source: "header", type },
    });
    window.dispatchEvent(event);
  };

  const dropdownItems: Array<{ type: AddActionType; label: string }> = [
    { type: "lead", label: actionLabels.lead },
    { type: "project", label: actionLabels.project },
    { type: "session", label: actionLabels.session },
  ];

  return (
    <div
      className={cn(
        "flex items-center overflow-hidden rounded-full border border-transparent bg-transparent",
        className
      )}
    >
      <Button
        type="button"
        className="h-12 rounded-l-full rounded-r-none px-3 sm:px-4"
        onClick={handlePrimaryButtonClick}
        aria-label={primaryLabel ?? tCommon("buttons.new")}
        aria-haspopup={currentConfig.openMenuOnPrimary ? "menu" : undefined}
        aria-expanded={currentConfig.openMenuOnPrimary ? menuOpen : undefined}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline whitespace-nowrap">
          {primaryLabel ?? tCommon("buttons.new")}
        </span>
      </Button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className="h-12 w-10 rounded-l-none rounded-r-full px-0"
            variant="default"
            aria-label={tCommon("buttons.moreOptions")}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-48">
          {dropdownItems.map((item) => (
            <DropdownMenuItem
              key={item.type}
              onSelect={() => {
                handleAction(item.type);
                setMenuOpen(false);
              }}
              className="flex items-center justify-between"
            >
              <span>{item.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
