import React, { useCallback, useState } from "react";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";
import { AddAction } from "@/components/AddAction";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
  helpTitle?: string;
  helpDescription?: string;
  helpVideoId?: string;
  helpVideoTitle?: string;
  helpVideoDescription?: string;
}

export function PageHeader({
  title,
  subtitle: _subtitle,
  children,
  className,
  sticky = false,
  helpTitle,
  helpDescription,
  helpVideoId,
  helpVideoTitle,
  helpVideoDescription,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const childrenArray = React.Children.toArray(children);
  const helpChannelUrl = "https://www.youtube.com/channel/UCH1JW6uO_ZIG8TsgtpFTjhA";

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
  const showHelpButton = Boolean(helpVideoId);
  const showMobileActions = showMobileSearch || showMobileAddAction || showHelpButton;

  const handleMobileSearchClick = useCallback(() => {
    navigate("/search", {
      state: {
        from: `${location.pathname}${location.search}${location.hash}`,
      },
    });
  }, [location.hash, location.pathname, location.search, navigate]);

  const handleHelpClick = useCallback(() => {
    if (!helpVideoId) return;
    setHelpModalOpen(true);
  }, [helpVideoId]);

  const handleHelpClose = useCallback(() => {
    setHelpModalOpen(false);
  }, []);

  const resolvedHelpTitle = helpTitle ?? helpVideoTitle ?? title;
  const helpModalTitle =
    helpTitle ??
    t("onboarding.sample_data.title", {
      defaultValue: resolvedHelpTitle,
    });

  const handleOpenChannel = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(helpChannelUrl, "_blank", "noopener,noreferrer");
  }, [helpChannelUrl]);

  const helpModalDescription =
    helpDescription ??
    helpVideoDescription ??
    t("onboarding.sample_data.description", {
      defaultValue: helpDescription ?? helpVideoDescription ?? resolvedHelpTitle,
    });

  return (
    <>
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
              {showMobileActions && (
                <div className="flex items-center gap-1.5">
                  {showHelpButton && (
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
              {showHelpButton ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-50 via-slate-100 to-white text-slate-600 shadow-none p-0 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:h-5 [&_svg]:w-5"
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

      {helpVideoId ? (
        <Dialog open={helpModalOpen} onOpenChange={setHelpModalOpen}>
          <DialogContent className="w-[min(640px,calc(100%-1.5rem))] max-w-3xl lg:w-[min(96vw,1120px)] lg:max-w-5xl p-0 gap-0 overflow-hidden rounded-xl sm:rounded-2xl border border-border/60">
            <div className="flex flex-col gap-0">
              <DialogHeader className="space-y-2 px-5 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-4 text-left">
                <DialogTitle className="text-2xl font-semibold leading-tight text-left">
                  {helpModalTitle}
                </DialogTitle>
                {helpModalDescription ? (
                  <DialogDescription className="text-base leading-relaxed text-muted-foreground text-left">
                    {helpModalDescription}
                  </DialogDescription>
                ) : null}
              </DialogHeader>

              <div className="px-5 sm:px-8 pb-5 sm:pb-8">
                <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm">
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      title={helpModalTitle}
                      className="h-full w-full"
                      src={`https://www.youtube.com/embed/${helpVideoId}?rel=0&modestbranding=1&playsinline=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="px-5 py-4 sm:px-8 sm:py-6 flex-col sm:flex-row sm:justify-end sm:space-x-3 gap-3">
                <Button
                  type="button"
                  variant="surface"
                  className="btn-surface-accent w-full sm:w-auto sm:min-w-[180px]"
                  onClick={handleOpenChannel}
                >
                  {t("buttons.viewMoreVideos", { defaultValue: "Diğer videolar" })}
                </Button>
                <Button
                  type="button"
                  variant="surface"
                  onClick={handleHelpClose}
                  className="w-full sm:w-auto sm:min-w-[140px]"
                >
                  {t("buttons.close")}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
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
