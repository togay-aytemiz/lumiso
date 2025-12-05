import { BaseOnboardingModal } from "@/components/shared/BaseOnboardingModal";
import { OnboardingVideo } from "@/components/shared/OnboardingVideo";

interface PageVideoModalProps {
  open: boolean;
  title: string;
  description?: string;
  videoId: string;
  onSnooze: () => void;
  onDontShowAgain: () => void;
  onClose?: () => void;
  labels?: {
    remindMeLater: string;
    dontShowAgain: string;
  };
}

export function PageVideoModal({
  open,
  title,
  description,
  videoId,
  onSnooze,
  onDontShowAgain,
  onClose,
  labels
}: PageVideoModalProps) {
  const effectiveLabels = labels ?? {
    remindMeLater: "Remind me later",
    dontShowAgain: "I watched, don't show again"
  };

  const actions = [
    {
      label: effectiveLabels.dontShowAgain,
      onClick: onDontShowAgain,
      variant: "surface" as const
    },
    {
      label: effectiveLabels.remindMeLater,
      onClick: onSnooze,
      variant: "surface" as const
    }
  ];

  return (
    <BaseOnboardingModal
      open={open}
      onClose={onClose || onSnooze}
      size="wide"
      contentClassName="gap-8 sm:gap-10"
      title={title}
      description={description}
      actions={actions}
    >
      <OnboardingVideo
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
        title={title}
      />
    </BaseOnboardingModal>
  );
}
