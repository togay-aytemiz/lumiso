import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Clock, Calendar, User, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface SearchResult {
  id: string;
  leadId: string;
  leadName: string;
  type: 'lead' | 'note' | 'reminder' | 'session';
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

const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.trim().length > 2) {
        performSearch(query.trim());
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);

      if (leadsError) throw leadsError;

      // Add lead results
      leads?.forEach((lead: Lead) => {
        let matchedContent = 'Lead profile';
        if (lead.email?.toLowerCase().includes(searchQuery.toLowerCase())) {
          matchedContent = `Email: ${lead.email}`;
        } else if (lead.phone?.toLowerCase().includes(searchQuery.toLowerCase())) {
          matchedContent = `Phone: ${lead.phone}`;
        }

        searchResults.push({
          id: lead.id,
          leadId: lead.id,
          leadName: lead.name,
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
          .select('id, name, status')
          .in('id', leadIds);

        const leadMap = new Map(activityLeads?.map(l => [l.id, l]) || []);

        activities.forEach((activity: Activity) => {
          const lead = leadMap.get(activity.lead_id);
          if (lead) {
            const isReminder = activity.reminder_date;
            const matchedContent = isReminder 
              ? `Reminder: ${activity.content}${activity.reminder_time ? ` at ${activity.reminder_time}` : ''}`
              : `Note: ${activity.content}`;

            searchResults.push({
              id: activity.id,
              leadId: activity.lead_id,
              leadName: lead.name,
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
          .select('id, name, status')
          .in('id', sessionLeadIds);

        const sessionLeadMap = new Map(sessionLeads?.map(l => [l.id, l]) || []);

        sessions.forEach((session: Session) => {
          const lead = sessionLeadMap.get(session.lead_id);
          if (lead) {
            let matchedContent: string;
            
            if (searchQuery.toLowerCase().includes('no notes') && !session.notes) {
              matchedContent = `Session on ${session.session_date} - No notes`;
            } else if (session.notes?.toLowerCase().includes(searchQuery.toLowerCase())) {
              matchedContent = `Session notes: ${session.notes}`;
              if (matchedContent.length > 80) {
                matchedContent = `${matchedContent.substring(0, 80)}...`;
              }
            } else {
              return; // Skip if no match
            }

            searchResults.push({
              id: session.id,
              leadId: session.lead_id,
              leadName: lead.name,
              type: 'session',
              matchedContent,
              status: lead.status,
              icon: <Calendar className="h-4 w-4" />
            });
          }
        });
      }

      // Sort results by type and limit to 10
      const sortedResults = searchResults
        .sort((a, b) => {
          const typeOrder = { lead: 0, note: 1, reminder: 2, session: 3 };
          return typeOrder[a.type] - typeOrder[b.type];
        })
        .slice(0, 10);

      setResults(sortedResults);
      setIsOpen(sortedResults.length > 0);
    } catch (error: any) {
      toast({
        title: "Search error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'qualified': return 'outline';
      case 'booked': return 'default';
      case 'completed': return 'default';
      case 'lost': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
      case 'contacted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'qualified': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'booked': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'lost': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(`/leads/${result.leadId}`);
    setIsOpen(false);
    setQuery("");
  };

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const typeLabels = {
    lead: 'Leads',
    note: 'Notes',
    reminder: 'Reminders',
    session: 'Sessions'
  };

  return (
    <div className="relative flex-1 max-w-md mx-4" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search leads, notes, reminders, sessions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="pl-10 pr-4 h-9 border-slate-200 dark:border-slate-700"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-background border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No matches found</p>
              <p className="text-xs mt-1">Try searching for lead names, emails, or notes</p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedResults).map(([type, typeResults], groupIndex) => (
                <div key={type}>
                  {groupIndex > 0 && <div className="border-t border-slate-100 dark:border-slate-800 mx-2" />}
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {typeLabels[type as keyof typeof typeLabels]} ({typeResults.length})
                  </div>
                  {typeResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{result.leadName}</p>
                            <div className="flex items-center gap-2 ml-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(result.status)}`}>
                                {result.status}
                              </span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {result.matchedContent}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
              {results.length === 10 && (
                <div className="border-t border-slate-100 dark:border-slate-800 mx-2">
                  <div className="px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      Showing first 10 results
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