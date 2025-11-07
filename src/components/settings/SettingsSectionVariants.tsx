import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SettingsSingleColumnSection,
  SettingsTwoColumnSection,
  type SettingsSectionAction,
} from "@/components/settings/SettingsSections";

type BaseTwoColumnProps = Omit<
  Parameters<typeof SettingsTwoColumnSection>[0],
  "children"
> & {
  children: ReactNode;
};

type BaseSingleColumnProps = Omit<
  Parameters<typeof SettingsSingleColumnSection>[0],
  "children"
> & {
  children?: ReactNode;
};

export interface SettingsFormSectionProps extends BaseTwoColumnProps {
  fieldColumns?: 1 | 2;
  contentGapClassName?: string;
}

export function SettingsFormSection({
  fieldColumns = 1,
  contentGapClassName,
  children,
  ...sectionProps
}: SettingsFormSectionProps) {
  const gridClass =
    fieldColumns === 2
      ? "grid gap-4 sm:grid-cols-2"
      : "flex flex-col gap-4";

  return (
    <SettingsTwoColumnSection
      {...sectionProps}
      contentClassName={cn("space-y-6", sectionProps.contentClassName)}
    >
      <div className={cn(gridClass, contentGapClassName)}>{children}</div>
    </SettingsTwoColumnSection>
  );
}

export interface SettingsCollectionSectionProps extends BaseSingleColumnProps {
  bodyClassName?: string;
  footer?: ReactNode;
  headerAside?: ReactNode;
}

export function SettingsCollectionSection({
  bodyClassName,
  footer,
  headerAside,
  children,
  ...sectionProps
}: SettingsCollectionSectionProps) {
  return (
    <SettingsSingleColumnSection
      {...sectionProps}
      headerAside={headerAside ?? sectionProps.headerAside}
      contentClassName={cn("space-y-6", sectionProps.contentClassName)}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm",
          bodyClassName
        )}
      >
        {children}
      </div>
      {footer}
    </SettingsSingleColumnSection>
  );
}

export type SettingsToggleItem = {
  id: string;
  title: string;
  description?: string;
  control: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
};

type ToggleSingleColumnProps = Omit<BaseSingleColumnProps, "children">;
type ToggleTwoColumnProps =
  Omit<BaseTwoColumnProps, "children"> & { leftColumnFooter?: ReactNode };

export type SettingsToggleSectionProps =
  | ({
      layout?: "single";
      items: SettingsToggleItem[];
    } & ToggleSingleColumnProps)
  | ({
      layout: "two-column";
      items: SettingsToggleItem[];
    } & ToggleTwoColumnProps);

export function SettingsToggleSection({
  items,
  ...sectionProps
}: SettingsToggleSectionProps) {
  const content = (
    <div className="divide-y divide-border/70 rounded-2xl border border-border/60 bg-card">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-start gap-3">
              {Icon && (
                <span className="mt-0.5 rounded-xl bg-muted p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              {item.meta && (
                <span className="text-xs text-muted-foreground">{item.meta}</span>
              )}
              {item.control}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (sectionProps.layout === "two-column") {
    const { layout, leftColumnFooter, ...twoColumnProps } = sectionProps;
    return (
      <SettingsTwoColumnSection
        {...(twoColumnProps as ToggleTwoColumnProps)}
        contentClassName={cn("space-y-4", twoColumnProps.contentClassName)}
        leftColumnFooter={leftColumnFooter}
      >
        {content}
      </SettingsTwoColumnSection>
    );
  }

  const { layout, ...singleColumnProps } = sectionProps;
  return (
    <SettingsSingleColumnSection
      {...(singleColumnProps as ToggleSingleColumnProps)}
      contentClassName={cn("space-y-4", singleColumnProps.contentClassName)}
    >
      {content}
    </SettingsSingleColumnSection>
  );
}

export interface SettingsDangerSectionProps extends BaseSingleColumnProps {
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function SettingsDangerSection({
  icon: Icon,
  actions,
  children,
  ...sectionProps
}: SettingsDangerSectionProps) {
  return (
    <SettingsSingleColumnSection
      {...sectionProps}
      className={cn("border border-destructive/40 bg-destructive/5", sectionProps.className)}
      contentClassName={cn("space-y-5", sectionProps.contentClassName)}
      badge={sectionProps.badge ?? (
        <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
          Danger
        </span>
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="rounded-xl bg-destructive/10 p-3 text-destructive">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="flex-1 space-y-3 text-sm text-destructive">
          {children}
        </div>
      </div>
      {actions && <div className="flex justify-end gap-2">{actions}</div>}
    </SettingsSingleColumnSection>
  );
}

export interface SettingsPlaceholderSectionProps
  extends Omit<BaseSingleColumnProps, "action" | "actionSlot" | "children"> {
  illustration?: ReactNode;
  description: string;
  primaryAction?: SettingsSectionAction;
  secondaryAction?: SettingsSectionAction;
}

export function SettingsPlaceholderSection({
  illustration,
  description,
  primaryAction,
  secondaryAction,
  ...sectionProps
}: SettingsPlaceholderSectionProps) {
  return (
    <SettingsSingleColumnSection
      {...sectionProps}
      action={primaryAction}
      actionSlot={
        secondaryAction ? (
          <Button
            type={secondaryAction.type ?? "button"}
            variant={secondaryAction.variant ?? "ghost"}
            size={secondaryAction.size ?? "sm"}
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className={cn("text-muted-foreground", secondaryAction.className)}
          >
            {secondaryAction.label}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        {illustration}
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </SettingsSingleColumnSection>
  );
}

export type { SettingsSectionAction };
