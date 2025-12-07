import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useOptionalOnboarding } from "@/contexts/OnboardingContext";
import { useToast } from "@/hooks/use-toast";

export function useOnboardingDeletionGuard() {
  const onboarding = useOptionalOnboarding?.() ?? null;
  const { toast } = useToast();
  const { t } = useTranslation("pages");

  const isDeletionBlocked = onboarding?.isInGuidedSetup ?? false;

  const showDeletionBlockedToast = useCallback(() => {
    toast({
      title: t("onboarding.restrictions.deleteTitle", {
        defaultValue: "Deletion locked during onboarding",
      }),
      description: t("onboarding.restrictions.deleteDescription", {
        defaultValue: "Finish the onboarding missions before deleting leads, projects, or sessions.",
      }),
    });
  }, [t, toast]);

  const ensureCanDelete = useCallback(() => {
    if (!isDeletionBlocked) return true;
    showDeletionBlockedToast();
    return false;
  }, [isDeletionBlocked, showDeletionBlockedToast]);

  return {
    isDeletionBlocked,
    ensureCanDelete,
    showDeletionBlockedToast,
  };
}
