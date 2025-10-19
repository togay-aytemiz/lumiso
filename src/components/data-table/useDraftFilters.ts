import { useCallback, useMemo, useState } from "react";

interface UseDraftFiltersOptions<T> {
  initialState: T;
  isEqual?: (a: T, b: T) => boolean;
  onApply?: (next: T) => void;
  onReset?: (next: T) => void;
}

interface UseDraftFiltersResult<T> {
  state: T;
  draft: T;
  updateDraft: (updater: Partial<T> | ((prev: T) => T)) => void;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  apply: () => boolean;
  reset: () => boolean;
  dirty: boolean;
}

const shallowEqual = <T,>(a: T, b: T) => a === b;

export function useDraftFilters<T>({
  initialState,
  isEqual = shallowEqual,
  onApply,
  onReset,
}: UseDraftFiltersOptions<T>): UseDraftFiltersResult<T> {
  const [state, setState] = useState<T>(initialState);
  const [draft, setDraft] = useState<T>(initialState);

  const dirty = useMemo(() => !isEqual(state, draft), [draft, isEqual, state]);

  const apply = useCallback(() => {
    if (!dirty) return false;
    setState(draft);
    onApply?.(draft);
    return true;
  }, [dirty, draft, onApply]);

  const reset = useCallback(() => {
    if (isEqual(state, initialState) && isEqual(draft, initialState)) {
      return false;
    }
    setState(initialState);
    setDraft(initialState);
    onReset?.(initialState);
    return true;
  }, [draft, initialState, isEqual, onReset, state]);

  const updateDraft = useCallback(
    (updater: Partial<T> | ((prev: T) => T)) => {
      setDraft((prev) =>
        typeof updater === "function" ? (updater as (prev: T) => T)(prev) : { ...prev, ...updater }
      );
    },
    []
  );

  return {
    state,
    draft,
    updateDraft,
    setDraft,
    apply,
    reset,
    dirty,
  };
}
