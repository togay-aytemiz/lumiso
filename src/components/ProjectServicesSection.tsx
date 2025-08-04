import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ServiceSelector } from "./ServiceSelector";

interface Service {
  id: string;
  name: string;
  category: string | null;
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
  const { toast } = useToast();

  const fetchProjectServices = async () => {
    try {
      const { data, error } = await supabase
        .from('project_services')
        .select(`
          services!inner (
            id,
            name,
            category
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

  useEffect(() => {
    fetchProjectServices();
  }, [projectId]);

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
          <CardTitle className="flex items-center justify-between">
            Services
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
        <CardTitle className="flex items-center justify-between">
          Services
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
            <ServiceSelector
              projectId={projectId}
              selectedServices={services}
              onServicesChange={setServices}
              disabled={saving}
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
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <Badge key={service.id} variant="secondary">
                    {service.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
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