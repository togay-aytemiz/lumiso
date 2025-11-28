import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarPlus } from "lucide-react";
import { SessionSchedulingSheet } from "@/components/SessionSchedulingSheet";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { useTranslation } from "react-i18next";
import { BaseOnboardingModal } from "@/components/shared/BaseOnboardingModal";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

interface ScheduleSessionDialogProps {
  leadId: string;
  leadName: string;
  onSessionScheduled?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  buttonClassName?: string;
  tutorialMode?: boolean;
  tutorialVideoUrl?: string;
}

const ScheduleSessionDialog = ({
  leadId,
  leadName,
  onSessionScheduled,
  disabled = false,
  disabledTooltip,
  buttonClassName,
  tutorialMode = false,
  tutorialVideoUrl
}: ScheduleSessionDialogProps) => {
  const { t } = useFormsTranslation();
  const { t: tPages } = useTranslation("pages");
  const [open, setOpen] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const sessionTutorialVideoUrl =
    tutorialVideoUrl ??
    (typeof process !== "undefined" ? process.env.VITE_SESSION_TUTORIAL_VIDEO_URL : undefined) ??
    "";
  const hasTutorialVideo = Boolean(sessionTutorialVideoUrl);

  useEffect(() => {
    if (!open) {
      setShowTutorialModal(false);
    }
  }, [open]);

  return (
    <>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled
                variant="outline"
                className={cn(
                  "opacity-50 cursor-not-allowed min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-800",
                  buttonClassName
                )}
              >
                <CalendarPlus className="h-4 w-4" />
                {t("sessions.schedule_new")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{disabledTooltip}</p>
            </TooltipContent>
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
        >
          <CalendarPlus className="h-4 w-4" />
          {t("sessions.schedule_new")}
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
        <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg bg-muted">
          {hasTutorialVideo ? (
            <iframe
              src={sessionTutorialVideoUrl}
              title={tPages("leadDetail.scheduling.sessionVideo.title", {
                defaultValue: "Watch how to plan a session",
              })}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {tPages("leadDetail.scheduling.sessionVideo.placeholder", {
                defaultValue: "Add your tutorial video URL to show it here.",
              })}
            </div>
          )}
        </AspectRatio>
      </BaseOnboardingModal>
    </>
  );
};

export default ScheduleSessionDialog;
