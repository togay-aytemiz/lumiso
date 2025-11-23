import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { getDisplayProjectTypeName } from "@/lib/projectTypes";
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
  const { i18n } = useTranslation();
  const locale = orgSettings?.locale ?? i18n.language;

  const preferredSlugs = useMemo(
    () => (orgSettings?.preferred_project_types ?? []).map((slug) => slug.toLowerCase()),
    [orgSettings?.preferred_project_types]
  );

  const preferredSlugOrder = useMemo(
    () => new Map(preferredSlugs.map((slug, index) => [slug, index])),
    [preferredSlugs]
  );

  const preferredDefaultSlug = preferredSlugs[0];

  const normalizeTypeSlug = (type: ProjectType) => {
    if (type.template_slug) return type.template_slug.toLowerCase();
    return type.name.trim().toLowerCase().replace(/[^a-z0-9]+/gi, "_");
  };

  const isPreferredDefault = (type: ProjectType) =>
    Boolean(preferredDefaultSlug && normalizeTypeSlug(type) === preferredDefaultSlug);

  const isDefaultType = (type: ProjectType) =>
    isPreferredDefault(type) || type.is_default;

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
    if (types.length === 0) return [];

    const rankedTypes = [...types];

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
  }, [types, preferredDefaultSlug, preferredSlugOrder]);

  useEffect(() => {
    if (!value && visibleTypes.length > 0) {
      const defaultType = visibleTypes.find((type) => isDefaultType(type)) ?? visibleTypes[0];
      if (defaultType) {
        onValueChange(defaultType.id, { isAutomatic: true });
      }
    }
  }, [value, visibleTypes, onValueChange]);

  const filteredTypes = useMemo(() => {
    if (preferredSlugs.length > 0) {
      return visibleTypes.filter(type => preferredSlugs.includes(normalizeTypeSlug(type)));
    }
    return visibleTypes;
  }, [visibleTypes, preferredSlugs]);

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
            const text = isDefaultType(type) ? `${label} (Default)` : label;
            return (
              <SelectItem key={type.id} value={type.id}>
                {text}
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}
