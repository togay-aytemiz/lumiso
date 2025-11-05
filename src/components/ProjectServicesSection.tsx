import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, Plus } from "lucide-react";
import { useI18nToast } from "@/lib/toastHelpers";
import { ServicePicker, type PickerService } from "./ServicePicker";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';
import type { Database } from "@/integrations/supabase/types";
interface Service {
  id: string;
  name: string;
  category: string | null;
  cost_price?: number;
  selling_price?: number;
  price?: number;
  extra?: boolean | null;
  billing_type?: "included" | "extra";
}
interface ProjectServicesSectionProps {
  projectId: string;
  onServicesUpdated?: () => void;
}
export function ProjectServicesSection({
  projectId,
  onServicesUpdated
}: ProjectServicesSectionProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [errorAvailable, setErrorAvailable] = useState<string | null>(null);
  const toast = useI18nToast();
  const { t } = useFormsTranslation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const fetchProjectServices = async () => {
    try {
      const {
        data,
        error
      } = await supabase
        .from<{
          id: string;
          billing_type: "included" | "extra";
          services: Database["public"]["Tables"]["services"]["Row"] | null;
        }>('project_services')
        .select(`
          id,
          billing_type,
          services!inner (
            id,
            name,
            category,
            cost_price,
            selling_price,
            price,
            extra
          )
        `)
        .eq('project_id', projectId);
      if (error) throw error;
      const fetchedServices =
        data
          ?.map((ps) => {
            const svc = ps.services;
            if (!svc) return null;
            const record: Service = {
              id: svc.id,
              name: svc.name,
              category: svc.category,
              cost_price: svc.cost_price ?? undefined,
              selling_price: svc.selling_price ?? undefined,
              price: svc.price ?? undefined,
              extra: svc.extra,
              billing_type: ps.billing_type
            };
            return record;
          })
          .filter((record): record is Service => Boolean(record)) ?? [];
      setServices(fetchedServices);
    } catch (error) {
      console.error('Error fetching project services:', error);
      const message = error instanceof Error ? error.message : t('payments.error_loading', { defaultValue: 'Unable to load payments' });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };
  const fetchAvailableServices = async () => {
    setLoadingAvailable(true);
    setErrorAvailable(null);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's active organization ID
      const { data: organizationId } = await supabase.rpc('get_user_active_organization_id');
      if (!organizationId) return;

      const {
        data,
        error
      } = await supabase
        .from<Database["public"]["Tables"]["services"]["Row"]>("services")
        .select("id, name, category, cost_price, selling_price, price, extra")
        .eq("organization_id", organizationId)
        .order("category", {
        ascending: true
      }).order("name", {
        ascending: true
      });
      if (error) throw error;
      setAvailableServices((data ?? []).map((svc) => ({
        id: svc.id,
        name: svc.name,
        category: svc.category,
        cost_price: svc.cost_price ?? undefined,
        selling_price: svc.selling_price ?? undefined,
        price: svc.price ?? undefined,
        extra: svc.extra
      })));
    } catch (err) {
      console.error("Error fetching available services:", err);
      const message = err instanceof Error ? err.message : t('payments.services.load_error', { defaultValue: 'Unable to load services.' });
      setErrorAvailable(message);
    } finally {
      setLoadingAvailable(false);
    }
  };
  useEffect(() => {
    fetchProjectServices();
    fetchAvailableServices();
  }, [projectId]);
  const handleServicePickerChange = (serviceIds: string[]) => {
    const selectedServices = availableServices
      .filter(service => serviceIds.includes(service.id))
      .map(service => {
        const existing = services.find(s => s.id === service.id);
        const billingType =
          existing?.billing_type ??
          (service.extra ? "extra" : "included");
        return { ...service, billing_type: billingType };
      });
    setServices(selectedServices);
  };
  const handleSaveServices = async (selectedServices: Service[]) => {
    setSaving(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, delete existing project services
      const {
        error: deleteError
      } = await supabase.from('project_services').delete().eq('project_id', projectId);
      if (deleteError) throw deleteError;

      // Then, insert new project services
      if (selectedServices.length > 0) {
        const serviceInserts = selectedServices.map(service => ({
          project_id: projectId,
          service_id: service.id,
          user_id: user.id,
          billing_type:
            service.billing_type ??
            (service.extra ? "extra" : "included")
        }));
        const {
          error: insertError
        } = await supabase.from('project_services').insert(serviceInserts);
        if (insertError) throw insertError;
      }
      setServices(selectedServices);
      setIsEditing(false);
      onServicesUpdated?.();

      // Smoothly scroll back to the top of Services section after saving
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 50);
      toast.success(t('services.services_updated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg font-medium">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {t('services.title')}
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
      </Card>;
  }
  return <div ref={sectionRef}>
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl font-semibold">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {t('services.title')}
          </div>
          {!isEditing && (services.length === 0 ? <Button size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('services.add')}
              </Button> : <Button size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                <Edit2 className="h-4 w-4" />
                {t('services.edit')}
              </Button>)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? <div className="space-y-4">
            <ServicePicker services={availableServices.map(s => ({
            ...s,
            cost_price: s.cost_price,
            selling_price: s.selling_price,
            price: s.price,
            active: true
          }))} value={services.map(s => s.id)} onChange={handleServicePickerChange} disabled={saving} isLoading={loadingAvailable} error={errorAvailable} onRetry={fetchAvailableServices} />
            
            {/* Selected services display in edit mode */}
            {services.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{t('services.selected_services')} ({services.length})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setServices([])}
                    disabled={saving}
                    className="h-8"
                  >
                    {t('buttons.clearAll')}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => {
                    const costPrice = service.cost_price ?? 0;
                    const sellingPrice = service.selling_price ?? service.price ?? 0;
                    const hasPrices = costPrice > 0 || sellingPrice > 0;
                    return (
                      <Badge
                        key={service.id}
                        variant="secondary"
                        className="h-7 rounded-full px-3 text-xs"
                      >
                        <span>
                          {service.name}
                          {hasPrices && (
                            <>
                              <span className="mx-1">·</span>
                              <span className="text-foreground/70">₺{costPrice}/₺{sellingPrice}</span>
                            </>
                          )}
                        </span>
                        <button
                          className="ml-2 inline-flex rounded-full p-0.5 hover:text-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const newServices = services.filter(s => s.id !== service.id);
                            setServices(newServices);
                          }}
                          aria-label={`Remove ${service.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveServices(services)} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? t('common:actions.saving') : t('common:buttons.save')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
              setIsEditing(false);
              fetchProjectServices(); // Reset to original services
            }} disabled={saving}>
                <X className="h-4 w-4 mr-1" />
                {t('common:buttons.cancel')}
              </Button>
            </div>
          </div> : <div>
            {services.length > 0 ? <div className="flex flex-wrap gap-2">
                {services.map(service => {
              // Service data rendered
              const costPrice = service.cost_price ?? 0;
              const sellingPrice = service.selling_price ?? service.price ?? 0;
              const hasPrices = costPrice > 0 || sellingPrice > 0;
              // Price information processed
              return <Badge 
                      key={service.id} 
                      variant="secondary" 
                      className="h-auto min-h-7 rounded-lg px-3 py-1.5 text-xs whitespace-normal break-words max-w-full"
                      title={`${service.name}${hasPrices ? ` - Cost: ₺${costPrice}, Selling: ₺${sellingPrice}` : ''}`}
                    >
                       <div className="flex flex-col gap-0.5 w-full">
                         <span className="font-medium leading-tight">{service.name}</span>
                         {hasPrices && (
                            <span className="text-xs text-foreground/60 leading-tight">
                              {t('services.cost')}: ₺{costPrice} · {t('services.selling')}: ₺{sellingPrice}
                            </span>
                         )}
                       </div>
                     </Badge>;
            })}
              </div> : <div className="text-center py-6">
                <svg className="h-8 w-8 text-muted-foreground mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                 <p className="text-muted-foreground text-sm">{t('projectDetails.services.emptyState')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('projectDetails.services.addHint')}
                  </p>
              </div>}
          </div>}
      </CardContent>
    </Card>
    </div>;
}
