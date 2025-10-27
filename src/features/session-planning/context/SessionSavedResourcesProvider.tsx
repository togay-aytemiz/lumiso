import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchSavedLocations,
  fetchSavedNotePresets,
  type SavedLocationRecord,
  type SavedNotePresetRecord,
} from "../api/savedResources";
import { sanitizeNotesInput } from "../utils/sanitizeNotes";

interface ResourceState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
}

interface SessionSavedResourcesContextValue {
  savedLocations: SavedLocationRecord[];
  savedLocationsLoading: boolean;
  savedLocationsError: string | null;
  savedLocationsLoaded: boolean;
  updateSavedLocations: (
    updater: (current: SavedLocationRecord[]) => SavedLocationRecord[]
  ) => void;
  reloadSavedLocations: () => Promise<void>;
  setSavedLocationsError: (error: string | null) => void;
  savedNotes: SavedNotePresetRecord[];
  savedNotesLoading: boolean;
  savedNotesError: string | null;
  savedNotesLoaded: boolean;
  updateSavedNotes: (
    updater: (current: SavedNotePresetRecord[]) => SavedNotePresetRecord[]
  ) => void;
  reloadSavedNotes: () => Promise<void>;
  setSavedNotesError: (error: string | null) => void;
}

const SessionSavedResourcesContext =
  createContext<SessionSavedResourcesContextValue | undefined>(undefined);

const createInitialState = <T,>(): ResourceState<T> => ({
  items: [],
  loading: true,
  error: null,
  hasLoaded: false,
});

export const SessionSavedResourcesProvider = ({ children }: { children: ReactNode }) => {
  const [locationsState, setLocationsState] = useState<ResourceState<SavedLocationRecord>>(
    () => createInitialState<SavedLocationRecord>()
  );
  const [notesState, setNotesState] = useState<ResourceState<SavedNotePresetRecord>>(
    () => createInitialState<SavedNotePresetRecord>()
  );

  const loadLocations = useCallback(async () => {
    setLocationsState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const data = await fetchSavedLocations();
      setLocationsState({
        items: data,
        loading: false,
        error: null,
        hasLoaded: true,
      });
    } catch (error: any) {
      console.error("Failed to load saved locations", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load saved locations. Please try again.";
      setLocationsState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        hasLoaded: true,
      }));
    }
  }, []);

  const loadNotes = useCallback(async () => {
    setNotesState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const data = await fetchSavedNotePresets();
      const sanitized = data.map((preset) => ({
        ...preset,
        body: sanitizeNotesInput(preset.body),
      }));
      setNotesState({
        items: sanitized,
        loading: false,
        error: null,
        hasLoaded: true,
      });
    } catch (error: any) {
      console.error("Failed to load saved note presets", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load saved notes. Please try again.";
      setNotesState((prev) => ({
        ...prev,
        loading: false,
        error: message,
        hasLoaded: true,
      }));
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadLocations(), loadNotes()]);
  }, [loadLocations, loadNotes]);

  const updateSavedLocations = useCallback(
    (updater: (current: SavedLocationRecord[]) => SavedLocationRecord[]) => {
      setLocationsState((prev) => ({
        ...prev,
        items: updater(prev.items),
      }));
    },
    []
  );

  const updateSavedNotes = useCallback(
    (updater: (current: SavedNotePresetRecord[]) => SavedNotePresetRecord[]) => {
      setNotesState((prev) => ({
        ...prev,
        items: updater(prev.items).map((preset) => ({
          ...preset,
          body: sanitizeNotesInput(preset.body),
        })),
      }));
    },
    []
  );

  const setSavedLocationsError = useCallback((error: string | null) => {
    setLocationsState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  const setSavedNotesError = useCallback((error: string | null) => {
    setNotesState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  const value = useMemo<SessionSavedResourcesContextValue>(() => ({
    savedLocations: locationsState.items,
    savedLocationsLoading: locationsState.loading,
    savedLocationsError: locationsState.error,
    savedLocationsLoaded: locationsState.hasLoaded,
    updateSavedLocations,
    reloadSavedLocations: loadLocations,
    setSavedLocationsError,
    savedNotes: notesState.items,
    savedNotesLoading: notesState.loading,
    savedNotesError: notesState.error,
    savedNotesLoaded: notesState.hasLoaded,
    updateSavedNotes,
    reloadSavedNotes: loadNotes,
    setSavedNotesError,
  }), [
    locationsState.items,
    locationsState.loading,
    locationsState.error,
    locationsState.hasLoaded,
    updateSavedLocations,
    loadLocations,
    setSavedLocationsError,
    notesState.items,
    notesState.loading,
    notesState.error,
    notesState.hasLoaded,
    updateSavedNotes,
    loadNotes,
    setSavedNotesError,
  ]);

  return (
    <SessionSavedResourcesContext.Provider value={value}>
      {children}
    </SessionSavedResourcesContext.Provider>
  );
};

export const useSessionSavedResources = () => {
  const context = useContext(SessionSavedResourcesContext);
  if (!context) {
    throw new Error(
      "useSessionSavedResources must be used within a SessionSavedResourcesProvider"
    );
  }
  return context;
};
