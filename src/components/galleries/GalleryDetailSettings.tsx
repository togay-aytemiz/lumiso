import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CornerDownRight,
  Grid3x3,
  Image as ImageIcon,
  Settings,
  Shield,
  Stamp,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { settingsClasses } from "@/theme/settingsTokens";
import SettingsHeader from "@/components/settings/SettingsHeader";
import {
  SettingsCollectionSection,
  SettingsFormSection,
  SettingsToggleSection,
} from "@/components/settings/SettingsSectionVariants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { SettingsStickyFooter } from "@/components/settings/SettingsStickyFooter";

export type GallerySettingsTab = "general" | "watermark" | "privacy";

export type GalleryWatermarkPlacement = "grid" | "center" | "corner";
export type GalleryWatermarkType = "text" | "logo";

export type GalleryWatermarkSettings = {
  enabled: boolean;
  type: GalleryWatermarkType;
  placement: GalleryWatermarkPlacement;
  opacity: number;
  scale: number;
};

export type GalleryPrivacySettings = {
  passwordEnabled: boolean;
};

export function GallerySettingsRail({
  activeTab,
  onTabChange,
}: {
  activeTab: GallerySettingsTab;
  onTabChange: (tab: GallerySettingsTab) => void;
}) {
  const { t } = useTranslation("pages");

  const items = useMemo(
    () =>
      [
        { id: "general" as const, icon: Settings, label: t("sessionDetail.gallery.settings.rail.general") },
        { id: "watermark" as const, icon: Stamp, label: t("sessionDetail.gallery.settings.rail.watermark") },
        { id: "privacy" as const, icon: Shield, label: t("sessionDetail.gallery.settings.rail.privacy") },
      ] satisfies Array<{ id: GallerySettingsTab; label: string; icon: typeof Settings }>,
    [t]
  );

  return (
    <div className="space-y-3 pt-2">
      <p className={cn(settingsClasses.railSectionLabel, "px-3 text-[10px] font-semibold uppercase tracking-[0.28em]")}>
        {t("sessionDetail.gallery.settings.rail.sectionLabel")}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "settings-nav-item group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                "border border-transparent",
                isActive
                  ? "bg-[linear-gradient(135deg,_hsl(var(--accent-100)),_hsl(var(--accent-300)))] text-[hsl(var(--accent-900))] shadow-[0_26px_45px_-32px_hsl(var(--accent-400)_/_0.95)] border-[hsl(var(--accent-300))]"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0 transition-colors",
                  isActive ? "text-[hsl(var(--accent-700))]" : "text-muted-foreground/80"
                )}
                aria-hidden="true"
              />
              <span className="truncate text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type GallerySettingsGeneralModel = {
  title: string;
  onTitleChange: (value: string) => void;
  eventDate: string;
  onEventDateChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: Array<{ value: string; label: string }>;
  type: string;
  onTypeChange: (value: string) => void;
  typeOptions: Array<{ value: string; label: string }>;
  customType: string;
  onCustomTypeChange: (value: string) => void;
  autoSaveLabel: string;
  disableTypeEditing?: boolean;
};

type GallerySettingsSaveBar = {
  show: boolean;
  isSaving: boolean;
  showSuccess: boolean;
  onSave: () => void;
  onCancel: () => void;
};

type GallerySettingsWatermarkModel = {
  settings: GalleryWatermarkSettings;
  onSettingsChange: (updates: Partial<GalleryWatermarkSettings>) => void;
  textDraft: string;
  onTextDraftChange: (value: string) => void;
  businessName?: string | null;
  logoUrl?: string | null;
  coverUrl?: string;
  onOpenOrganizationBranding?: () => void;
};

type GallerySettingsPrivacyModel = {
  settings: GalleryPrivacySettings;
  onSettingsChange: (updates: Partial<GalleryPrivacySettings>) => void;
  passwordDraft: string;
  onPasswordDraftChange: (value: string) => void;
  onGeneratePassword?: () => void;
};

export function GallerySettingsContent({
  activeTab,
  general,
  watermark,
  privacy,
  saveBar,
}: {
  activeTab: GallerySettingsTab;
  general: GallerySettingsGeneralModel;
  watermark: GallerySettingsWatermarkModel;
  privacy: GallerySettingsPrivacyModel;
  saveBar: GallerySettingsSaveBar;
}) {
  const { t } = useTranslation("pages");
  const { t: tForms } = useTranslation("forms");

  const watermarkTextFallback =
    watermark.textDraft.trim() || watermark.businessName?.trim() || t("sessionDetail.gallery.settings.watermark.text.fallback");

  const watermarkEnabledClass = watermark.settings.enabled
    ? undefined
    : "opacity-60 grayscale pointer-events-none";

  if (activeTab === "general") {
    return (
      <div className="flex w-full flex-col gap-8 px-0 py-2">
        <SettingsHeader
          eyebrow={t("sessionDetail.gallery.settings.header.eyebrow")}
          title={t("sessionDetail.gallery.settings.general.header.title")}
          description={t("sessionDetail.gallery.settings.general.header.description")}
        />

        <div className="space-y-10">
          <SettingsFormSection
            sectionId="gallery-basics"
            title={t("sessionDetail.gallery.settings.general.basics.title")}
            description={t("sessionDetail.gallery.settings.general.basics.description")}
            fieldColumns={2}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("sessionDetail.gallery.form.titleLabel")}</Label>
              <Input
                value={general.title}
                onChange={(event) => general.onTitleChange(event.target.value)}
                placeholder={t("sessionDetail.gallery.form.titlePlaceholder")}
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label>{t("sessionDetail.gallery.form.eventDateLabel")}</Label>
              <DateTimePicker
                mode="date"
                value={general.eventDate}
                onChange={general.onEventDateChange}
                buttonClassName="w-full justify-between"
                popoverModal
                fullWidth
                todayLabel={tForms("dateTimePicker.today")}
                clearLabel={tForms("dateTimePicker.clear")}
                doneLabel={tForms("dateTimePicker.done")}
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label>{t("sessionDetail.gallery.form.statusLabel")}</Label>
              <Select value={general.status} onValueChange={general.onStatusChange}>
                <SelectTrigger className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {general.statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-0">
              <Label>{t("sessionDetail.gallery.form.typeLabel")}</Label>
              <Select
                value={general.type}
                disabled={general.disableTypeEditing ?? true}
                onValueChange={(value) => {
                  general.onTypeChange(value);
                  if (value !== "other") {
                    general.onCustomTypeChange("");
                  }
                }}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {general.typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={cn("space-y-2 min-w-0", general.type === "other" ? "opacity-100" : "opacity-0")}>
              <Label>{t("sessionDetail.gallery.form.customTypeLabel")}</Label>
              <Input
                value={general.customType}
                onChange={(event) => general.onCustomTypeChange(event.target.value)}
                placeholder={t("sessionDetail.gallery.form.customTypePlaceholder")}
                disabled={general.disableTypeEditing ?? true}
              />
            </div>

            <div className="sm:col-span-2 rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
              {general.autoSaveLabel}
            </div>
          </SettingsFormSection>
        </div>

        <SettingsStickyFooter
          show={saveBar.show}
          isSaving={saveBar.isSaving}
          showSuccess={saveBar.showSuccess}
          onSave={saveBar.onSave}
          onCancel={saveBar.onCancel}
        />
      </div>
    );
  }

  if (activeTab === "watermark") {
    const placementOptions = [
      {
        value: "grid",
        label: (
          <>
            <Grid3x3 className="h-4 w-4" aria-hidden="true" />
            {t("sessionDetail.gallery.settings.watermark.placement.grid")}
          </>
        ),
      },
      {
        value: "center",
        label: (
          <>
            <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full border border-current" />
            </span>
            {t("sessionDetail.gallery.settings.watermark.placement.center")}
          </>
        ),
      },
      {
        value: "corner",
        label: (
          <>
            <CornerDownRight className="h-4 w-4" aria-hidden="true" />
            {t("sessionDetail.gallery.settings.watermark.placement.corner")}
          </>
        ),
      },
    ];

    const typeOptions = [
      {
        value: "text",
        label: (
          <>
            <Type className="h-4 w-4" aria-hidden="true" />
            {t("sessionDetail.gallery.settings.watermark.type.text")}
          </>
        ),
      },
      {
        value: "logo",
        label: (
          <>
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            {t("sessionDetail.gallery.settings.watermark.type.logo")}
          </>
        ),
      },
    ];

    const WatermarkOverlay = () => {
      const opacityValue = watermark.settings.opacity / 100;
      const scaleValue = watermark.settings.scale / 100;

      const content =
        watermark.settings.type === "text" ? (
          <span
            className="select-none whitespace-nowrap text-lg font-semibold text-white drop-shadow-sm md:text-2xl"
            style={{ opacity: opacityValue, transform: `scale(${scaleValue})` }}
          >
            {watermarkTextFallback}
          </span>
        ) : watermark.logoUrl ? (
          <img
            src={watermark.logoUrl}
            alt={t("sessionDetail.gallery.settings.watermark.logo.alt")}
            className="max-h-14 object-contain drop-shadow-sm md:max-h-16"
            style={{ opacity: opacityValue, transform: `scale(${scaleValue})` }}
          />
        ) : (
          <span
            className="inline-flex select-none items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/90"
            style={{ opacity: opacityValue, transform: `scale(${scaleValue})` }}
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t("sessionDetail.gallery.settings.watermark.logo.missingInline")}
          </span>
        );

      if (watermark.settings.placement === "center") {
        return <div className="absolute inset-0 flex items-center justify-center">{content}</div>;
      }

      if (watermark.settings.placement === "corner") {
        return <div className="absolute inset-0 flex items-end justify-end p-6 md:p-8">{content}</div>;
      }

      return (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-8 p-8">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex items-center justify-center -rotate-12">
              {content}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="flex w-full flex-col gap-8 px-0 py-2">
        <SettingsHeader
          eyebrow={t("sessionDetail.gallery.settings.header.eyebrow")}
          title={t("sessionDetail.gallery.settings.watermark.header.title")}
          description={t("sessionDetail.gallery.settings.watermark.header.description")}
        />

        <div className="space-y-10">
          <SettingsCollectionSection
            sectionId="watermark-preview"
            title={t("sessionDetail.gallery.settings.watermark.preview.title")}
            description={t("sessionDetail.gallery.settings.watermark.preview.description")}
            unstyledBody
          >
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/30">
                {watermark.coverUrl ? (
                  <img
                    src={watermark.coverUrl}
                    alt={t("sessionDetail.gallery.labels.coverSelected")}
                    className={cn("h-full w-full object-cover", !watermark.settings.enabled && "grayscale opacity-70")}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className={cn(
                      "absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--muted)),_hsl(var(--background)))]",
                      !watermark.settings.enabled && "opacity-70"
                    )}
                  />
                )}

                {watermark.settings.enabled ? (
                  <div className="absolute inset-0 pointer-events-none">{WatermarkOverlay()}</div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                    <span className="rounded-full border border-border/60 bg-card/95 px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm">
                      {t("sessionDetail.gallery.settings.watermark.preview.disabled")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </SettingsCollectionSection>

          <SettingsToggleSection
            layout="two-column"
            sectionId="watermark-toggle"
            title={t("sessionDetail.gallery.settings.watermark.toggle.title")}
            description={t("sessionDetail.gallery.settings.watermark.toggle.description")}
            items={[
              {
                id: "watermark-enabled",
                title: t("sessionDetail.gallery.settings.watermark.toggle.title"),
                description: t("sessionDetail.gallery.settings.watermark.toggle.description"),
                control: (
                  <Switch
                    id="watermark-enabled"
                    checked={watermark.settings.enabled}
                    onCheckedChange={(checked) => watermark.onSettingsChange({ enabled: checked })}
                    aria-label={t("sessionDetail.gallery.settings.watermark.toggle.title")}
                  />
                ),
              },
            ]}
          />

          <div className="space-y-10">
            <SettingsFormSection
              sectionId="watermark-appearance"
              title={t("sessionDetail.gallery.settings.watermark.appearance.title")}
              description={t("sessionDetail.gallery.settings.watermark.appearance.description")}
              fieldColumns={2}
              className={watermarkEnabledClass}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("sessionDetail.gallery.settings.watermark.type.label")}</Label>
                <SegmentedControl
                  value={watermark.settings.type}
                  onValueChange={(value) => watermark.onSettingsChange({ type: value as GalleryWatermarkType })}
                  options={typeOptions}
                  className="w-full justify-between"
                />
              </div>

              {watermark.settings.type === "text" ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="watermark-text">{t("sessionDetail.gallery.settings.watermark.text.label")}</Label>
                  <Input
                    id="watermark-text"
                    value={watermark.textDraft}
                    onChange={(event) => watermark.onTextDraftChange(event.target.value)}
                    placeholder={t("sessionDetail.gallery.settings.watermark.text.placeholder")}
                  />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  {watermark.logoUrl ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 overflow-hidden rounded-xl border border-border/60 bg-background p-2">
                          <img
                            src={watermark.logoUrl}
                            alt={t("sessionDetail.gallery.settings.watermark.logo.alt")}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">
                            {t("sessionDetail.gallery.settings.watermark.logo.detectedTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("sessionDetail.gallery.settings.watermark.logo.detectedDescription")}
                          </p>
                        </div>
                      </div>
                      {watermark.onOpenOrganizationBranding ? (
                        <Button type="button" variant="outline" size="sm" onClick={watermark.onOpenOrganizationBranding}>
                          {t("sessionDetail.gallery.settings.watermark.logo.manage")}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">{t("sessionDetail.gallery.settings.watermark.logo.missingTitle")}</p>
                      <p className="text-xs text-amber-900/80">
                        {t("sessionDetail.gallery.settings.watermark.logo.missingDescription")}
                      </p>
                      {watermark.onOpenOrganizationBranding ? (
                        <Button type="button" variant="link" className="h-auto justify-start px-0 text-amber-900" onClick={watermark.onOpenOrganizationBranding}>
                          {t("sessionDetail.gallery.settings.watermark.logo.manage")}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </SettingsFormSection>

            <SettingsFormSection
              sectionId="watermark-layout"
              title={t("sessionDetail.gallery.settings.watermark.layout.title")}
              description={t("sessionDetail.gallery.settings.watermark.layout.description")}
              fieldColumns={2}
              className={watermarkEnabledClass}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("sessionDetail.gallery.settings.watermark.placement.label")}</Label>
                <SegmentedControl
                  value={watermark.settings.placement}
                  onValueChange={(value) => watermark.onSettingsChange({ placement: value as GalleryWatermarkPlacement })}
                  options={placementOptions}
                  className="w-full justify-between"
                />
              </div>

              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between">
                  <Label>{t("sessionDetail.gallery.settings.watermark.opacity.label")}</Label>
                  <span className="text-xs font-semibold text-muted-foreground">
                    %{watermark.settings.opacity}
                  </span>
                </div>
                <Slider
                  value={[watermark.settings.opacity]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={(values) => watermark.onSettingsChange({ opacity: values[0] ?? watermark.settings.opacity })}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("sessionDetail.gallery.settings.watermark.opacity.faint")}</span>
                  <span>{t("sessionDetail.gallery.settings.watermark.opacity.strong")}</span>
                </div>
              </div>

              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between">
                  <Label>{t("sessionDetail.gallery.settings.watermark.size.label")}</Label>
                  <span className="text-xs font-semibold text-muted-foreground">
                    %{watermark.settings.scale}
                  </span>
                </div>
                <Slider
                  value={[watermark.settings.scale]}
                  min={20}
                  max={200}
                  step={5}
                  onValueChange={(values) => watermark.onSettingsChange({ scale: values[0] ?? watermark.settings.scale })}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("sessionDetail.gallery.settings.watermark.size.small")}</span>
                  <span>{t("sessionDetail.gallery.settings.watermark.size.large")}</span>
                </div>
              </div>
            </SettingsFormSection>
          </div>
        </div>

        <SettingsStickyFooter
          show={saveBar.show}
          isSaving={saveBar.isSaving}
          showSuccess={saveBar.showSuccess}
          onSave={saveBar.onSave}
          onCancel={saveBar.onCancel}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-8 px-0 py-2">
      <SettingsHeader
        eyebrow={t("sessionDetail.gallery.settings.header.eyebrow")}
        title={t("sessionDetail.gallery.settings.privacy.header.title")}
        description={t("sessionDetail.gallery.settings.privacy.header.description")}
      />

      <div className="space-y-10">
        <SettingsToggleSection
          layout="two-column"
          sectionId="privacy-access"
          title={t("sessionDetail.gallery.settings.privacy.access.title")}
          description={t("sessionDetail.gallery.settings.privacy.access.description")}
          items={[
            {
              id: "gallery-password",
              title: t("sessionDetail.gallery.settings.privacy.password.toggleTitle"),
              description: t("sessionDetail.gallery.settings.privacy.password.toggleDescription"),
              control: (
                <Switch
                  id="gallery-password"
                  checked={privacy.settings.passwordEnabled}
                  onCheckedChange={(checked) => privacy.onSettingsChange({ passwordEnabled: checked })}
                  aria-label={t("sessionDetail.gallery.settings.privacy.password.toggleTitle")}
                />
              ),
            },
          ]}
        />

        {privacy.settings.passwordEnabled ? (
          <SettingsFormSection
            sectionId="privacy-password"
            title={t("sessionDetail.gallery.settings.privacy.password.formTitle")}
            description={t("sessionDetail.gallery.settings.privacy.password.formDescription")}
            fieldColumns={2}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="gallery-password-input">{t("sessionDetail.gallery.settings.privacy.password.label")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="gallery-password-input"
                  value={privacy.passwordDraft}
                  onChange={(event) => privacy.onPasswordDraftChange(event.target.value)}
                  placeholder={t("sessionDetail.gallery.settings.privacy.password.placeholder")}
                />
                {privacy.onGeneratePassword ? (
                  <Button type="button" variant="outline" onClick={privacy.onGeneratePassword} className="sm:w-auto">
                    {t("sessionDetail.gallery.settings.privacy.password.generate")}
                  </Button>
                ) : null}
              </div>
            </div>
          </SettingsFormSection>
        ) : null}
      </div>

      <SettingsStickyFooter
        show={saveBar.show}
        isSaving={saveBar.isSaving}
        showSuccess={saveBar.showSuccess}
        onSave={saveBar.onSave}
        onCancel={saveBar.onCancel}
      />
    </div>
  );
}
