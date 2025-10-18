import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseAdvancedTableSearchOptions {
  searchValue?: string;
  defaultSearchValue?: string;
  onSearchChange?: (value: string) => void;
  searchDelay: number;
  searchMinChars: number;
}

interface UseAdvancedTableSearchResult {
  searchInputValue: string;
  handleSearchInputChange: (value: string) => void;
  clearSearch: () => void;
  canClearSearch: boolean;
}

export function useAdvancedTableSearch({
  searchValue,
  defaultSearchValue,
  onSearchChange,
  searchDelay,
  searchMinChars,
}: UseAdvancedTableSearchOptions): UseAdvancedTableSearchResult {
  const isControlled = searchValue !== undefined;
  const [internalSearch, setInternalSearch] = useState(
    searchValue ?? defaultSearchValue ?? ""
  );
  const searchTimerRef = useRef<number | null>(null);
  const lastSubmittedSearchRef = useRef<string>(
    (searchValue ?? defaultSearchValue ?? "").trim()
  );

  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  const emitSearchChange = useCallback(
    (value: string) => {
      if (!onSearchChange) return;
      const trimmed = value.trim();
      if (trimmed === lastSubmittedSearchRef.current) {
        return;
      }
      onSearchChange(trimmed);
      lastSubmittedSearchRef.current = trimmed;
    },
    [onSearchChange]
  );

  const scheduleSearchChange = useCallback(
    (value: string) => {
      if (!onSearchChange) return;
      const trimmed = value.trim();
      const minimum = Math.max(0, searchMinChars ?? 0);
      const shouldEmit = trimmed.length === 0 || trimmed.length >= minimum;

      clearSearchTimer();

      if (!shouldEmit) {
        if (trimmed.length === 0 && lastSubmittedSearchRef.current !== "") {
          emitSearchChange("");
        }
        return;
      }

      if (searchDelay > 0) {
        searchTimerRef.current = window.setTimeout(() => {
          emitSearchChange(trimmed);
        }, searchDelay);
      } else {
        emitSearchChange(trimmed);
      }
    },
    [clearSearchTimer, emitSearchChange, onSearchChange, searchDelay, searchMinChars]
  );

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setInternalSearch(value);
      scheduleSearchChange(value);
    },
    [scheduleSearchChange]
  );

  const clearSearch = useCallback(() => {
    setInternalSearch("");
    scheduleSearchChange("");
  }, [scheduleSearchChange]);

  useEffect(() => {
    if (isControlled) {
      const next = searchValue ?? "";
      setInternalSearch(next);
      lastSubmittedSearchRef.current = next.trim();
      clearSearchTimer();
    }
  }, [clearSearchTimer, isControlled, searchValue]);

  useEffect(() => {
    return () => {
      clearSearchTimer();
    };
  }, [clearSearchTimer]);

  const canClearSearch = useMemo(
    () => internalSearch.trim().length > 0,
    [internalSearch]
  );

  return {
    searchInputValue: internalSearch,
    handleSearchInputChange,
    clearSearch,
    canClearSearch,
  };
}

