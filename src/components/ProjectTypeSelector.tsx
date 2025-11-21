import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useI18nToast } from "@/lib/toastHelpers";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";

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
  const [open, setOpen] = useState(false);
  const toast = useI18nToast();
  const { settings: orgSettings, loading: settingsLoading } = useOrganizationSettings();

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

  const selectedType =
    visibleTypes.find((type) => type.id === value) || types.find((type) => type.id === value);

  // Check if user has no project types
  if (!loading && !settingsLoading && visibleTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2 border rounded">
        No project types configured. Please add project types in Settings first.
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left h-auto min-h-[40px]",
            !selectedType && "text-muted-foreground",
            className
          )}
          disabled={disabled || loading || settingsLoading}
        >
          {loading || settingsLoading ? (
            "Loading types..."
          ) : selectedType ? (
            <div className="flex items-center gap-2">
              <Badge
                variant={isDefaultType(selectedType) ? "default" : "secondary"}
                className="text-xs"
              >
                {selectedType.name.toUpperCase()}
              </Badge>
              {isDefaultType(selectedType) && (
                <span className="text-xs text-muted-foreground">(Default)</span>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
        <div className="max-h-64 overflow-y-auto">
          <div className="py-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading project types...
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No project types found
              </div>
            ) : (
              filteredTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => {
                    onValueChange(type.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0",
                    value === type.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === type.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isDefaultType(type) ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {type.name.toUpperCase()}
                      </Badge>
                      {isDefaultType(type) && (
                        <span className="text-xs text-muted-foreground">(Default)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
