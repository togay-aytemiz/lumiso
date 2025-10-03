import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, FileText, Clock, Calendar, User, ChevronRight, X, FolderOpen } from "lucide-react";
import { SearchLoadingSkeleton } from "@/components/ui/loading-presets";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

interface SearchResult {
  id: string;
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  projectStatusId?: string | null;
  leadStatusId?: string | null;
  type: 'lead' | 'note' | 'reminder' | 'session' | 'project';
  matchedContent: string;
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

interface Project {
  id: string;
  name: string;
  description?: string;
  lead_id: string;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    name: string;
    status: string;
  };
}

const GlobalSearch = () => {
  const { t } = useFormsTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [displayedCount, setDisplayedCount] = useState(10);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Preload statuses to avoid per-row fetching and flicker
  const [leadStatuses, setLeadStatuses] = useState<any[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<any[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preload lead/project statuses once to avoid per-row fetching
  useEffect(() => {
    let mounted = true;
    setStatusesLoading(true);
    (async () => {
      try {
        // Get user's organization ID for single-user filtering
        const { getUserOrganizationId } = await import('@/lib/organizationUtils');
        const organizationId = await getUserOrganizationId();
        
        if (!organizationId) {
          if (mounted) {
            setLeadStatuses([]);
            setProjectStatuses([]);
            setStatusesLoading(false);
          }
          return;
        }

        const [ls, ps] = await Promise.all([
          supabase
            .from('lead_statuses')
            .select('*')
            .eq('organization_id', organizationId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('project_statuses')
            .select('*')
            .eq('organization_id', organizationId)
            .order('sort_order', { ascending: true })
        ]);
        if (!mounted) return;
        setLeadStatuses(ls.data || []);
        setProjectStatuses(ps.data || []);
      } catch (e) {
        // no-op
      } finally {
        if (mounted) setStatusesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.trim().length > 2) {
        setDisplayedCount(10); // Reset displayed count for new search
        performSearch(query.trim());
      } else {
        setResults([]);
        setAllResults([]);
        setDisplayedCount(10);
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => prev <= 0 ? results.length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleResultClick(results[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search leads with better special character handling
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, status_id')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);

      if (leadsError) {
        console.error('GlobalSearch: Leads error:', leadsError);
        throw leadsError;
      }

      // Add lead results
      leads?.forEach((lead: Lead) => {
        let matchedContent = '';
        if (lead.email?.toLowerCase().includes(searchQuery.toLowerCase())) {
          matchedContent = t('search.resultFormats.emailMatch', { email: lead.email });
        } else if (lead.phone?.toLowerCase().includes(searchQuery.toLowerCase())) {
          matchedContent = t('search.resultFormats.phoneMatch', { phone: lead.phone });
        }

        searchResults.push({
          id: lead.id,
          leadId: lead.id,
          leadName: lead.name,
          leadStatusId: lead.status_id,
          type: 'lead',
          matchedContent,
          status: lead.status,
          icon: <User className="h-4 w-4" />
        });
      });

      // Search activities (notes and reminders)
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('*')
        .ilike('content', `%${searchQuery}%`);

      if (activitiesError) throw activitiesError;

      // Get lead names for activities
      if (activities && activities.length > 0) {
        const leadIds = [...new Set(activities.map((a: Activity) => a.lead_id))];
        const { data: activityLeads } = await supabase
          .from('leads')
          .select('id, name, status, status_id')
          .in('id', leadIds);

        const leadMap = new Map(activityLeads?.map(l => [l.id, l]) || []);

        activities.forEach((activity: Activity) => {
          const lead = leadMap.get(activity.lead_id);
          if (lead) {
            const isReminder = activity.reminder_date;
            const contentText = `${activity.content}${activity.reminder_time ? ` at ${activity.reminder_time}` : ''}`;
            const matchedContent = isReminder 
              ? t('search.resultFormats.reminderMatch', { content: contentText })
              : t('search.resultFormats.noteMatch', { content: activity.content });

            searchResults.push({
              id: activity.id,
              leadId: activity.lead_id,
              leadName: lead.name,
              leadStatusId: lead.status_id,
              type: isReminder ? 'reminder' : 'note',
              matchedContent: matchedContent.length > 80 ? `${matchedContent.substring(0, 80)}...` : matchedContent,
              status: lead.status,
              icon: isReminder ? <Clock className="h-4 w-4" /> : <FileText className="h-4 w-4" />
            });
          }
        });
      }

      // Search sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .or(`notes.ilike.%${searchQuery}%,notes.is.null`);

      if (sessionsError) throw sessionsError;

      // Handle sessions search
      if (sessions && sessions.length > 0) {
        const sessionLeadIds = [...new Set(sessions.map((s: Session) => s.lead_id))];
        const { data: sessionLeads } = await supabase
          .from('leads')
          .select('id, name, status, status_id')
          .in('id', sessionLeadIds);

        const sessionLeadMap = new Map(sessionLeads?.map(l => [l.id, l]) || []);

        sessions.forEach((session: Session) => {
          const lead = sessionLeadMap.get(session.lead_id);
          if (lead) {
            let matchedContent: string;
            
            if (searchQuery.toLowerCase().includes('no notes') && !session.notes) {
              matchedContent = t('search.resultFormats.sessionNoNotes', { date: session.session_date });
            } else if (session.notes?.toLowerCase().includes(searchQuery.toLowerCase())) {
              const notesText = t('search.resultFormats.sessionNotes', { notes: session.notes });
              matchedContent = notesText.length > 80 ? `${notesText.substring(0, 80)}...` : notesText;
            } else {
              return; // Skip if no match
            }

            searchResults.push({
              id: session.id,
              leadId: session.lead_id,
              leadName: lead.name,
              leadStatusId: lead.status_id,
              type: 'session',
              matchedContent,
              status: lead.status,
              icon: <Calendar className="h-4 w-4" />
            });
          }
        });
      }

      // Search projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);

      if (projectsError) throw projectsError;

      // Get leads for the found projects
      if (projects && projects.length > 0) {
        const projectLeadIds = [...new Set(projects.map((p: any) => p.lead_id))];
        const { data: projectLeads } = await supabase
          .from('leads')
          .select('id, name, status, status_id')
          .in('id', projectLeadIds);

        const projectLeadMap = new Map(projectLeads?.map(l => [l.id, l]) || []);

        // Add project results
        projects.forEach((project: any) => {
          let matchedContent = '';
          if (project.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
            const descText = t('search.resultFormats.descriptionMatch', { description: project.description });
            matchedContent = descText.length > 80 ? `${descText.substring(0, 80)}...` : descText;
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
            type: 'project',
            matchedContent,
            status: lead?.status || 'unknown',
            icon: <FolderOpen className="h-4 w-4" />
          });
        });
      }

      // Sort results by type, pushing archived projects to the end
      const archivedStatusIds = new Set(projectStatuses.filter(s => s.name?.toLowerCase?.() === 'archived').map(s => s.id));
      const sortedResults = searchResults
        .sort((a, b) => {
          const typeOrder = { lead: 0, project: 1, note: 2, reminder: 3, session: 4 };
          if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
          if (a.type === 'project' && b.type === 'project') {
            const aArchived = a.projectStatusId ? archivedStatusIds.has(a.projectStatusId) : false;
            const bArchived = b.projectStatusId ? archivedStatusIds.has(b.projectStatusId) : false;
            if (aArchived !== bArchived) return aArchived ? 1 : -1;
          }
          return 0;
        });

      setAllResults(sortedResults);
      setResults(sortedResults.slice(0, displayedCount));
      setIsOpen(true); // Always show dropdown when searching to display "no results" state
      setActiveIndex(-1);
    } catch (error: any) {
      toast({
        title: t('search.searchError'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const handleClearSearch = () => {
    setQuery("");
    setResults([]);
    setAllResults([]);
    setDisplayedCount(10);
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
    if (result.type === 'project' && result.leadId) {
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
    lead: t('search.typeLabels.lead'),
    project: t('search.typeLabels.project'),
    note: t('search.typeLabels.note'),
    reminder: t('search.typeLabels.reminder'),
    session: t('search.typeLabels.session')
  };

  let resultIndex = 0;

  return (
    <div className="relative w-full min-w-0" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="pl-10 pr-10 w-full truncate"
        />
        {query && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('search.clearSearch')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-background border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl backdrop-blur-sm z-[9999] max-h-96 overflow-y-auto">
          {loading ? (
            <SearchLoadingSkeleton rows={3} />
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{t('search.noResults')}</p>
              <p className="text-xs mt-2 opacity-75">{t('search.tryDifferent')}</p>
            </div>
          ) : (
            <div className="py-3">
              {Object.entries(groupedResults).map(([type, typeResults], groupIndex) => (
                <div key={type}>
                  {groupIndex > 0 && <div className="border-t border-slate-100 dark:border-slate-800 mx-2" />}
                  <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                    {typeLabels[type as keyof typeof typeLabels]} ({typeResults.length})
                  </div>
                  {typeResults.map((result) => {
                    const currentIndex = resultIndex++;
                    const isActive = currentIndex === activeIndex;
                    
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result)}
                        className={`w-full text-left px-4 py-3 transition-colors group ${
                          isActive ? 'bg-muted/50' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                            {result.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm truncate">
                                {result.type === 'project' ? result.projectName : result.leadName}
                              </p>
                              <div className="flex items-center gap-2 ml-2">
                                {result.type === 'project' && result.projectId ? (
                                  statusesLoading ? (
                                    <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                                  ) : (
                                    <ProjectStatusBadge
                                      projectId={result.projectId}
                                      currentStatusId={result.projectStatusId ?? undefined}
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
                                       currentStatusId={result.leadStatusId ?? undefined}
                                       editable={false}
                                       size="sm"
                                       statuses={leadStatuses}
                                     />
                                   )
                                ) : null}
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                            {result.matchedContent && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {result.matchedContent}
                              </p>
                            )}
                            {result.type === 'project' && result.leadName && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {t('search.leadLabel')} {result.leadName}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                 </div>
               ))}
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
                          {t('search.loadingMore')}
                        </div>
                      ) : (
                        t('search.loadMore', { 
                          count: Math.min(10, allResults.length - results.length),
                          remaining: allResults.length - results.length
                        })
                      )}
                   </button>
                 </div>
               )}
               {allResults.length > 10 && results.length === allResults.length && (
                 <div className="border-t border-slate-100 dark:border-slate-800 mx-2">
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        {t('search.showingAll', { count: allResults.length })}
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