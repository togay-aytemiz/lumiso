import React, { useCallback } from "react";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";
import { AddAction } from "@/components/AddAction";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle: _subtitle,
  children,
  className,
  sticky = false,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const childrenArray = React.Children.toArray(children);

  const searchChild = childrenArray.find(
    (child) =>
      React.isValidElement(child) &&
      (child.type === PageHeaderSearch ||
        (typeof child.type === "function" &&
          (child.type as { displayName?: string }).displayName ===
            "PageHeaderSearch"))
  ) as React.ReactElement<PageHeaderSearchProps> | undefined;

  const otherChildren = childrenArray.filter((child) => child !== searchChild);
  const includeAddAction = searchChild?.props?.includeAddAction !== false;
  const hasChildren = childrenArray.length > 0;
  const showMobileSearch = Boolean(searchChild);
  const showMobileAddAction = showMobileSearch && includeAddAction;
  const showDesktopHelp = Boolean(searchChild);

  const handleMobileSearchClick = useCallback(() => {
    navigate("/search", {
      state: {
        from: `${location.pathname}${location.search}${location.hash}`,
      },
    });
  }, [location.hash, location.pathname, location.search, navigate]);

  const handleHelpClick = useCallback(() => {}, []);

  return (
    <div
      className={cn(
        "max-w-full border-b border-border/60 bg-white dark:bg-white",
        sticky && "lg:sticky lg:top-0 lg:z-10 lg:bg-white dark:lg:bg-white",
        className
      )}
    >
      <div className="px-4 sm:px-6 py-4 lg:py-5">
        {/* Mobile/Tablet Layout */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-shrink-0 min-w-0">
              <h1 className="text-lg font-medium truncate text-foreground transition-all duration-300 ease-out animate-in fade-in slide-in-from-left-2">
                {title}
              </h1>
            </div>
            {(showMobileSearch || showMobileAddAction) && (
              <div className="flex items-center gap-1.5">
                {showMobileSearch && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    data-touch-target="compact"
                    className="h-10 w-10 p-0 rounded-none border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-5"
                    aria-label={t("buttons.help", { defaultValue: "Yardım" })}
                    onClick={handleHelpClick}
                  >
                    <HelpCircle className="text-muted-foreground" />
                  </Button>
                )}
                {showMobileSearch && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    data-touch-target="compact"
                    onClick={handleMobileSearchClick}
                    className="h-10 w-10 p-0 rounded-none border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-5"
                    aria-label={t("buttons.search")}
                  >
                    <Search className="text-muted-foreground" />
                  </Button>
                )}
                {showMobileAddAction && <AddAction />}
              </div>
            )}
          </div>

          {otherChildren.length > 0 && (
            <div className="flex flex-col gap-3">{otherChildren}</div>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-[auto,minmax(0,1fr),auto] lg:items-center lg:gap-6">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-xl font-medium leading-tight truncate text-foreground transition-all duration-300 ease-out animate-in fade-in slide-in-from-left-2">
              {title}
            </h1>
          </div>

          <div
            className={cn(
              "flex items-center gap-3 min-w-0",
              !hasChildren && "justify-end"
            )}
          >
            {hasChildren ? children : null}
          </div>

          <div className="flex items-center justify-end gap-3">
            {showDesktopHelp ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted text-muted-foreground shadow-none p-0 hover:bg-muted/80 hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:h-5 [&_svg]:w-5"
                aria-label={t("buttons.help", { defaultValue: "Yardım" })}
                onClick={handleHelpClick}
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            ) : null}
            <UserMenu variant="header" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PageHeaderSearchProps {
  children: React.ReactNode;
  className?: string;
  includeAddAction?: boolean;
}

export function PageHeaderSearch({
  children,
  className,
  includeAddAction = true,
}: PageHeaderSearchProps) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 w-full transition-[flex-basis,max-width,width] duration-300 ease-out",
        className
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        {includeAddAction ? <AddAction className="flex-shrink-0" /> : null}
      </div>
    </div>
  );
}
PageHeaderSearch.displayName = "PageHeaderSearch";

interface PageHeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeaderActions({
  children,
  className,
}: PageHeaderActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end lg:justify-start",
        className
      )}
    >
      {children}
    </div>
  );
}
