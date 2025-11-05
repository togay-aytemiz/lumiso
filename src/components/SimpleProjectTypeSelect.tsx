import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface ProjectType {
  id: string;
  name: string;
  is_default: boolean;
}

interface SimpleProjectTypeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function SimpleProjectTypeSelect({ 
  value, 
  onValueChange, 
  placeholder = "Select project type...", 
  disabled = false,
  className,
  required = false
}: SimpleProjectTypeSelectProps) {
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchProjectTypes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      const { data, error } = await supabase
        .from('project_types')
        .select('id, name, is_default')
        .eq('organization_id', organizationId)
        .order('is_default', { ascending: false }) // Default types first
        .order('name', { ascending: true });

      if (error) throw error;

      setTypes(data ?? []);
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : "Unable to load project types";
      toast({
        title: "Error loading project types",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProjectTypes();
  }, [fetchProjectTypes]);

  useEffect(() => {
    if (!value && types.length > 0) {
      const defaultType = types.find(type => type.is_default);
      if (defaultType) {
        onValueChange(defaultType.id);
      }
    }
  }, [value, types, onValueChange]);

  // Check if user has no project types
  if (!loading && types.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2 border rounded">
        No project types configured. Please add project types in Settings first.
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={loading ? "Loading types..." : placeholder} />
      </SelectTrigger>
      <SelectContent className="z-50 bg-popover">
        {types.map((type) => (
          <SelectItem key={type.id} value={type.id}>
            <div className="flex items-center gap-2">
              <span>{type.name}</span>
              {type.is_default && (
                <span className="text-xs text-muted-foreground">(Default)</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
