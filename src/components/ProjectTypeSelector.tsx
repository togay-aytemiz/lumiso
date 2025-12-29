import { useCallback, useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { getDisplayProjectTypeName, getProjectTypeMatchKey } from "@/lib/projectTypes";
import { useTranslation } from "react-i18next";

interface ProjectType {
  id: string;
  name: string;
  is_default: boolean;
  template_slug?: string | null;
  sort_order?: number | null;
}

interface ProjectTypeSelectorProps {
  value?: string;
  onValueChange: (value: string, meta?: { isAutomatic?: boolean }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function ProjectTypeSelector({
  value,
  onValueChange,
  placeholder = "Select project type...",
  disabled = false,
  className,
  required = false
}: ProjectTypeSelectorProps) {
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useI18nToast();
  const { settings: orgSettings, loading: settingsLoading } = useOrganizationSettings();
  const { i18n, t } = useTranslation("forms");
  const locale = orgSettings?.locale ?? i18n.language;
  const defaultBadge = t("sessionTypes.default_badge", { defaultValue: "Default" });

  const preferredMatchKeys = useMemo(
    () =>
      (orgSettings?.preferred_project_types ?? [])
        .map(getProjectTypeMatchKey)
        .filter((slug) => slug.length > 0),
    [orgSettings?.preferred_project_types]
  );

  const preferredMatchKeySet = useMemo(() => new Set(preferredMatchKeys), [preferredMatchKeys]);

  const preferredSlugOrder = useMemo(
    () => new Map(preferredMatchKeys.map((slug, index) => [slug, index])),
    [preferredMatchKeys]
  );

  const preferredDefaultKey = preferredMatchKeys[0];

  const normalizeTypeSlug = (type: ProjectType) => {
    return getProjectTypeMatchKey(type.template_slug ?? type.name ?? type.id);
  };

  const uniqueTypes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: ProjectType[] = [];

    types.forEach((type) => {
      const key = normalizeTypeSlug(type);
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      ordered.push(type);
    });

    return ordered;
  }, [types]);

  const hasDatabaseDefault = useMemo(
    () => uniqueTypes.some((type) => type.is_default),
    [uniqueTypes]
  );

  const isPreferredDefault = useCallback(
    (type: ProjectType) =>
      Boolean(preferredDefaultKey && normalizeTypeSlug(type) === preferredDefaultKey),
    [preferredDefaultKey]
  );

  const isDefaultType = useCallback(
    (type: ProjectType) => type.is_default || (!hasDatabaseDefault && isPreferredDefault(type)),
    [hasDatabaseDefault, isPreferredDefault]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchProjectTypes = async () => {
      if (!isMounted) return;
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const organizationId = await getUserOrganizationId();
        if (!organizationId || !isMounted) return;

        const { data, error } = await supabase
          .from('project_types')
          .select('id, name, is_default, template_slug, sort_order')
          .eq('organization_id', organizationId)
          .order('is_default', { ascending: false }) // Default types first
          .order('name', { ascending: true });

        if (error) throw error;

        if (isMounted) {
          setTypes((data ?? []) as ProjectType[]);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unable to load project types";
        if (isMounted) {
          toast.error(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchProjectTypes();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const visibleTypes = useMemo(() => {
    if (uniqueTypes.length === 0) return [];

    const rankedTypes = [...uniqueTypes];

    return rankedTypes.sort((a, b) => {
      const aSlug = normalizeTypeSlug(a);
      const bSlug = normalizeTypeSlug(b);
      const aPreferredIndex = preferredSlugOrder.get(aSlug);
      const bPreferredIndex = preferredSlugOrder.get(bSlug);

      const aIsPreferred = typeof aPreferredIndex === "number";
      const bIsPreferred = typeof bPreferredIndex === "number";

      if (aIsPreferred || bIsPreferred) {
        if (aIsPreferred && bIsPreferred && aPreferredIndex !== bPreferredIndex) {
          return (aPreferredIndex ?? 0) - (bPreferredIndex ?? 0);
        }
        if (aIsPreferred !== bIsPreferred) {
          return aIsPreferred ? -1 : 1;
        }
      }

      const aDefault = isDefaultType(a);
      const bDefault = isDefaultType(b);
      if (aDefault !== bDefault) return aDefault ? -1 : 1;

      const aSortOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bSortOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;

      return a.name.localeCompare(b.name);
    });
  }, [uniqueTypes, preferredSlugOrder, isDefaultType]);

  useEffect(() => {
    if (!value && visibleTypes.length > 0) {
      const defaultType = visibleTypes.find((type) => isDefaultType(type)) ?? visibleTypes[0];
      if (defaultType) {
        onValueChange(defaultType.id, { isAutomatic: true });
      }
    }
  }, [value, visibleTypes, onValueChange, isDefaultType]);

  const filteredTypes = useMemo(() => {
    if (preferredMatchKeySet.size > 0) {
      return visibleTypes.filter((type) => preferredMatchKeySet.has(normalizeTypeSlug(type)));
    }
    return visibleTypes;
  }, [visibleTypes, preferredMatchKeySet]);

  // Check if user has no project types
  if (!loading && !settingsLoading && visibleTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2 border rounded">
        No project types configured. Please add project types in Settings first.
      </div>
    );
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => onValueChange(next)}
      disabled={disabled || loading || settingsLoading}
    >
      <SelectTrigger className={cn("h-11", className)} aria-required={required}>
        <SelectValue
          placeholder={loading || settingsLoading ? "Loading types..." : placeholder}
        />
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading project types...
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No project types found
          </div>
        ) : (
          filteredTypes.map((type) => {
            const label = getDisplayProjectTypeName(type, locale);
            const text = isDefaultType(type) ? `${label} (${defaultBadge})` : label;
            return (
              <SelectItem
                key={type.id}
                value={type.id}
                className="data-[highlighted]:bg-muted/70 data-[highlighted]:text-foreground"
              >
                {text}
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}
