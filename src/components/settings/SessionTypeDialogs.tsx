import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AppSheetModal } from "@/components/ui/app-sheet-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useModalNavigation } from "@/hooks/useModalNavigation";
import { NavigationGuardDialog } from "./NavigationGuardDialog";

export interface SessionType {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DurationOption {
  value: string;
  minutes: number | null;
  labelKey: string;
}

const SESSION_DURATION_OPTIONS: DurationOption[] = [
  { value: "30", minutes: 30, labelKey: "sessionType.durationOptions.30m" },
  { value: "45", minutes: 45, labelKey: "sessionType.durationOptions.45m" },
  { value: "60", minutes: 60, labelKey: "sessionType.durationOptions.60m" },
  { value: "90", minutes: 90, labelKey: "sessionType.durationOptions.90m" },
  { value: "120", minutes: 120, labelKey: "sessionType.durationOptions.120m" },
  { value: "180", minutes: 180, labelKey: "sessionType.durationOptions.180m" },
  { value: "240", minutes: 240, labelKey: "sessionType.durationOptions.240m" },
  { value: "480", minutes: 480, labelKey: "sessionType.durationOptions.480m" },
  { value: "custom", minutes: null, labelKey: "sessionType.durationOptions.custom" },
];

const DEFAULT_FORM_STATE = {
  name: "",
  category: "",
  description: "",
  durationOption: "60",
  customDuration: "",
  isActive: true,
  setAsDefault: false,
};

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AddSessionTypeDialogProps extends BaseDialogProps {
  onSessionTypeAdded: (payload: { sessionType: SessionType; setAsDefault: boolean }) => void;
  nextSortOrder: number;
}

interface EditSessionTypeDialogProps extends BaseDialogProps {
  sessionType: SessionType | null;
  defaultSessionTypeId: string | null;
  onSessionTypeUpdated: (payload: {
    sessionType: SessionType;
    setAsDefault: boolean;
    wasDefault: boolean;
  }) => void;
}

const parseDuration = (option: string, customValue: string): number | null => {
  if (option === "custom") {
    const minutes = parseInt(customValue.trim(), 10);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }
  const fromPreset = SESSION_DURATION_OPTIONS.find((opt) => opt.value === option);
  return fromPreset?.minutes ?? null;
};

const getDurationOptionForMinutes = (minutes: number): { option: string; customValue: string } => {
  const presetOption = SESSION_DURATION_OPTIONS.find(
    (opt) => opt.minutes !== null && opt.minutes === minutes
  );

  if (presetOption) {
    return { option: presetOption.value, customValue: "" };
  }

  return { option: "custom", customValue: minutes.toString() };
};

export function AddSessionTypeDialog({
  open,
  onOpenChange,
  onSessionTypeAdded,
  nextSortOrder,
}: AddSessionTypeDialogProps) {
  const { t } = useTranslation(["forms", "common"]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_STATE });

  useEffect(() => {
    if (open) {
      setFormData({ ...DEFAULT_FORM_STATE });
      setErrors({});
    }
  }, [open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("sessionType.errors.name_required", { ns: "forms" });
    }

    const minutes = parseDuration(formData.durationOption, formData.customDuration);
    if (!minutes) {
      newErrors.duration = t("sessionType.errors.duration_required", { ns: "forms" });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const organizationId = await getUserOrganizationId();
      if (!organizationId) throw new Error("Organization required");

      const durationMinutes = parseDuration(formData.durationOption, formData.customDuration);
      if (!durationMinutes) throw new Error("Duration invalid");

      const { data, error } = await supabase
        .from("session_types")
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          duration_minutes: durationMinutes,
          is_active: formData.isActive,
          sort_order: nextSortOrder,
        })
        .select("*")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Failed to load created session type");
      const createdSessionType = data as SessionType;

      toast({
        title: t("common.toast.success"),
        description: t("sessionTypes.success.added", { ns: "forms" }),
      });

      onSessionTypeAdded({
        sessionType: createdSessionType,
        setAsDefault: formData.setAsDefault,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating session type:", error);
      toast({
        title: t("common.toast.error"),
        description: error.message || t("sessionTypes.errors.add_failed", { ns: "forms" }),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    return (
      formData.name.trim() !== "" ||
      formData.category.trim() !== "" ||
      formData.description.trim() !== "" ||
      formData.durationOption !== DEFAULT_FORM_STATE.durationOption ||
      formData.customDuration.trim() !== "" ||
      formData.isActive !== DEFAULT_FORM_STATE.isActive ||
      formData.setAsDefault !== DEFAULT_FORM_STATE.setAsDefault
    );
  }, [formData]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      setFormData({ ...DEFAULT_FORM_STATE });
      setErrors({});
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      setFormData({ ...DEFAULT_FORM_STATE });
      setErrors({});
      onOpenChange(false);
    }
  };

  const footerActions = [
    {
      label: t("buttons.cancel", { ns: "common" }),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading,
    },
    {
      label: loading ? t("actions.saving", { ns: "common" }) : t("buttons.save", { ns: "common" }),
      onClick: handleSubmit,
      disabled: loading,
      loading,
    },
  ];

  return (
    <AppSheetModal
      title={t("sessionType.add_title", { ns: "forms" })}
      isOpen={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="session-type-name">
            {t("sessionType.name_label", { ns: "forms" })} *
          </Label>
          <Input
            id="session-type-name"
            value={formData.name}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder={t("sessionType.name_placeholder", { ns: "forms" })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-type-category">
            {t("sessionType.category_label", { ns: "forms" })}
          </Label>
          <Input
            id="session-type-category"
            value={formData.category}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, category: event.target.value }))
            }
            placeholder={t("sessionType.category_placeholder", { ns: "forms" })}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("sessionType.duration_label", { ns: "forms" })} *</Label>
          <Select
            value={formData.durationOption}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                durationOption: value,
                customDuration: value === "custom" ? prev.customDuration : "",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("sessionType.duration_placeholder", { ns: "forms" })} />
            </SelectTrigger>
            <SelectContent>
              {SESSION_DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey, { ns: "forms" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.durationOption === "custom" && (
            <Input
              className="mt-2"
              type="number"
              min={1}
              value={formData.customDuration}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, customDuration: event.target.value }))
              }
              placeholder={t("sessionType.custom_duration_placeholder", { ns: "forms" })}
            />
          )}
          {errors.duration && <p className="text-sm text-destructive">{errors.duration}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-type-description">
            {t("sessionType.description_label", { ns: "forms" })}
          </Label>
          <Textarea
            id="session-type-description"
            value={formData.description}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder={t("sessionType.description_placeholder", { ns: "forms" })}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("sessionType.default_label", { ns: "forms" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("sessionType.default_hint", { ns: "forms" })}
              </p>
            </div>
            <Switch
              checked={formData.setAsDefault}
              onCheckedChange={(value) =>
                setFormData((prev) => ({ ...prev, setAsDefault: value }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("sessionType.active_label", { ns: "forms" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("sessionType.active_hint", { ns: "forms" })}
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(value) =>
                setFormData((prev) => ({ ...prev, isActive: value }))
              }
            />
          </div>
        </div>
      </div>
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={navigation.message}
      />
    </AppSheetModal>
  );
}

export function EditSessionTypeDialog({
  open,
  onOpenChange,
  sessionType,
  defaultSessionTypeId,
  onSessionTypeUpdated,
}: EditSessionTypeDialogProps) {
  const { t } = useTranslation(["forms", "common"]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({ ...DEFAULT_FORM_STATE });

  useEffect(() => {
    if (open && sessionType) {
      const durationMeta = getDurationOptionForMinutes(sessionType.duration_minutes);
      setFormData({
        name: sessionType.name,
        category: sessionType.category ?? "",
        description: sessionType.description ?? "",
        durationOption: durationMeta.option,
        customDuration: durationMeta.customValue,
        isActive: sessionType.is_active,
        setAsDefault: sessionType.id === defaultSessionTypeId,
      });
      setErrors({});
    }
  }, [open, sessionType, defaultSessionTypeId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("sessionType.errors.name_required", { ns: "forms" });
    }

    const minutes = parseDuration(formData.durationOption, formData.customDuration);
    if (!minutes) {
      newErrors.duration = t("sessionType.errors.duration_required", { ns: "forms" });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const durationMinutes = parseDuration(formData.durationOption, formData.customDuration);
      if (!durationMinutes) throw new Error("Duration invalid");

      const { data, error } = await supabase
        .from("session_types")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          duration_minutes: durationMinutes,
          is_active: formData.isActive,
        })
        .eq("id", sessionType.id)
        .select("*")
        .single();

      if (error) throw error;
      const updatedSessionType =
        (data as SessionType | null) ??
        ({
          ...sessionType,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim() || null,
          duration_minutes: durationMinutes,
          is_active: formData.isActive,
        } as SessionType);

      toast({
        title: t("common.toast.success"),
        description: t("sessionTypes.success.updated", { ns: "forms" }),
      });

      onSessionTypeUpdated({
        sessionType: updatedSessionType,
        setAsDefault: formData.setAsDefault,
        wasDefault: sessionType.id === defaultSessionTypeId,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating session type:", error);
      toast({
        title: t("common.toast.error"),
        description: error.message || t("sessionTypes.errors.update_failed", { ns: "forms" }),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    if (!sessionType) return false;
    const durationMinutes = parseDuration(formData.durationOption, formData.customDuration);
    return (
      formData.name.trim() !== sessionType.name ||
      (formData.category.trim() || "") !== (sessionType.category ?? "") ||
      (formData.description.trim() || "") !== (sessionType.description ?? "") ||
      durationMinutes !== sessionType.duration_minutes ||
      formData.isActive !== sessionType.is_active ||
      formData.setAsDefault !== (sessionType.id === defaultSessionTypeId)
    );
  }, [formData, sessionType, defaultSessionTypeId]);

  const navigation = useModalNavigation({
    isDirty,
    onDiscard: () => {
      if (sessionType) {
        const durationMeta = getDurationOptionForMinutes(sessionType.duration_minutes);
        setFormData({
          name: sessionType.name,
          category: sessionType.category ?? "",
          description: sessionType.description ?? "",
          durationOption: durationMeta.option,
          customDuration: durationMeta.customValue,
          isActive: sessionType.is_active,
          setAsDefault: sessionType.id === defaultSessionTypeId,
        });
        setErrors({});
      }
      onOpenChange(false);
    },
    onSaveAndExit: async () => {
      await handleSubmit();
    }
  });

  const handleDirtyClose = () => {
    const canClose = navigation.handleModalClose();
    if (canClose) {
      if (sessionType) {
        const durationMeta = getDurationOptionForMinutes(sessionType.duration_minutes);
        setFormData({
          name: sessionType.name,
          category: sessionType.category ?? "",
          description: sessionType.description ?? "",
          durationOption: durationMeta.option,
          customDuration: durationMeta.customValue,
          isActive: sessionType.is_active,
          setAsDefault: sessionType.id === defaultSessionTypeId,
        });
        setErrors({});
      }
      onOpenChange(false);
    }
  };

  if (!sessionType) return null;

  const footerActions = [
    {
      label: t("buttons.cancel", { ns: "common" }),
      onClick: handleDirtyClose,
      variant: "outline" as const,
      disabled: loading,
    },
    {
      label: loading ? t("actions.saving", { ns: "common" }) : t("buttons.save", { ns: "common" }),
      onClick: handleSubmit,
      disabled: loading,
      loading,
    },
  ];

  return (
    <AppSheetModal
      title={t("sessionType.edit_title", { ns: "forms" })}
      isOpen={open}
      onOpenChange={onOpenChange}
      dirty={isDirty}
      onDirtyClose={handleDirtyClose}
      footerActions={footerActions}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="session-type-name-edit">
            {t("sessionType.name_label", { ns: "forms" })} *
          </Label>
          <Input
            id="session-type-name-edit"
            value={formData.name}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-type-category-edit">
            {t("sessionType.category_label", { ns: "forms" })}
          </Label>
          <Input
            id="session-type-category-edit"
            value={formData.category}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, category: event.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>{t("sessionType.duration_label", { ns: "forms" })} *</Label>
          <Select
            value={formData.durationOption}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                durationOption: value,
                customDuration: value === "custom" ? prev.customDuration : "",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("sessionType.duration_placeholder", { ns: "forms" })} />
            </SelectTrigger>
            <SelectContent>
              {SESSION_DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey, { ns: "forms" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.durationOption === "custom" && (
            <Input
              className="mt-2"
              type="number"
              min={1}
              value={formData.customDuration}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, customDuration: event.target.value }))
              }
              placeholder={t("sessionType.custom_duration_placeholder", { ns: "forms" })}
            />
          )}
          {errors.duration && <p className="text-sm text-destructive">{errors.duration}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-type-description-edit">
            {t("sessionType.description_label", { ns: "forms" })}
          </Label>
          <Textarea
            id="session-type-description-edit"
            value={formData.description}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, description: event.target.value }))
            }
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("sessionType.default_label", { ns: "forms" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("sessionType.default_hint", { ns: "forms" })}
              </p>
            </div>
            <Switch
              checked={formData.setAsDefault}
              onCheckedChange={(value) =>
                setFormData((prev) => ({ ...prev, setAsDefault: value }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("sessionType.active_label", { ns: "forms" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("sessionType.active_hint", { ns: "forms" })}
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(value) =>
                setFormData((prev) => ({ ...prev, isActive: value }))
              }
            />
          </div>
        </div>
      </div>
      <NavigationGuardDialog
        open={navigation.showGuard}
        onDiscard={navigation.handleDiscardChanges}
        onStay={navigation.handleStayOnModal}
        onSaveAndExit={navigation.handleSaveAndExit}
        message={navigation.message}
      />
    </AppSheetModal>
  );
}
