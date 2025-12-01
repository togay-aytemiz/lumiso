import { BaseOnboardingModal } from "@/components/shared/BaseOnboardingModal";

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
      label: effectiveLabels.remindMeLater,
      onClick: onSnooze,
      variant: "outline" as const
    },
    {
      label: effectiveLabels.dontShowAgain,
      onClick: onDontShowAgain,
      variant: "cta" as const
    }
  ];

  return (
    <BaseOnboardingModal
      open={open}
      onClose={onClose || onSnooze}
      title={title}
      description={description}
      actions={actions}
    >
      <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm">
        <div className="aspect-video w-full bg-black">
          <iframe
            title={title}
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </BaseOnboardingModal>
  );
}
