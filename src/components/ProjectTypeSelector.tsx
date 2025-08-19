import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";

interface ProjectType {
  id: string;
  name: string;
  is_default: boolean;
}

interface ProjectTypeSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
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
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchProjectTypes = async () => {
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

      setTypes(data || []);

      // Auto-select default type if no value is set
      if (!value && data && data.length > 0) {
        const defaultType = data.find(type => type.is_default);
        if (defaultType) {
          onValueChange(defaultType.id);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading project types",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectTypes();
  }, []);

  const filteredTypes = types.filter(type =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedType = types.find(type => type.id === value);

  // Check if user has no project types
  if (!loading && types.length === 0) {
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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left h-auto min-h-[40px]",
            !selectedType && "text-muted-foreground",
            className
          )}
          disabled={disabled || loading}
        >
          {loading ? (
            "Loading types..."
          ) : selectedType ? (
            <div className="flex items-center gap-2">
              <Badge 
                variant={selectedType.is_default ? "default" : "secondary"}
                className="text-xs"
              >
                {selectedType.name.toUpperCase()}
              </Badge>
              {selectedType.is_default && (
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
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search project types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <div className="py-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading project types...
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No types match your search' : 'No project types found'}
              </div>
            ) : (
              filteredTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => {
                    onValueChange(type.id);
                    setOpen(false);
                    setSearchTerm("");
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
                        variant={type.is_default ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {type.name.toUpperCase()}
                      </Badge>
                      {type.is_default && (
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