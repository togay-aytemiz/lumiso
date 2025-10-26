import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { cn } from "@/lib/utils";

interface LeadOption {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export const LeadStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateLead } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const { toast } = useToast();
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);

  const leadPlaceholder = state.lead.name || t("steps.lead.namePlaceholder");
  const mode = state.lead.mode ?? "existing";

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const organizationId = await getUserOrganizationId();
        if (!organizationId) {
          setLeadOptions([]);
          return;
        }

        const { data, error } = await supabase
          .from("leads")
          .select("id, name, email, phone")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true });

        if (error) throw error;

        setLeadOptions((data as LeadOption[]) || []);
      } catch (error: any) {
        console.error("Failed to load leads", error);
        toast({
          title: t("steps.lead.fetchErrorTitle"),
          description: error.message,
          variant: "destructive"
        });
        setLeadOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [toast, t]);

  useEffect(() => {
    if (!loading && leadOptions.length === 0 && mode === "existing") {
      handleModeChange("new");
    }
  }, [loading, leadOptions.length, mode]);

  const selectedLeadOption = useMemo(() => {
    if (!state.lead.id) return undefined;
    return leadOptions.find((option) => option.id === state.lead.id);
  }, [leadOptions, state.lead.id]);

  const handleModeChange = (value: "existing" | "new") => {
    updateLead({
      ...state.lead,
      mode: value,
      id: value === "existing" ? state.lead.id : undefined,
      name: value === "existing" ? selectedLeadOption?.name : "",
      email: value === "existing" ? selectedLeadOption?.email : "",
      phone: value === "existing" ? selectedLeadOption?.phone : "",
      notes: ""
    });
  };

  const handleExistingLeadChange = (leadId: string) => {
    const option = leadOptions.find((lead) => lead.id === leadId);
    updateLead({
      ...state.lead,
      mode: "existing",
      id: leadId,
      name: option?.name ?? "",
      email: option?.email ?? "",
      phone: option?.phone ?? "",
      notes: ""
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.lead.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.lead.description")}</p>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(value) => handleModeChange(value as "existing" | "new")}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <ModeCard
          value="existing"
          label={t("steps.lead.useExisting")}
          description={t("steps.lead.useExistingDescription")}
          disabled={leadOptions.length === 0}
        />
        <ModeCard value="new" label={t("steps.lead.createNew")} description={t("steps.lead.createNewDescription")} />
      </RadioGroup>

      {mode === "existing" ? (
        <div className="space-y-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("steps.lead.selectExisting")}
          </Label>
          <Select
            value={state.lead.id ?? ""}
            onValueChange={handleExistingLeadChange}
            disabled={loading || leadOptions.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? t("steps.lead.loading") : t("steps.lead.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {leadOptions.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{lead.name}</span>
                    {(lead.email || lead.phone) && (
                      <span className="text-xs text-muted-foreground">
                        {[lead.email, lead.phone].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {leadOptions.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground">{t("steps.lead.noLeads")}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm md:col-span-2">
            <Label htmlFor="lead-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.lead.nameLabel")}
            </Label>
            <Input
              id="lead-name"
              placeholder={leadPlaceholder}
              value={state.lead.name ?? ""}
              className="mt-2"
              onChange={(event) =>
                updateLead({
                  ...state.lead,
                  name: event.target.value
                })
              }
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
            <Label htmlFor="lead-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.lead.emailLabel")}
            </Label>
            <Input
              id="lead-email"
              type="email"
              placeholder={t("steps.lead.emailPlaceholder")}
              value={state.lead.email ?? ""}
              className="mt-2"
              onChange={(event) =>
                updateLead({
                  ...state.lead,
                  email: event.target.value
                })
              }
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
            <Label htmlFor="lead-phone" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.lead.phoneLabel")}
            </Label>
            <Input
              id="lead-phone"
              placeholder={t("steps.lead.phonePlaceholder")}
              value={state.lead.phone ?? ""}
              className="mt-2"
              onChange={(event) =>
                updateLead({
                  ...state.lead,
                  phone: event.target.value
                })
              }
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm md:col-span-2">
            <Label htmlFor="lead-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.lead.notesLabel")}
            </Label>
            <Textarea
              id="lead-notes"
              rows={3}
              placeholder={t("steps.lead.notesPlaceholder")}
              value={state.lead.notes ?? ""}
              className="mt-2"
              onChange={(event) =>
                updateLead({
                  ...state.lead,
                  notes: event.target.value
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface ModeCardProps {
  value: "existing" | "new";
  label: string;
  description: string;
  disabled?: boolean;
}

const ModeCard = ({ value, label, description, disabled }: ModeCardProps) => (
  <label
    htmlFor={`lead-mode-${value}`}
    className={cn(
      "flex cursor-pointer flex-col gap-1 rounded-lg border border-border/70 bg-muted/30 p-4 shadow-sm transition hover:border-primary/60",
      disabled && "pointer-events-none opacity-50"
    )}
  >
    <div className="flex items-center justify-between">
      <span className="font-semibold text-sm text-foreground">{label}</span>
      <RadioGroupItem id={`lead-mode-${value}`} value={value} disabled={disabled} />
    </div>
    <p className="text-xs text-muted-foreground">{description}</p>
  </label>
);
