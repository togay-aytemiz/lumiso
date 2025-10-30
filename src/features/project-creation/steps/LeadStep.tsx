import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EnhancedAddLeadDialog } from "@/components/EnhancedAddLeadDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { useLeadStatuses } from "@/hooks/useOrganizationData";
import { LeadInitials } from "@/components/LeadInitials";
import { cn } from "@/lib/utils";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { Check, ChevronDown, Loader2, Search, UserPlus } from "lucide-react";

interface LeadOption {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  status_id?: string | null;
}

export const LeadStep = () => {
  const { t } = useTranslation("projectCreation");
  const { toast } = useToast();
  const { state } = useProjectCreationContext();
  const { updateLead } = useProjectCreationActions();
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestRequestRef = useRef(0);
  const { data: leadStatuses = [], isLoading: leadStatusesLoading } = useLeadStatuses();

  const loadLeads = useCallback(
    async (term: string) => {
      const requestId = ++latestRequestRef.current;
      setLoading(true);
      try {
        const organizationId = await getUserOrganizationId();
        if (!organizationId) {
          if (latestRequestRef.current === requestId) {
            setLeadOptions([]);
          }
          return;
        }

        const sanitized = term.trim().replace(/[%_]/g, "\\$&");
        let query = supabase
          .from("leads")
          .select("id, name, email, phone, status, status_id")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false })
          .limit(25);

        if (sanitized) {
          query = query.or(
            `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;

        if (latestRequestRef.current === requestId) {
          setLeadOptions((data as LeadOption[]) || []);
        }
      } catch (error: any) {
        console.error("Failed to load leads", error);
        if (latestRequestRef.current === requestId) {
          setLeadOptions([]);
          setHasLoadedOnce(true);
        }
        toast({
          title: t("steps.lead.fetchErrorTitle"),
          description: error.message,
          variant: "destructive",
        });
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      }
    },
    [toast, t]
  );

  useEffect(() => {
    loadLeads("");
  }, [loadLeads]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = window.setTimeout(() => {
      loadLeads(searchTerm);
    }, 250);
    return () => {
      window.clearTimeout(handler);
    };
  }, [dropdownOpen, searchTerm, loadLeads]);

 
  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [dropdownOpen]);

  const selectedLeadOption = useMemo(() => {
    if (!state.lead.id) return undefined;
    return leadOptions.find((lead) => lead.id === state.lead.id);
  }, [leadOptions, state.lead.id]);

  const handleAssignLead = (lead: LeadOption) => {
    updateLead({
      id: lead.id,
      name: lead.name,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      notes: "",
      mode: "existing",
    });
    setDropdownOpen(false);
    setSearchTerm("");
  };

  const handleLeadCreated = (lead: LeadOption) => {
    setCreateLeadOpen(false);
    const normalized: LeadOption = {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      status_id: lead.status_id,
    };
    setLeadOptions((prev) => {
      const without = prev.filter((item) => item.id !== normalized.id);
      return [normalized, ...without];
    });
    handleAssignLead(normalized);
    void loadLeads("");
  };

  const showInitialLoading = loading && !hasLoadedOnce && leadOptions.length === 0;
  const showEmptyState = !loading && hasLoadedOnce && leadOptions.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("steps.lead.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.lead.description")}
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("steps.lead.selectExisting")}
        </Label>
        <div className="relative" ref={containerRef}>
          <Button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={cn(
              "group flex h-12 w-full items-center justify-between rounded-xl border border-border/70 bg-white px-4 py-3 text-left font-semibold text-slate-900 shadow-sm transition hover:border-emerald-400/70 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-300",
              dropdownOpen && "border-emerald-400/80 shadow-emerald-200",
              loading && leadOptions.length === 0 && "cursor-wait opacity-70"
            )}
            disabled={loading && leadOptions.length === 0}
          >
            {selectedLeadOption ? (
              <div className="flex w-full items-center justify-between gap-3">
                <LeadSummaryPreview
                  lead={selectedLeadOption}
                  textColor="text-slate-900"
                  subtleColor="text-muted-foreground"
                />
                {(selectedLeadOption.status || selectedLeadOption.status_id) ? (
                  <LeadStatusBadge
                    leadId={selectedLeadOption.id}
                    currentStatusId={selectedLeadOption.status_id ?? undefined}
                    currentStatus={selectedLeadOption.status ?? undefined}
                    editable={false}
                    size="sm"
                    statuses={leadStatuses}
                    statusesLoading={leadStatusesLoading}
                  />
                ) : null}
              </div>
            ) : loading && !hasLoadedOnce ? (
              t("steps.lead.loading")
            ) : (
              t("steps.lead.selectPlaceholder")
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
          </Button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-border bg-background shadow-xl">
              <div className="px-4 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t("steps.lead.searchPlaceholder")}
                    className="h-11 rounded-xl border border-border bg-white pl-9 text-sm shadow-inner focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    autoFocus
                  />
                </div>
              </div>
              <div className="relative max-h-64 min-h-[10rem] overflow-y-auto border-t border-border/80 bg-white">
                {showInitialLoading ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    {t("steps.lead.loading")}
                  </div>
                ) : showEmptyState ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {searchTerm ? t("steps.lead.noResults") : t("steps.lead.emptyState")}
                  </p>
                ) : (
                  <>
                    {loading && (
                      <div className="sticky top-0 flex items-center gap-2 bg-white/95 px-4 py-2 text-xs text-muted-foreground backdrop-blur">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t("steps.lead.loading")}
                      </div>
                    )}
                    <div className="divide-y">
                      {leadOptions.map((lead) => {
                        const isActive = state.lead.id === lead.id;
                        return (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => handleAssignLead(lead)}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-muted/60",
                              isActive && "bg-emerald-100/40"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border/70 bg-muted shadow-sm">
                                <AvatarFallback className="text-sm font-semibold uppercase text-slate-700">
                                  <LeadInitials name={lead.name} fallback="?" maxInitials={2} />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900">
                                  {lead.name}
                                </span>
                                {(lead.email || lead.phone) && (
                                  <span className="text-xs text-muted-foreground">
                                    {[lead.email, lead.phone].filter(Boolean).join(" • ")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {(lead.status || lead.status_id) ? (
                                <LeadStatusBadge
                                  leadId={lead.id}
                                  currentStatusId={lead.status_id ?? undefined}
                                  currentStatus={lead.status ?? undefined}
                                  editable={false}
                                  size="sm"
                                  statuses={leadStatuses}
                                  statusesLoading={leadStatusesLoading}
                                />
                              ) : null}
                              <Check
                                className={cn(
                                  "h-4 w-4 text-emerald-500 transition",
                                  isActive ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setCreateLeadOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          {t("steps.lead.createButton")}
        </Button>

        {leadOptions.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">
            {t("steps.lead.emptyState")}
          </p>
        )}
      </div>

      <EnhancedAddLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onClose={() => setCreateLeadOpen(false)}
        onSuccess={handleLeadCreated}
      />
    </div>
  );
};

const LeadSummaryPreview = ({
  lead,
  textColor = "text-foreground",
  subtleColor = "text-muted-foreground",
}: {
  lead: LeadOption;
  textColor?: string;
  subtleColor?: string;
}) => {
  return (
    <div className="flex w-full items-center gap-3">
      <Avatar className="h-9 w-9 border border-border/60 bg-muted shadow-sm">
        <AvatarFallback className="text-xs font-semibold uppercase text-slate-700">
          <LeadInitials name={lead.name} fallback="?" maxInitials={2} />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className={cn("text-sm font-medium", textColor)}>{lead.name}</span>
        {(lead.email || lead.phone) && (
          <span className={cn("text-xs", subtleColor)}>
            {[lead.email, lead.phone].filter(Boolean).join(" • ")}
          </span>
        )}
      </div>
    </div>
  );
};
