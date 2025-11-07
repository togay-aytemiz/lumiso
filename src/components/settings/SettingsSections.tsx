import { ReactNode, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { useSettingsAnchorRegistry } from "@/contexts/SettingsAnchorRegistryContext";
import { settingsClasses, settingsTokens } from "@/theme/settingsTokens";

export type SettingsSectionAction = {
  label: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
};

interface SettingsSectionBaseProps {
  sectionId: string;
  title: string;
  description?: string;
  eyebrow?: string;
  badge?: ReactNode;
  action?: SettingsSectionAction;
  actionSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dataWalkthrough?: string;
}

interface SettingsTwoColumnSectionProps extends SettingsSectionBaseProps {
  leftColumnFooter?: ReactNode;
}

interface SettingsSingleColumnSectionProps extends SettingsSectionBaseProps {
  headerAside?: ReactNode;
  toolbarSlot?: ReactNode;
}

export function SettingsTwoColumnSection({
  sectionId,
  title,
  description,
  eyebrow,
  badge,
  action,
  actionSlot,
  children,
  className,
  contentClassName,
  dataWalkthrough,
  leftColumnFooter,
}: SettingsTwoColumnSectionProps) {
  const { isDirty } = useSettingsSectionMeta(sectionId);
  const anchor = useMemo(
    () => ({ id: sectionId, label: title }),
    [sectionId, title]
  );
  useSettingsAnchorRegistry(anchor);

  return (
    <section
      id={sectionId}
      data-settings-section="true"
      data-settings-section-layout="two-column"
      data-settings-section-title={title}
      data-walkthrough={dataWalkthrough}
      className={cn(
        settingsClasses.sectionSurface,
        "scroll-mt-28",
        settingsTokens.section.padding,
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col",
          settingsTokens.section.gap,
          "md:grid",
          settingsTokens.section.twoColumnTemplate
        )}
      >
        <div className="space-y-5">
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            description={description}
            badge={badge}
            isDirty={isDirty}
          />
          <SectionActionArea action={action} actionSlot={actionSlot} />
          {leftColumnFooter}
        </div>
        <div
          className={cn(settingsTokens.section.contentGap, contentClassName)}
          data-settings-section-content
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function SettingsSingleColumnSection({
  sectionId,
  title,
  description,
  eyebrow,
  badge,
  action,
  actionSlot,
  children,
  className,
  contentClassName,
  dataWalkthrough,
  headerAside,
  toolbarSlot,
}: SettingsSingleColumnSectionProps) {
  const { isDirty } = useSettingsSectionMeta(sectionId);
  const anchor = useMemo(
    () => ({ id: sectionId, label: title }),
    [sectionId, title]
  );
  useSettingsAnchorRegistry(anchor);

  return (
    <section
      id={sectionId}
      data-settings-section="true"
      data-settings-section-layout="single-column"
      data-settings-section-title={title}
      data-walkthrough={dataWalkthrough}
      className={cn(
        settingsClasses.sectionSurface,
        "scroll-mt-28",
        settingsTokens.section.padding,
        className
      )}
    >
      <div
        className={cn("flex flex-col", settingsTokens.section.singleColumnStack)}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            description={description}
            badge={badge}
            isDirty={isDirty}
          />
          {headerAside}
        </div>
        {toolbarSlot}
        <SectionActionArea action={action} actionSlot={actionSlot} />
        <div
          className={cn(settingsTokens.section.contentGap, contentClassName)}
          data-settings-section-content
        >
          {children}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  badge,
  isDirty,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  isDirty: boolean;
}) {
  return (
    <div className="space-y-3">
      {eyebrow && (
        <p className={cn(settingsClasses.eyebrow, "text-muted-foreground/80")}>
          {eyebrow}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className={settingsClasses.sectionTitle}>{title}</h3>
        {isDirty && (
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            <span
              className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"
              aria-hidden="true"
            />
            <span className="sr-only">Unsaved changes</span>
          </span>
        )}
        {badge}
      </div>
      {description && (
        <p className={settingsClasses.sectionDescription}>{description}</p>
      )}
    </div>
  );
}

function SectionActionArea({
  action,
  actionSlot,
}: {
  action?: SettingsSectionAction;
  actionSlot?: ReactNode;
}) {
  if (!action && !actionSlot) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row",
        settingsTokens.section.actionGap
      )}
    >
      {action && <SectionActionButton action={action} />}
      {actionSlot}
    </div>
  );
}

function SectionActionButton({ action }: { action: SettingsSectionAction }) {
  const Icon = action.icon;
  return (
    <Button
      variant={action.variant ?? "secondary"}
      size={action.size ?? "sm"}
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      type={action.type ?? "button"}
      className={cn(
        "w-full justify-center sm:w-auto sm:justify-start",
        action.className
      )}
    >
      {action.loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {action.label}
    </Button>
  );
}

function useSettingsSectionMeta(sectionId: string) {
  const location = useLocation();
  const { categoryChanges } = useSettingsContext();
  const categoryPath = location.pathname;
  const sectionState = categoryChanges[categoryPath]?.[sectionId];

  return {
    isDirty: Boolean(sectionState?.isDirty),
  };
}
