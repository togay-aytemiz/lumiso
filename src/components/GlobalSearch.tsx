import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Search,
  FileText,
  Clock,
  Calendar,
  User,
  ChevronRight,
  X,
  FolderOpen,
} from "lucide-react";
import { SearchLoadingSkeleton } from "@/components/ui/loading-presets";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

const INITIAL_RESULT_COUNT = 10;

type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];
type ProjectStatusRow = Database["public"]["Tables"]["project_statuses"]["Row"];
type LeadFieldDefinitionRow =
  Database["public"]["Tables"]["lead_field_definitions"]["Row"];
type LeadFieldValueRow =
  Database["public"]["Tables"]["lead_field_values"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

interface SearchResult {
  id: string;
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  projectStatusId?: string | null;
  leadStatusId?: string | null;
  type: "lead" | "note" | "reminder" | "session" | "project";
  matchedContent: string;
  customFieldKey?: string;
  customFieldValue?: string | null;
  status: string;
  icon: React.ReactNode;
}

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  status_id: string | null;
}

type CustomFieldMatch = LeadFieldValueRow & {
  leads: Lead;
};

interface Activity {
  id: string;
  lead_id: string;
  content: string;
  type: string;
  reminder_date?: string;
  reminder_time?: string;
}

interface Session {
  id: string;
  lead_id: string;
  session_date: string;
  session_time: string;
  notes?: string;
}

interface GlobalSearchProps {
  variant?: "default" | "header";
  className?: string;
}

const GlobalSearch = ({ variant = "default", className }: GlobalSearchProps) => {
  const { t } = useFormsTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [displayedCount, setDisplayedCount] =
    useState<number>(INITIAL_RESULT_COUNT);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Preload statuses to avoid per-row fetching and flicker
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusRow[]>([]);
  const [projectStatuses, setProjectStatuses] =
    useState<ProjectStatusRow[]>([]);
  const [leadFieldLabels, setLeadFieldLabels] = useState<Record<string, string>>(
    {}
  );
  const [statusesLoading, setStatusesLoading] = useState(true);

  const formatFieldKey = (fieldKey: string) => {
    if (!fieldKey) return "";
    return fieldKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const buildCustomFieldMatchedContent = (
    fieldKey?: string,
    value?: string | null
  ) => {
    if (!fieldKey) return value ?? "";
    const label = leadFieldLabels[fieldKey] || formatFieldKey(fieldKey);
    const safeValue = value ?? "";
    return safeValue ? `${label}: ${safeValue}` : label;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Preload lead/project statuses once to avoid per-row fetching
  useEffect(() => {
    let mounted = true;
    setStatusesLoading(true);
    (async () => {
      try {
        // Get user's organization ID for single-user filtering
        const { getUserOrganizationId } = await import(
          "@/lib/organizationUtils"
        );
        const organizationId = await getUserOrganizationId();

        if (!organizationId) {
          if (mounted) {
            setLeadStatuses([]);
            setProjectStatuses([]);
            setLeadFieldLabels({});
            setStatusesLoading(false);
          }
          return;
        }

        const [ls, ps, fieldDefs] = await Promise.all([
          supabase
            .from("lead_statuses")
            .select("*")
            .eq("organization_id", organizationId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("project_statuses")
            .select("*")
            .eq("organization_id", organizationId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("lead_field_definitions")
            .select("field_key,label")
            .eq("organization_id", organizationId),
        ]);
        if (!mounted) return;
        setLeadStatuses((ls.data as LeadStatusRow[]) || []);
        setProjectStatuses((ps.data as ProjectStatusRow[]) || []);
        if (!fieldDefs.error) {
          const definitions =
            (fieldDefs.data as LeadFieldDefinitionRow[]) || [];
          setLeadFieldLabels(
            definitions.reduce<Record<string, string>>(
              (acc, definition) => {
                if (definition.field_key && definition.label) {
                  acc[definition.field_key] = definition.label;
                }
                return acc;
              },
              {}
            )
          );
        } else {
          console.error(
            "GlobalSearch: Lead field definitions error:",
            fieldDefs.error
          );
        }
      } catch (e) {
        // no-op
      } finally {
        if (mounted) setStatusesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleResultClick(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const performSearch = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const searchResults: SearchResult[] = [];

        // Search leads with better special character handling (system fields)
        const { data: leads, error: leadsError } = await supabase
          .from("leads")
          .select("id, name, email, phone, status, status_id")
          .or(
            `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
          );

        if (leadsError) {
          console.error("GlobalSearch: Leads error:", leadsError);
          throw leadsError;
        }

        // Search custom field values
        const { data: customFieldMatches, error: customFieldError } =
          await supabase
            .from("lead_field_values")
            .select(
              `
            lead_id,
            field_key,
            value,
            leads!inner(id, name, email, phone, status, status_id)
          `
            )
            .ilike("value", `%${searchQuery}%`);

        if (customFieldError) {
          console.error(
            "GlobalSearch: Custom field values error:",
            customFieldError
          );
        }

        // Track lead IDs we've already added to avoid duplicates
        const addedLeadIds = new Set<string>();

        // Add lead results from system fields
        leads?.forEach((lead: Lead) => {
          let matchedContent = "";
          if (lead.email?.toLowerCase().includes(searchQuery.toLowerCase())) {
            matchedContent = t("search.resultFormats.emailMatch", {
              email: lead.email,
            });
          } else if (
            lead.phone?.toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            matchedContent = t("search.resultFormats.phoneMatch", {
              phone: lead.phone,
            });
          }

          searchResults.push({
            id: lead.id,
            leadId: lead.id,
            leadName: lead.name,
            leadStatusId: lead.status_id,
            type: "lead",
            matchedContent,
            status: lead.status,
            icon: <User className="h-4 w-4" />,
          });
          addedLeadIds.add(lead.id);
        });

        // Add lead results from custom field matches (avoid duplicates)
        const customFieldMatchesData =
          (customFieldMatches as CustomFieldMatch[]) || [];

        customFieldMatchesData.forEach((match) => {
          if (!addedLeadIds.has(match.lead_id)) {
            const lead = match.leads;
            searchResults.push({
              id: lead.id,
              leadId: lead.id,
              leadName: lead.name,
              leadStatusId: lead.status_id,
              type: "lead",
              matchedContent: match.value ?? "",
              customFieldKey: match.field_key,
              customFieldValue: match.value,
              status: lead.status,
              icon: <User className="h-4 w-4" />,
            });
            addedLeadIds.add(match.lead_id);
          }
        });

        // Search activities (notes and reminders)
        const { data: activities, error: activitiesError } = await supabase
          .from("activities")
          .select("*")
          .ilike("content", `%${searchQuery}%`);

        if (activitiesError) throw activitiesError;

        // Get lead names for activities
        if (activities && activities.length > 0) {
          const leadIds = [
            ...new Set(activities.map((a: Activity) => a.lead_id)),
          ];
          const { data: activityLeads } = await supabase
            .from("leads")
            .select("id, name, status, status_id")
            .in("id", leadIds);

          const leadMap = new Map<string, Lead>(
            ((activityLeads as Lead[]) || []).map((lead) => [lead.id, lead])
          );

          activities.forEach((activity: Activity) => {
            const lead = leadMap.get(activity.lead_id);
            if (lead) {
              const isReminder = activity.reminder_date;
              const contentText = `${activity.content}${
                activity.reminder_time
                  ? `${t("search.resultFormats.contentAtTime")}${
                      activity.reminder_time
                    }`
                  : ""
              }`;
              const matchedContent = isReminder
                ? t("search.resultFormats.reminderMatch", {
                    content: contentText,
                  })
                : t("search.resultFormats.noteMatch", {
                    content: activity.content,
                  });

              searchResults.push({
                id: activity.id,
                leadId: activity.lead_id,
                leadName: lead.name,
                leadStatusId: lead.status_id,
                type: isReminder ? "reminder" : "note",
                matchedContent:
                  matchedContent.length > 80
                    ? `${matchedContent.substring(0, 80)}...`
                    : matchedContent,
                status: lead.status,
                icon: isReminder ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                ),
              });
            }
          });
        }

        // Search sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .or(`notes.ilike.%${searchQuery}%,notes.is.null`);

        if (sessionsError) throw sessionsError;

        // Handle sessions search
        if (sessions && sessions.length > 0) {
          const sessionLeadIds = [
            ...new Set(sessions.map((s: Session) => s.lead_id)),
          ];
          const { data: sessionLeads } = await supabase
            .from("leads")
            .select("id, name, status, status_id")
            .in("id", sessionLeadIds);

          const sessionLeadMap = new Map<string, Lead>(
            ((sessionLeads as Lead[]) || []).map((lead) => [lead.id, lead])
          );

          sessions.forEach((session: Session) => {
            const lead = sessionLeadMap.get(session.lead_id);
            if (lead) {
              let matchedContent: string;

              if (
                searchQuery.toLowerCase().includes("no notes") &&
                !session.notes
              ) {
                matchedContent = t("search.resultFormats.sessionNoNotes", {
                  date: session.session_date,
                });
              } else if (
                session.notes?.toLowerCase().includes(searchQuery.toLowerCase())
              ) {
                const notesText = t("search.resultFormats.sessionNotes", {
                  notes: session.notes,
                });
                matchedContent =
                  notesText.length > 80
                    ? `${notesText.substring(0, 80)}...`
                    : notesText;
              } else {
                return; // Skip if no match
              }

              searchResults.push({
                id: session.id,
                leadId: session.lead_id,
                leadName: lead.name,
                leadStatusId: lead.status_id,
                type: "session",
                matchedContent,
                status: lead.status,
                icon: <Calendar className="h-4 w-4" />,
              });
            }
          });
        }

        // Search projects
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("*")
          .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);

        if (projectsError) throw projectsError;

        // Get leads for the found projects
        const projectData = (projects as ProjectRow[]) || [];
        if (projectData.length > 0) {
          const projectLeadIds = [
            ...new Set(projectData.map((p) => p.lead_id)),
          ];
          const { data: projectLeads } = await supabase
            .from("leads")
            .select("id, name, status, status_id")
            .in("id", projectLeadIds);

          const projectLeadMap = new Map<string, Lead>(
            ((projectLeads as Lead[] | null) ?? []).map((lead) => [
              lead.id,
              lead,
            ])
          );

          // Add project results
          projectData.forEach((project) => {
            let matchedContent = "";
            if (
              project.description
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase())
            ) {
              const descText = t("search.resultFormats.descriptionMatch", {
                description: project.description,
              });
              matchedContent =
                descText.length > 80
                  ? `${descText.substring(0, 80)}...`
                  : descText;
            }

            const lead = projectLeadMap.get(project.lead_id);

            searchResults.push({
              id: project.id,
              projectId: project.id,
              projectName: project.name,
              leadId: lead?.id,
              leadName: lead?.name,
              leadStatusId: lead?.status_id ?? null,
              projectStatusId: project.status_id ?? null,
              type: "project",
              matchedContent,
              status: lead?.status || "unknown",
              icon: <FolderOpen className="h-4 w-4" />,
            });
          });
        }

        // Sort results by type, pushing archived projects to the end
        const archivedStatusIds = new Set(
          projectStatuses
            .filter((s) => s.name?.toLowerCase?.() === "archived")
            .map((s) => s.id)
        );
        const sortedResults = searchResults.sort((a, b) => {
          const typeOrder = {
            lead: 0,
            project: 1,
            note: 2,
            reminder: 3,
            session: 4,
          };
          if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
          if (a.type === "project" && b.type === "project") {
            const aArchived = a.projectStatusId
              ? archivedStatusIds.has(a.projectStatusId)
              : false;
            const bArchived = b.projectStatusId
              ? archivedStatusIds.has(b.projectStatusId)
              : false;
            if (aArchived !== bArchived) return aArchived ? 1 : -1;
          }
          return 0;
        });

        setAllResults(sortedResults);
        setResults(sortedResults.slice(0, INITIAL_RESULT_COUNT));
      setIsOpen(true); // Always show dropdown when searching to display "no results" state
      setActiveIndex(-1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      toast({
        title: t("search.searchError"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    },
    [projectStatuses, t]
  );

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.trim().length > 2) {
        setDisplayedCount(INITIAL_RESULT_COUNT); // Reset displayed count for new search
        performSearch(query.trim());
      } else {
        setResults([]);
        setAllResults([]);
        setDisplayedCount(INITIAL_RESULT_COUNT);
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [performSearch, query]);

  const handleClearSearch = () => {
    setQuery("");
    setResults([]);
    setAllResults([]);
    setDisplayedCount(INITIAL_RESULT_COUNT);
    setIsOpen(false);
    setActiveIndex(-1);
    // Keep focus in the search bar for continued typing
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      const newCount = displayedCount + 10;
      setDisplayedCount(newCount);
      setResults(allResults.slice(0, newCount));
      setLoadingMore(false);
    }, 300); // Small delay for better UX
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "project" && result.leadId) {
      navigate(`/leads/${result.leadId}`);
    } else if (result.leadId) {
      navigate(`/leads/${result.leadId}`);
    }
    handleClearSearch(); // Auto-clear when navigating to a result
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const typeLabels = {
    lead: t("search.typeLabels.lead"),
    project: t("search.typeLabels.project"),
    note: t("search.typeLabels.note"),
    reminder: t("search.typeLabels.reminder"),
    session: t("search.typeLabels.session"),
  };

  let resultIndex = 0;

  const wrapperClassName = cn(
    "relative w-full min-w-0 transition-[flex-basis,max-width,width] duration-300 ease-out",
    className
  );

  const inputContainerClassName = cn(
    "relative group/search transition-[flex-basis,max-width,width] duration-300 ease-out",
    variant === "header" &&
      "rounded-full bg-muted/50 border border-transparent shadow-sm transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20"
  );

  const inputClassName = cn(
    "pl-10 pr-10 w-full truncate text-base transition-[width] duration-300 ease-out placeholder:font-light placeholder:text-muted-foreground/70",
    variant === "header" &&
      "h-12 border-none bg-transparent text-[0.95rem] sm:text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
  );

  const searchIconClassName = cn(
    "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within/search:text-foreground z-10 pointer-events-none",
    variant === "header" && "text-muted-foreground/60 group-focus-within/search:text-foreground"
  );

  return (
    <div className={wrapperClassName} ref={searchRef}>
      <div className={inputContainerClassName}>
        <Search className={searchIconClassName} />
        <Input
          ref={inputRef}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className={inputClassName}
        />
        {loading ? (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <span className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-muted-foreground/40 border-t-primary" />
            </span>
          </div>
        ) : (
          query && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-3 flex h-full items-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("search.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-background border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl backdrop-blur-sm z-[9999] max-h-96 overflow-y-auto">
          {loading ? (
            <SearchLoadingSkeleton rows={3} />
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{t("search.noResults")}</p>
              <p className="text-xs mt-2 opacity-75">
                {t("search.tryDifferent")}
              </p>
            </div>
          ) : (
            <div className="py-3">
              {Object.entries(groupedResults).map(
                ([type, typeResults], groupIndex) => (
                  <div key={type}>
                    {groupIndex > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 mx-2" />
                    )}
                    <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                      {typeLabels[type as keyof typeof typeLabels]} (
                      {typeResults.length})
                    </div>
                    {typeResults.map((result) => {
                      const currentIndex = resultIndex++;
                      const isActive = currentIndex === activeIndex;
                      const displayMatchedContent = result.customFieldKey
                        ? buildCustomFieldMatchedContent(
                            result.customFieldKey,
                            result.customFieldValue
                          )
                        : result.matchedContent;
                      const matchedContentToShow =
                        displayMatchedContent && displayMatchedContent.length > 80
                          ? `${displayMatchedContent.substring(0, 80)}...`
                          : displayMatchedContent;

                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className={`w-full text-left px-4 py-3 transition-colors group ${
                            isActive ? "bg-muted/50" : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                              {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">
                                  {result.type === "project"
                                    ? result.projectName
                                    : result.leadName}
                                </p>
                                <div className="flex items-center gap-2 ml-2">
                                  {result.type === "project" &&
                                  result.projectId ? (
                                    statusesLoading ? (
                                      <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                                    ) : (
                                      <ProjectStatusBadge
                                        projectId={result.projectId}
                                        currentStatusId={
                                          result.projectStatusId ?? undefined
                                        }
                                        editable={false}
                                        size="sm"
                                        statuses={projectStatuses}
                                      />
                                    )
                                  ) : result.leadId ? (
                                    statusesLoading ? (
                                      <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                                    ) : (
                                      <LeadStatusBadge
                                        leadId={result.leadId}
                                        currentStatusId={
                                          result.leadStatusId ?? undefined
                                        }
                                        editable={false}
                                        size="sm"
                                        statuses={leadStatuses}
                                      />
                                    )
                                  ) : null}
                                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                              {matchedContentToShow && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {matchedContentToShow}
                                </p>
                              )}
                              {result.type === "project" && result.leadName && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {t("search.leadLabel")} {result.leadName}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              )}
              {allResults.length > results.length && (
                <div className="border-t border-slate-100 dark:border-slate-800 mx-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full px-4 py-3 text-center text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        {t("search.loadingMore")}
                      </div>
                    ) : (
                      t("search.loadMore", {
                        count: Math.min(10, allResults.length - results.length),
                        remaining: allResults.length - results.length,
                      })
                    )}
                  </button>
                </div>
              )}
              {allResults.length > 10 &&
                results.length === allResults.length && (
                  <div className="border-t border-slate-100 dark:border-slate-800 mx-2">
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        {t("search.showingAll", { count: allResults.length })}
                      </p>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
