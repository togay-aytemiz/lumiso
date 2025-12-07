import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContentDark, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarPlus } from "lucide-react";
import { SessionSchedulingSheet } from "@/components/SessionSchedulingSheet";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { BaseOnboardingModal } from "@/components/shared/BaseOnboardingModal";
import { OnboardingVideo } from "@/components/shared/OnboardingVideo";
import { cn } from "@/lib/utils";

interface ScheduleSessionDialogProps {
  leadId: string;
  leadName: string;
  onSessionScheduled?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  mobileButtonLabel?: string;
  hideIconOnMobile?: boolean;
  tutorialMode?: boolean;
  tutorialVideoUrl?: string;
  onDisabledClick?: () => void;
}

const DEFAULT_SESSION_TUTORIAL_VIDEO_URL = "https://www.youtube.com/embed/na7ByGdB6Mg";

const normalizeTutorialVideoUrl = (url?: string) => {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const existingEmbedPath = parsed.pathname.includes("/embed/");
      const videoId = parsed.searchParams.get("v");

      if (existingEmbedPath || !videoId) {
        return url;
      }

      return `https://www.youtube.com/embed/${videoId}`;
    }
  } catch {
    return url;
  }

  return url;
};

const ScheduleSessionDialog = ({
  leadId,
  leadName,
  onSessionScheduled,
  disabled = false,
  disabledTooltip,
  buttonClassName,
  buttonLabel,
  mobileButtonLabel,
  hideIconOnMobile = false,
  tutorialMode = false,
  tutorialVideoUrl,
  onDisabledClick
}: ScheduleSessionDialogProps) => {
  const { t } = useFormsTranslation();
  const { t: tPages } = useTranslation("pages");
  const [open, setOpen] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envTutorialVideoUrl =
    typeof process !== "undefined" ? process.env.VITE_SESSION_TUTORIAL_VIDEO_URL : undefined;
  const sessionTutorialVideoUrl =
    tutorialVideoUrl ||
    envTutorialVideoUrl ||
    DEFAULT_SESSION_TUTORIAL_VIDEO_URL;
  const normalizedTutorialVideoUrl = normalizeTutorialVideoUrl(sessionTutorialVideoUrl);
  const hasTutorialVideo = Boolean(normalizedTutorialVideoUrl);
  const desktopLabel = buttonLabel ?? t("sessions.schedule_new");
  const mobileLabel = mobileButtonLabel ?? desktopLabel;
  const iconClassName = cn("h-4 w-4", hideIconOnMobile && "hidden sm:inline");

  const renderButtonLabel = () => {
    if (desktopLabel === mobileLabel) {
      return desktopLabel;
    }

    return (
      <>
        <span className="sm:hidden">{mobileLabel}</span>
        <span className="hidden sm:inline">{desktopLabel}</span>
      </>
    );
  };

  useEffect(() => {
    if (!open) {
      setShowTutorialModal(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  const triggerTooltip = () => {
    setShowTooltip(true);
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 1800);
  };

  return (
    <>
      {disabled ? (
        <TooltipProvider>
          <Tooltip
            open={showTooltip}
            onOpenChange={setShowTooltip}
            delayDuration={0}
          >
          <TooltipTrigger asChild>
            <span
              className="inline-flex"
              onPointerDown={(event) => {
                event.preventDefault();
                onDisabledClick?.();
                triggerTooltip();
              }}
            >
              <Button
                disabled
                  variant="outline"
                  className={cn(
                    "opacity-50 cursor-not-allowed min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-800",
                    buttonClassName
                  )}
                  aria-label={desktopLabel}
                >
                  <CalendarPlus className={iconClassName} />
                  {renderButtonLabel()}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContentDark className="max-w-xs text-sm leading-snug break-words">
              <p>{disabledTooltip}</p>
            </TooltipContentDark>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          onClick={() => {
            setOpen(true);
            if (tutorialMode) {
              setShowTutorialModal(true);
            }
          }}
          className={cn(
            "min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900",
            buttonClassName
          )}
          variant="outline"
          size="sm"
          aria-label={desktopLabel}
        >
          <CalendarPlus className={iconClassName} />
          {renderButtonLabel()}
        </Button>
      )}

      <SessionSchedulingSheet
        leadId={leadId}
        leadName={leadName}
        isOpen={open}
        onOpenChange={setOpen}
        onSessionScheduled={onSessionScheduled}
      />

      <BaseOnboardingModal
        open={tutorialMode && showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        size="wide"
        title={tPages("leadDetail.scheduling.sessionVideo.title", {
          defaultValue: "Watch how to plan a session",
        })}
        description={tPages("leadDetail.scheduling.sessionVideo.description", {
          defaultValue: "Quick walkthrough before you book the first session.",
        })}
        actions={[
          {
            label: tPages("leadDetail.scheduling.sessionVideo.skip", {
              defaultValue: "Skip for now",
            }),
            onClick: () => setShowTutorialModal(false),
            variant: "outline",
          },
          {
            label: tPages("leadDetail.scheduling.sessionVideo.cta", {
              defaultValue: "Next: start scheduling",
            }),
            onClick: () => setShowTutorialModal(false),
          },
        ]}
      >
        {hasTutorialVideo ? (
          <OnboardingVideo
            src={normalizedTutorialVideoUrl}
            title={tPages("leadDetail.scheduling.sessionVideo.title", {
              defaultValue: "Watch how to plan a session",
            })}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-lg sm:min-h-[460px] lg:min-h-[520px]">
            <div className="aspect-video w-full">
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {tPages("leadDetail.scheduling.sessionVideo.placeholder", {
                  defaultValue: "Add your tutorial video URL to show it here.",
                })}
              </div>
            </div>
          </div>
        )}
      </BaseOnboardingModal>
    </>
  );
};

export default ScheduleSessionDialog;
