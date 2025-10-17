import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { SearchLoadingSkeleton } from "@/components/ui/loading-presets";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useKeyboardNavigation, useScreenReader } from '@/hooks/useAccessibility';
import { performanceMonitor } from '@/utils/performance';

interface SearchResult {
  id: string;
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  type: 'lead' | 'note' | 'reminder' | 'session' | 'project';
  matchedContent: string;
  status: string;
  icon: React.ReactNode;
}

/**
 * Accessible Global Search with keyboard navigation and screen reader support
 */
export const AccessibleGlobalSearch = React.memo(() => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Accessibility hooks
  const { announce } = useScreenReader();
  const { activeIndex, handleKeyDown, containerRef } = useKeyboardNavigation(
    results,
    useCallback((result: SearchResult) => {
      handleResultClick(result);
    }, [])
  );

  // Memoized search function for performance
  const performSearch = useCallback(async (searchQuery: string) => {
    performanceMonitor.startTiming('GlobalSearch.performSearch');
    setLoading(true);
    
    try {
      // Simplified search for demonstration - would include full search logic
      const { data: leads } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, status_id')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);

      const searchResults: SearchResult[] = (leads || []).map(lead => ({
        id: lead.id,
        leadId: lead.id,
        leadName: lead.name,
        type: 'lead' as const,
        matchedContent: lead.email ? `Email: ${lead.email}` : '',
        status: lead.status,
        icon: <Search className="h-4 w-4" />
      }));

      setResults(searchResults);
      setIsOpen(true);
      
      // Announce results to screen readers
      const resultCount = searchResults.length;
      announce(
        resultCount === 0 
          ? "No search results found"
          : `${resultCount} search ${resultCount === 1 ? 'result' : 'results'} found`,
        'polite'
      );
      
    } catch (error: any) {
      toast({
        title: "Search error",
        description: error.message,
        variant: "destructive"
      });
      announce("Search failed", 'assertive');
    } finally {
      setLoading(false);
      performanceMonitor.endTiming('GlobalSearch.performSearch');
    }
  }, [announce]);

  // Debounced search effect
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
  }, [query, performSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.type === 'project' && result.leadId) {
      navigate(`/leads/${result.leadId}`);
    } else if (result.leadId) {
      navigate(`/leads/${result.leadId}`);
    }
    
    // Clear search and announce navigation
    setQuery("");
    setResults([]);
    setIsOpen(false);
    announce(`Navigating to ${result.leadName || result.projectName}`, 'polite');
  }, [navigate, announce]);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    announce("Search cleared", 'polite');
    // Keep focus in the search bar
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [announce]);

  // Combined keyboard handler
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      announce("Search closed", 'polite');
      return;
    }
    
    if (isOpen && results.length > 0) {
      handleKeyDown(e);
    }
  }, [isOpen, results.length, handleKeyDown, announce]);

  return (
    <div className="relative w-full min-w-0" ref={searchRef}>
      <div className="relative">
        <Search 
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" 
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          placeholder="Search everything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="pl-10 pr-10 w-full truncate"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-describedby="search-instructions"
        />
        
        {/* Screen reader instructions */}
        <div id="search-instructions" className="sr-only">
          Type to search. Use arrow keys to navigate results, Enter to select, Escape to close.
        </div>
        
        {query && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
            tabIndex={0}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className="absolute top-full mt-2 left-0 right-0 bg-background border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl backdrop-blur-sm z-[9999] max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {loading ? (
            <SearchLoadingSkeleton rows={3} />
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p className="text-sm font-medium" role="status">No results found</p>
              <p className="text-xs mt-2 opacity-75">Try different keywords or check your spelling</p>
            </div>
          ) : (
            <div className="py-3">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  id={`search-result-${index}`}
                  data-index={index}
                  onClick={() => handleResultClick(result)}
                  className={`w-full text-left px-4 py-3 transition-colors group ${
                    index === activeIndex ? 'bg-muted/50' : 'hover:bg-muted/30'
                  }`}
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-describedby={`result-description-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true">
                      {result.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {result.type === 'project' ? result.projectName : result.leadName}
                      </p>
                      {result.matchedContent && (
                        <p 
                          id={`result-description-${index}`}
                          className="text-xs text-muted-foreground truncate mt-1"
                        >
                          {result.matchedContent}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AccessibleGlobalSearch.displayName = 'AccessibleGlobalSearch';
