import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { ChevronDown, UserPlus } from "lucide-react";
import { Label } from "@/components/ui/label";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [createLeadOpen, setCreateLeadOpen] = useState(false);

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

  const selectedLeadOption = useMemo(() => {
    if (!state.lead.id) return undefined;
    return leadOptions.find((lead) => lead.id === state.lead.id);
  }, [leadOptions, state.lead.id]);

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return leadOptions.filter((lead) => lead.name.toLowerCase().includes(term));
  }, [leadOptions, searchTerm]);

  const handleAssignLead = (lead: LeadOption) => {
    updateLead({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      notes: "",
      mode: "existing"
    });
    setDropdownOpen(false);
    setSearchTerm("");
  };

  const handleLeadCreated = (lead: { id: string; name: string; email?: string | null; phone?: string | null }) => {
    setCreateLeadOpen(false);
    const normalized: LeadOption = {
      id: lead.id,
      name: lead.name,
      email: lead.email || undefined,
      phone: lead.phone || undefined
    };
    setLeadOptions((prev) => {
      const without = prev.filter((item) => item.id !== lead.id);
      return [...without, normalized].sort((a, b) => a.name.localeCompare(b.name));
    });
    handleAssignLead(normalized);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("steps.lead.navigationLabel")}</h2>
        <p className="text-sm text-muted-foreground">{t("steps.lead.description")}</p>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("steps.lead.selectExisting")}
        </Label>
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-left h-auto min-h-[42px]"
              disabled={loading || leadOptions.length === 0}
            >
              {selectedLeadOption ? (
                <LeadSummaryPreview lead={selectedLeadOption} />
              ) : loading ? (
                t("steps.lead.loading")
              ) : (
                t("steps.lead.selectPlaceholder")
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[360px]" align="start">
            <Command>
              <CommandInput
                placeholder={t("steps.lead.searchPlaceholder")}
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>{t("steps.lead.noLeads")}</CommandEmpty>
                <CommandGroup>
                  {filteredLeads.map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={lead.id}
                      onSelect={() => handleAssignLead(lead)}
                      className="flex items-center gap-3"
                    >
                      <LeadSummaryPreview lead={lead} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setCreateLeadOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          {t("steps.lead.createButton")}
        </Button>

        {leadOptions.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">{t("steps.lead.emptyState")}</p>
        )}
      </div>

      {state.lead.name && (
        <SelectedLeadCard
          name={state.lead.name}
          email={state.lead.email}
          phone={state.lead.phone}
        />
      )}

      <EnhancedAddLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onClose={() => setCreateLeadOpen(false)}
        onSuccess={handleLeadCreated}
      />
    </div>
  );
};

const LeadSummaryPreview = ({ lead }: { lead: LeadOption }) => {
  const initials = computeInitials(lead.name || "?");
  return (
    <div className="flex w-full items-center gap-3">
      <Avatar className="h-7 w-7 border">
        <AvatarFallback className="text-xs font-semibold uppercase">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{lead.name}</span>
        {(lead.email || lead.phone) && (
          <span className="text-xs text-muted-foreground">{[lead.email, lead.phone].filter(Boolean).join(" • ")}</span>
        )}
      </div>
    </div>
  );
};

const SelectedLeadCard = ({ name, email, phone }: { name: string; email?: string | null; phone?: string | null }) => {
  const initials = computeInitials(name);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      <Avatar className="h-9 w-9 border">
        <AvatarFallback className="text-sm font-semibold uppercase">{initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {(email || phone) && (
          <p className="text-xs text-muted-foreground">{[email, phone].filter(Boolean).join(" • ")}</p>
        )}
      </div>
    </div>
  );
};

const computeInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
};
