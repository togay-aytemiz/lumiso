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

const routeActionMap: Array<{
  matcher: (pathname: string) => boolean;
  action: AddActionType;
}> = [
  { matcher: (pathname) => pathname.startsWith("/leads"), action: "lead" },
  { matcher: (pathname) => pathname.startsWith("/projects"), action: "project" },
  {
    matcher: (pathname) =>
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/sessions") ||
      pathname.startsWith("/reminders"),
    action: "session",
  },
];

function getPrimaryAction(pathname: string): AddActionType {
  const match = routeActionMap.find((entry) => entry.matcher(pathname));
  return match?.action ?? "lead";
}

export function AddAction({ className }: AddActionProps) {
  const location = useLocation();
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryAction = useMemo(
    () => getPrimaryAction(location.pathname),
    [location.pathname]
  );

  const labels: Record<AddActionType, string> = {
    lead: t("leads.addLead"),
    project: t("projects.addProject"),
    session: t("sessions.addButton"),
  };

  const primaryLabel =
    primaryAction === "lead"
      ? labels.lead
      : primaryAction === "project"
      ? labels.project
      : labels.session;

  const handleAction = (type: AddActionType) => {
    if (typeof window === "undefined") return;
    const eventName = ADD_ACTION_EVENTS[type];
    const event = new CustomEvent<AddActionEventDetail>(eventName, {
      detail: { source: "header", type },
    });
    window.dispatchEvent(event);
  };

  const dropdownItems: Array<{ type: AddActionType; label: string }> = [
    { type: "lead", label: labels.lead },
    { type: "project", label: labels.project },
    { type: "session", label: labels.session },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-px rounded-full border border-transparent bg-transparent",
        className
      )}
    >
      <Button
        type="button"
        className="h-12 rounded-l-full rounded-r-none px-3 sm:px-4"
        onClick={() => handleAction(primaryAction)}
        aria-label={primaryLabel ?? tCommon("buttons.new")}
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
            variant="secondary"
            className="h-12 w-10 rounded-l-none rounded-r-full px-0"
            aria-label={tCommon("buttons.moreOptions")}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-48">
          {dropdownItems.map((item) => (
            <DropdownMenuItem
              key={item.type}
              onSelect={() => handleAction(item.type)}
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
