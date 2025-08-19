import { useState, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  category: string | null;
  cost_price?: number;
  selling_price?: number;
}

interface ServiceSelectorProps {
  projectId?: string;
  selectedServices: Service[];
  onServicesChange: (services: Service[]) => void;
  disabled?: boolean;
}

export function ServiceSelector({ 
  projectId, 
  selectedServices, 
  onServicesChange, 
  disabled = false 
}: ServiceSelectorProps) {
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const { data, error } = await supabase
        .from("services")
        .select("id, name, category, cost_price, selling_price")
        .eq("organization_id", organizationId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setAvailableServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error loading services",
        description: "Failed to load available services.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const groupedServices = availableServices.reduce((groups, service) => {
    const category = service.category || "Uncategorized";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(service);
    return groups;
  }, {} as Record<string, Service[]>);

  const handleServiceToggle = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    
    if (isSelected) {
      onServicesChange(selectedServices.filter(s => s.id !== service.id));
    } else {
      onServicesChange([...selectedServices, service]);
    }
  };

  const removeService = (serviceId: string) => {
    onServicesChange(selectedServices.filter(s => s.id !== serviceId));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Services</Label>
        <div className="w-full h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (availableServices.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          No services defined yet. Go to Settings → Services to add your offerings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Services</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between h-auto min-h-10 p-2"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedServices.length === 0 ? (
                <span className="text-muted-foreground">Select services provided</span>
              ) : (
                selectedServices.map((service) => (
                  <Badge
                    key={service.id}
                    variant="secondary"
                    className="text-xs"
                  >
                    {service.name}
                    <button
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          removeService(service.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeService(service.id);
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <ScrollArea className="max-h-60">
            <div className="p-4 space-y-3">
              {Object.entries(groupedServices).map(([category, services], categoryIndex) => (
                <div key={category}>
                  {categoryIndex > 0 && <Separator className="my-2" />}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground px-2">
                      {category}
                    </h4>
                    <div className="space-y-1">
                      {services.map((service) => {
                        const isSelected = selectedServices.some(s => s.id === service.id);
                        return (
                          <div
                            key={service.id}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => handleServiceToggle(service)}
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="w-4 h-4 border border-primary rounded-sm flex items-center justify-center">
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <div className="flex-1">
                                <span className="text-sm">{service.name}</span>
                                {((service.cost_price || 0) > 0 || (service.selling_price || 0) > 0) && (
                                  <div className="flex gap-3 mt-1">
                                    {(service.cost_price || 0) > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        Cost: TRY {service.cost_price}
                                      </span>
                                    )}
                                    {(service.selling_price || 0) > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        Selling: TRY {service.selling_price}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}