import { useEffect, useState } from "react";
import { Sparkles, CircleOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  BaseOnboardingModal,
  type OnboardingAction,
} from "./shared/BaseOnboardingModal";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { canonicalizeProjectTypeSlug } from "@/lib/projectTypes";

interface SampleDataModalProps {
  open: boolean;
  onClose: () => void;
  onCloseAll?: () => void;
}

type SkipChoice = "sample" | "clean";

export function SampleDataModal({
  open,
  onClose,
  onCloseAll,
}: SampleDataModalProps) {
  const { t } = useTranslation("pages");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SkipChoice | null>(null);
  const [isChoosingSkip, setIsChoosingSkip] = useState(false);
  const { startGuidedSetup, skipOnboarding } = useOnboarding();
  const { activeOrganizationId } = useOrganization();
  const { settings, updateSettings, refreshSettings } =
    useOrganizationSettings();
  const modalTitle = isChoosingSkip
    ? t("onboarding.sample_data.choice_title")
    : t("onboarding.sample_data.title");
  const modalDescription = isChoosingSkip
    ? t("onboarding.sample_data.choice_description")
    : t("onboarding.sample_data.description");

  useEffect(() => {
    if (open) {
      setSelectedOption(null);
      setIsChoosingSkip(false);
      setIsLoading(false);
    }
  }, [open]);

  const startOptions: Array<{
    value: SkipChoice;
    icon: typeof Sparkles;
    titleKey: string;
    descriptionKey: string;
    recommended?: boolean;
  }> = [
    {
      value: "sample",
      icon: Sparkles,
      titleKey: "onboarding.sample_data.options.sample.title",
      descriptionKey: "onboarding.sample_data.options.sample.description",
      recommended: true,
    },
    {
      value: "clean",
      icon: CircleOff,
      titleKey: "onboarding.sample_data.options.clean.title",
      descriptionKey: "onboarding.sample_data.options.clean.description",
    },
  ];

  const handleSkipWithSampleData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await ensureSeedPreference(true);
      await seedSampleData();
      await skipOnboarding();

      toast({
        title: t("onboarding.sample_data.toast.success_title"),
        description: t("onboarding.sample_data.toast.success_description"),
      });

      closeAndNavigate();
    } catch (error) {
      console.error("Error skipping setup:", error);
      toast({
        title: t("onboarding.sample_data.toast.error_title"),
        description: t("onboarding.sample_data.toast.error_description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipWithoutSampleData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await ensureSeedPreference(false);
      await skipOnboarding();

      toast({
        title: t("onboarding.sample_data.toast.clean_title"),
        description: t("onboarding.sample_data.toast.clean_description"),
      });

      closeAndNavigate();
    } catch (error) {
      console.error("Error skipping setup:", error);
      toast({
        title: t("onboarding.sample_data.toast.error_title"),
        description: t("onboarding.sample_data.toast.error_description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const closeAndNavigate = () => {
    if (onCloseAll) {
      onCloseAll();
    } else {
      onClose();
    }
    navigate("/", { replace: true });
  };

  const ensureSeedPreference = async (value: boolean) => {
    if (!settings?.organization_id && !activeOrganizationId) {
      throw new Error("missing-organization");
    }
    if (settings?.seed_sample_data_onboarding === value) {
      return;
    }
    const result = await updateSettings({
      seed_sample_data_onboarding: value,
    });
    if (!result?.success) {
      throw result?.error ?? new Error("failed-to-update-settings");
    }
    await refreshSettings();
  };

  const seedSampleData = async () => {
    if (!user?.id) {
      throw new Error("missing-user");
    }
    const orgId = settings?.organization_id ?? activeOrganizationId;
    if (!orgId) {
      throw new Error("missing-organization");
    }

    const preferredSlugs = (settings?.preferred_project_types ?? [])
      .map((slug) => canonicalizeProjectTypeSlug(slug))
      .filter((slug): slug is string => Boolean(slug));
    const locale = settings?.preferred_locale ?? "tr";

    const { error } = await supabase.rpc("seed_sample_data_for_org", {
      owner_uuid: user.id,
      org_id: orgId,
      final_locale: locale,
      preferred_slugs: preferredSlugs,
    });

    if (error) {
      throw error;
    }
  };

  const handleContinueGuidedSetup = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await startGuidedSetup();

      if (onCloseAll) {
        onCloseAll();
      } else {
        onClose();
      }
      navigate("/getting-started");
    } catch (error) {
      console.error("Error starting guided setup:", error);
      toast({
        title: t("onboarding.sample_data.toast.error_title"),
        description: t("onboarding.sample_data.toast.setup_error"),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handlePrimaryAction = () => {
    if (!isChoosingSkip) {
      setIsChoosingSkip(true);
      setSelectedOption(null);
      return;
    }

    if (!selectedOption) return;

    if (selectedOption === "sample") {
      return handleSkipWithSampleData();
    }
    return handleSkipWithoutSampleData();
  };

  const primaryLabel = !isChoosingSkip
    ? t("onboarding.modal.skip_sample_data")
    : selectedOption === "sample"
    ? isLoading
      ? t("onboarding.sample_data.setting_up")
      : t("onboarding.sample_data.start_with_sample_data")
    : selectedOption === "clean"
    ? isLoading
      ? t("onboarding.sample_data.preparing_clean")
      : t("onboarding.sample_data.start_clean")
    : t("onboarding.modal.skip_sample_data");

  const actions: OnboardingAction[] = [
    {
      label: isLoading
        ? t("onboarding.sample_data.starting")
        : isChoosingSkip
        ? t("onboarding.sample_data.return_to_setup")
        : t("onboarding.sample_data.continue_guided_setup"),
      onClick: handleContinueGuidedSetup,
      variant: "surface",
      className: "btn-surface-accent",
      disabled: isLoading,
    },
    {
      label: primaryLabel,
      onClick: handlePrimaryAction,
      variant: "surface",
      disabled: isLoading || (isChoosingSkip && !selectedOption),
      tooltip:
        isChoosingSkip && !selectedOption
          ? {
              content: t("onboarding.sample_data.select_option_tooltip"),
              variant: "dark",
            }
          : undefined,
    },
  ];

  return (
    <BaseOnboardingModal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      actions={actions}
    >
      <div
        className={cn(
          "transition-all duration-300 ease-out overflow-hidden",
          isChoosingSkip
            ? "max-h-[520px] opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
        )}
        aria-hidden={!isChoosingSkip}
        data-testid="skip-options"
      >
        <div className="space-y-3 pt-4">
          {startOptions.map((option) => {
            const Icon = option.icon;
            const active = selectedOption === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={isLoading}
                onClick={() => setSelectedOption(option.value)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  active
                    ? "border-primary bg-background shadow-sm ring-offset-background"
                    : "border-border/70 bg-muted/30 hover:bg-muted/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "rounded-full p-2 text-primary bg-primary/10",
                      option.value === "clean" && "text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground">
                        {t(option.titleKey)}
                      </p>
                      {option.recommended && (
                        <Badge variant="outline" className="text-xs">
                          {t("onboarding.sample_data.recommended")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(option.descriptionKey)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BaseOnboardingModal>
  );
}
