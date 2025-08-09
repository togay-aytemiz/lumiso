import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ServicePicker, type PickerService } from "./ServicePicker";

interface Service {
  id: string;
  name: string;
  category: string | null;
  cost_price?: number;
  selling_price?: number;
  price?: number;
}

interface ProjectServicesSectionProps {
  projectId: string;
  onServicesUpdated?: () => void;
}

export function ProjectServicesSection({ projectId, onServicesUpdated }: ProjectServicesSectionProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [errorAvailable, setErrorAvailable] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProjectServices = async () => {
    try {
      const { data, error } = await supabase
        .from('project_services')
        .select(`
          services!inner (
            id,
            name,
            category,
            cost_price,
            selling_price
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      
      const fetchedServices = data?.map(ps => ps.services).filter(Boolean) as Service[] || [];
      setServices(fetchedServices);
    } catch (error: any) {
      console.error('Error fetching project services:', error);
      toast({
        title: "Error loading services",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableServices = async () => {
    setLoadingAvailable(true);
    setErrorAvailable(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("services")
        .select("id, name, category, cost_price, selling_price, price")
        .eq("user_id", user.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setAvailableServices(data || []);
    } catch (err: any) {
      console.error("Error fetching available services:", err);
      setErrorAvailable(err.message || "Failed to load services");
    } finally {
      setLoadingAvailable(false);
    }
  };

  useEffect(() => {
    fetchProjectServices();
    fetchAvailableServices();
  }, [projectId]);

  const handleServicePickerChange = (serviceIds: string[]) => {
    const selectedServices = availableServices.filter(service => 
      serviceIds.includes(service.id)
    );
    setServices(selectedServices);
  };

  const handleSaveServices = async (selectedServices: Service[]) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, delete existing project services
      const { error: deleteError } = await supabase
        .from('project_services')
        .delete()
        .eq('project_id', projectId);

      if (deleteError) throw deleteError;

      // Then, insert new project services
      if (selectedServices.length > 0) {
        const serviceInserts = selectedServices.map(service => ({
          project_id: projectId,
          service_id: service.id,
          user_id: user.id
        }));

        const { error: insertError } = await supabase
          .from('project_services')
          .insert(serviceInserts);

        if (insertError) throw insertError;
      }

      setServices(selectedServices);
      setIsEditing(false);
      onServicesUpdated?.();
      
      toast({
        title: "Success",
        description: "Project services updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error updating services",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg font-medium">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Services
            </div>
            <div className="w-6 h-6 bg-muted animate-pulse rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="w-full h-4 bg-muted animate-pulse rounded" />
            <div className="w-3/4 h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-medium">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Services
          </div>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0"
            >
              {services.length === 0 ? <Plus className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <ServicePicker
              services={availableServices.map(s => ({
                ...s,
                price: s.selling_price || 0,
                active: true
              }))}
              value={services.map(s => s.id)}
              onChange={handleServicePickerChange}
              disabled={saving}
              isLoading={loadingAvailable}
              error={errorAvailable}
              onRetry={fetchAvailableServices}
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => handleSaveServices(services)}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  fetchProjectServices(); // Reset to original services
                }}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {services.length > 0 ? (
              <div className="space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex-1">
                      <span className="font-medium">{service.name}</span>
                      <div className="flex gap-4 mt-1">
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg className="h-8 w-8 text-muted-foreground mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-muted-foreground text-sm">No services assigned</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click the + button to add services to this project
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}