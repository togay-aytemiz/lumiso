import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  FileQuestion,
} from "lucide-react";
import { SearchLoadingSkeleton } from "@/components/ui/loading-presets";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

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

const RECENT_SEARCHES_KEY = "global-search-recents";
const MAX_RECENT_SEARCHES = 5;
const INITIAL_RESULT_COUNT = 10;

interface GlobalSearchProps {
  variant?: "default" | "header" | "page";
  className?: string;
  autoFocus?: boolean;
  initialQuery?: string;
  onQueryChange?: (value: string) => void;
  resultsPortalId?: string;
}

const GlobalSearch = ({
  variant = "default",
  className,
  autoFocus = false,
  initialQuery,
  onQueryChange,
  resultsPortalId,
}: GlobalSearchProps) => {
  const { t } = useFormsTranslation();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [displayedCount, setDisplayedCount] =
    useState<number>(INITIAL_RESULT_COUNT);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPendingSearch, setIsPendingSearch] = useState(false);
  const isPageVariant = variant === "page";
  const [resultsPortalElement, setResultsPortalElement] =
    useState<HTMLElement | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const trimmedQuery = query.trim();
  const hasRecentSearches = recentSearches.length > 0;

  // Preload statuses to avoid per-row fetching and flicker
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusRow[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusRow[]>(
    []
  );
  const [leadFieldLabels, setLeadFieldLabels] = useState<
    Record<string, string>
  >({});
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);

  const updateRecentSearches = useCallback(
    (updater: (prev: string[]) => string[]) => {
      setRecentSearches((prev) => {
        const next = updater(prev);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              RECENT_SEARCHES_KEY,
              JSON.stringify(next)
            );
          } catch {
            // no-op when storage is unavailable
          }
        }
        return next;
      });
    },
    []
  );

  const addRecentSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      updateRecentSearches((prev) =>
        [trimmed, ...prev.filter((entry) => entry !== trimmed)].slice(
          0,
          MAX_RECENT_SEARCHES
        )
      );
    },
    [updateRecentSearches]
  );

  const removeRecentSearch = useCallback(
    (term: string) => {
      updateRecentSearches((prev) => prev.filter((entry) => entry !== term));
    },
    [updateRecentSearches]
  );

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
    if (initialQuery === undefined) return;
    if (initialQuery === query) return;
    setQuery(initialQuery);
  }, [initialQuery, query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentSearches(
          parsed
            .map((entry) => String(entry))
            .filter(Boolean)
            .slice(0, 5)
        );
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    if (!isPageVariant || !resultsPortalId || typeof document === "undefined") {
      return;
    }
    const portalElement = document.getElementById(resultsPortalId);
    setResultsPortalElement(portalElement);
  }, [isPageVariant, resultsPortalId]);

  useEffect(() => {
    if (variant === "page") return;
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
  }, [variant]);

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
            definitions.reduce<Record<string, string>>((acc, definition) => {
              if (definition.field_key && definition.label) {
                acc[definition.field_key] = definition.label;
              }
              return acc;
            }, {})
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

  // Fetch recently added items (leads and projects)
  useEffect(() => {
    const fetchRecentItems = async () => {
      try {
        const [leadsResponse, projectsResponse] = await Promise.all([
          supabase
            .from("leads")
            .select("id, name, status, status_id, created_at")
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("projects")
            .select("id, name, description, status_id, lead_id, created_at")
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

        const leads = leadsResponse.data || [];
        const projects = projectsResponse.data || [];

        // Fetch lead details for projects
        const projectLeadIds = projects
          .map((p) => p.lead_id)
          .filter(Boolean) as string[];

        let projectLeadMap = new Map<string, { name: string; status: string; status_id: string | null }>();

        if (projectLeadIds.length > 0) {
          const { data: leadData } = await supabase
            .from("leads")
            .select("id, name, status, status_id")
            .in("id", projectLeadIds);

          if (leadData) {
            projectLeadMap = new Map(
              leadData.map((l) => [l.id, l])
            );
          }
        }

        const formattedLeads: SearchResult[] = leads.map((lead) => ({
          id: lead.id,
          leadId: lead.id,
          leadName: lead.name,
          leadStatusId: lead.status_id,
          type: "lead",
          matchedContent: "", // No matched content for recent items
          status: lead.status,
          icon: <User className="h-4 w-4" />,
          // @ts-ignore - adding created_at for sorting locally if needed
          createdAt: lead.created_at,
        }));

        const formattedProjects: SearchResult[] = projects.map((project) => {
          const lead = project.lead_id ? projectLeadMap.get(project.lead_id) : null;
          return {
            id: project.id,
            projectId: project.id,
            projectName: project.name,
            leadId: project.lead_id,
            leadName: lead?.name,
            leadStatusId: lead?.status_id ?? null,
            projectStatusId: project.status_id,
            type: "project",
            matchedContent: project.description || "",
            status: lead?.status || "unknown",
            icon: <FolderOpen className="h-4 w-4" />,
            // @ts-ignore
            createdAt: project.created_at,
          };
        });

        // Combine and sort by created_at desc
        const combined = [...formattedLeads, ...formattedProjects].sort((a, b) => {
          // @ts-ignore
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        setRecentItems(combined.slice(0, 5));
      } catch (error) {
        console.error("Error fetching recent items:", error);
      }
    };

    fetchRecentItems();
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timeout);
  }, [autoFocus]);

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
              const contentText = `${activity.content}${activity.reminder_time
                ? `${t("search.resultFormats.contentAtTime")}${activity.reminder_time
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
        addRecentSearch(searchQuery);
        setIsOpen(true); // Always show dropdown when searching to display "no results" state
        setActiveIndex(-1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: t("search.searchError"),
          description: message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setIsPendingSearch(false);
      }
    },
    [addRecentSearch, projectStatuses, t]
  );

  useEffect(() => {
    const trimmed = query.trim();
    const shouldSearch = trimmed.length > 2;
    setIsPendingSearch(shouldSearch);

    if (!isPageVariant && !hasInteracted) {
      setIsOpen(false);
      return;
    }

    const delayedSearch = setTimeout(() => {
      if (shouldSearch) {
        setDisplayedCount(INITIAL_RESULT_COUNT); // Reset displayed count for new search
        performSearch(trimmed);
      } else {
        setIsPendingSearch(false);
        setResults([]);
        setAllResults([]);
        setDisplayedCount(INITIAL_RESULT_COUNT);
        setIsOpen(!isPageVariant && (hasRecentSearches || hasInteracted));
        setActiveIndex(-1);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [hasInteracted, hasRecentSearches, isPageVariant, performSearch, query]);

  const handleClearSearch = () => {
    setQuery("");
    setResults([]);
    setAllResults([]);
    setDisplayedCount(INITIAL_RESULT_COUNT);
    if (!isPageVariant) {
      setIsOpen(hasRecentSearches || hasInteracted);
    }
    setActiveIndex(-1);
    onQueryChange?.("");
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
    if (result.type === "project" && result.projectId) {
      navigate(`/projects/${result.projectId}`);
    } else if (result.type === "project" && result.leadId) {
      // Fallback if no project ID (shouldn't happen for valid projects)
      navigate(`/leads/${result.leadId}`);
    } else if (result.leadId) {
      navigate(`/leads/${result.leadId}`);
    }
    if (!isPageVariant) {
      handleClearSearch(); // Auto-clear when navigating to a result
    }
  };

  const handleRecentSearchClick = useCallback(
    (term: string) => {
      setHasInteracted(true);
      setQuery(term);
      onQueryChange?.(term);
      setIsOpen(true);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    },
    [onQueryChange]
  );

  const handleRecentSearchRemove = useCallback(
    (term: string) => {
      removeRecentSearch(term);
    },
    [removeRecentSearch]
  );

  const handleClearAllRecentSearches = useCallback(() => {
    updateRecentSearches(() => []);
  }, [updateRecentSearches]);

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
  const hasMinimumQuery = trimmedQuery.length > 2;
  const showInitialHint = isPageVariant && !loading && query.trim().length < 3;

  const wrapperClassName = cn(
    "relative w-full min-w-0 transition-[flex-basis,max-width,width] duration-300 ease-out",
    className
  );

  const inputContainerClassName = cn(
    "relative group/search transition-[flex-basis,max-width,width] duration-300 ease-out",
    variant === "header" &&
    "rounded-full bg-muted/50 border border-transparent shadow-sm transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20",
    isPageVariant &&
    "rounded-2xl border border-border/70 bg-white/95 shadow-sm ring-1 ring-black/[0.02] px-2 py-1.5"
  );

  const inputClassName = cn(
    "pl-10 pr-10 w-full truncate text-base transition-[width] duration-300 ease-out placeholder:font-light placeholder:text-muted-foreground/70",
    (variant === "header" || isPageVariant) &&
    "h-12 border-none bg-transparent text-[0.95rem] sm:text-base lg:text-[1.05rem] lg:placeholder:text-[1.05rem] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
  );

  const searchIconClassName = cn(
    "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within/search:text-foreground z-10 pointer-events-none",
    (variant === "header" || isPageVariant) &&
    "text-muted-foreground/60 group-focus-within/search:text-foreground"
  );

  const shouldShowResultsPanel = isPageVariant ? hasMounted : isOpen;

  const resultsContainerClassName = cn(
    "bg-background transition-all duration-200",
    isPageVariant
      ? ""
      : "absolute top-full mt-2 left-0 right-0 z-[9999] max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-sm"
  );

  const showRecentSection =
    hasRecentSearches &&
    !loading &&
    !isPendingSearch &&
    trimmedQuery.length === 0 &&
    (isPageVariant || hasInteracted);

  const recentSearchSection = showRecentSection ? (
    <div className={cn("py-3 space-y-2", isPageVariant && "py-0 space-y-0")}>
      <div
        className={cn(
          "flex items-center justify-between px-4 pt-1",
          isPageVariant && "px-3 pt-0.5 pb-0"
        )}
      >
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("search.recentSearches")}
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          onClick={handleClearAllRecentSearches}
          aria-label={t("search.clearRecentSearches")}
        >
          {t("search.clearRecentSearches")}
        </button>
      </div>
      {recentSearches.map((term) => (
        <div
          key={term}
          className={cn(
            "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
            isPageVariant && "px-3 py-0 gap-2"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground/70" />
          <button
            type="button"
            className="flex-1 text-left text-sm truncate"
            onClick={() => handleRecentSearchClick(term)}
          >
            {term}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleRecentSearchRemove(term);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`${t("search.removeRecent")} ${term}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  ) : null;

  const resultsSection =
    results.length > 0 ? (
      <div className={cn("py-3", isPageVariant && "py-2")}>
        {Object.entries(groupedResults).map(
          ([type, typeResults], groupIndex) => (
            <div key={type}>
              {groupIndex > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 mx-2" />
              )}
              <div
                className={cn(
                  "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30",
                  isPageVariant && "px-3 py-2"
                )}
              >
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
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors group",
                      isActive ? "bg-muted/50" : "hover:bg-muted/30",
                      isPageVariant && "px-3 py-2.5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-muted-foreground">
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-sm truncate">
                              {result.type === "project"
                                ? result.projectName
                                : result.leadName}
                            </p>
                            <div className="flex items-center gap-2">
                              {result.type === "project" && result.projectId ? (
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
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
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
              className={cn(
                "w-full px-4 py-3 text-center text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50",
                isPageVariant && "px-3 py-2.5"
              )}
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
        {allResults.length > 10 && results.length === allResults.length && (
          <div className="border-t border-slate-100 dark:border-slate-800 mx-2">
            <div
              className={cn(
                "px-4 py-3 text-center",
                isPageVariant && "px-3 py-2.5"
              )}
            >
              <p className="text-xs text-muted-foreground">
                {t("search.showingAll", { count: allResults.length })}
              </p>
            </div>
          </div>
        )}
      </div>
    ) : null;

  const noResultsState =
    hasMinimumQuery &&
    !loading &&
    !isPendingSearch &&
    results.length === 0 &&
    !resultsSection;


  const showRecentlyAdded =
    !loading &&
    !isPendingSearch &&
    trimmedQuery.length === 0 &&
    !resultsSection &&
    (isPageVariant || hasInteracted) &&
    recentItems.length > 0;


  const showSearchPrompt =
    !loading &&
    !isPendingSearch &&
    trimmedQuery.length === 0 &&
    !resultsSection &&
    (isPageVariant || hasInteracted);

  const searchPrompt = showSearchPrompt ? (
    <div
      className={cn(
        "py-8 px-4 text-center border-b border-border/40",
        isPageVariant && "py-6 px-3"
      )}
    >
      <div className="relative w-12 h-12 mx-auto mb-4">
        <div
          className="absolute inset-0 bg-primary/5 rounded-full animate-ping"
          style={{ animationDuration: "3s" }}
        />
        <div className="relative bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
          <Search className="h-6 w-6 text-primary" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">
        {t("search.searchPromptTitle")}
      </p>
      <p className="text-xs text-muted-foreground mt-1 px-4 text-balance">
        {t("search.searchPromptDescription")}
      </p>
    </div>
  ) : null;

  const resultsInner = (
    <>
      {searchPrompt}
      {recentSearchSection}
      {showRecentlyAdded && (
        <div className={cn("py-3", isPageVariant && "py-2")}>
          <div
            className={cn(
              "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30",
              isPageVariant && "px-3 py-2"
            )}
          >
            {t("search.recentlyAdded")}
          </div>
          {recentItems.map((result) => (
            <button
              key={`recent-${result.type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors group hover:bg-muted/30",
                isPageVariant && "px-3 py-2.5"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 text-muted-foreground">
                  {result.icon}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-sm truncate">
                        {result.type === "project"
                          ? result.projectName
                          : result.leadName}
                      </p>
                      <div className="flex items-center gap-2">
                        {result.type === "project" && result.projectId ? (
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
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    {result.type === "project" && result.leadName && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {t("search.leadLabel")} {result.leadName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {loading || (isPendingSearch && hasInteracted) ? (
        <SearchLoadingSkeleton rows={3} />
      ) : (
        <>
          {resultsSection}
          {noResultsState ? (
            <div
              className={cn(
                "p-6 text-center text-muted-foreground",
                isPageVariant && "p-4"
              )}
            >
              <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileQuestion className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("search.noResults")}</p>
              <p className="text-xs mt-1 opacity-75">
                {t("search.tryDifferent")}
              </p>
            </div>
          ) : !resultsSection && !showRecentlyAdded && showInitialHint ? (
            <div
              className={cn(
                "p-6 text-center text-muted-foreground",
                isPageVariant && "p-4"
              )}
            >
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{t("search.placeholder")}</p>
            </div>
          ) : null}
        </>
      )}
    </>
  );

  const resultsContent = shouldShowResultsPanel ? (
    isPageVariant ? (
      resultsInner
    ) : (
      <div className={resultsContainerClassName}>{resultsInner}</div>
    )
  ) : null;

  const renderedResults = isPageVariant
    ? resultsContent &&
    (resultsPortalElement
      ? createPortal(resultsContent, resultsPortalElement)
      : resultsPortalId
        ? null
        : resultsContent)
    : resultsContent;

  return (
    <div className={wrapperClassName} ref={searchRef}>
      <div className={inputContainerClassName}>
        <Search className={searchIconClassName} />
        <Input
          ref={inputRef}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setHasInteracted(true);
            onQueryChange?.(value);
            if (!isPageVariant) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setHasInteracted(true);
            if (!isPageVariant) setIsOpen(true);
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

      {renderedResults}
    </div>
  );
};

export default GlobalSearch;
