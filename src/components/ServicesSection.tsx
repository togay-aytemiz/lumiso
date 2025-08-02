import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NewServiceDialog } from "./NewServiceDialog";

interface Service {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

const ServicesSection = () => {
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch services
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Service[];
    },
  });

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({
        title: "Service deleted",
        description: "The service has been removed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete service. Please try again.",
        variant: "destructive",
      });
      console.error('Delete service error:', error);
    },
  });

  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const toggleCategory = (category: string) => {
    const newOpenCategories = new Set(openCategories);
    if (newOpenCategories.has(category)) {
      newOpenCategories.delete(category);
    } else {
      newOpenCategories.add(category);
    }
    setOpenCategories(newOpenCategories);
  };

  const handleDeleteService = (serviceId: string) => {
    deleteServiceMutation.mutate(serviceId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Loading services...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Define the photography services you offer, like albums, prints, and extras.
              </CardDescription>
            </div>
            <Button onClick={() => setShowNewServiceDialog(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedServices).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No services defined yet.</p>
              <Button onClick={() => setShowNewServiceDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add your first service
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedServices).map(([category, categoryServices]) => (
                <Collapsible
                  key={category}
                  open={openCategories.has(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                    <div className="flex items-center gap-2">
                      {openCategories.has(category) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{category}</span>
                      <span className="text-sm text-muted-foreground">
                        ({categoryServices.length})
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 pl-6">
                      {categoryServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium">{service.name}</h4>
                            {service.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {service.description}
                              </p>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteService(service.id)}
                            disabled={deleteServiceMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewServiceDialog
        open={showNewServiceDialog}
        onOpenChange={setShowNewServiceDialog}
        existingCategories={Object.keys(groupedServices).filter(cat => cat !== 'Uncategorized')}
      />
    </>
  );
};

export default ServicesSection;