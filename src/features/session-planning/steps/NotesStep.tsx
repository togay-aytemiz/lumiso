import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createSavedNotePreset,
  deleteSavedNotePreset,
  SavedNotePresetRecord,
} from "../api/savedResources";
import { useSessionSavedResources } from "../context/SessionSavedResourcesProvider";
import { sanitizeNotesInput } from "../utils/sanitizeNotes";

export const NotesStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionFields } = useSessionPlanningActions();
  const { t } = useTranslation(["sessionPlanning", "common"]);
  const { toast } = useToast();
  const {
    savedNotes,
    savedNotesLoading,
    savedNotesError,
    savedNotesLoaded,
    updateSavedNotes,
    reloadSavedNotes,
    setSavedNotesError,
  } = useSessionSavedResources();
  const [newPreset, setNewPreset] = useState({
    title: "",
    body: "",
  });
  const [newPresetOpen, setNewPresetOpen] = useState(false);
  const [presetHydrated, setPresetHydrated] = useState(false);

  useEffect(() => {
    if (!state.notes) return;
    const sanitized = sanitizeNotesInput(state.notes);
    if (sanitized !== state.notes) {
      updateSessionFields({ notes: sanitized });
    }
  }, [state.notes, updateSessionFields]);

  useEffect(() => {
    if (!savedNotesLoaded) {
      return;
    }

    if (!presetHydrated) {
      setPresetHydrated(true);
      setNewPresetOpen(savedNotes.length === 0);
      return;
    }

    if (savedNotes.length === 0) {
      setNewPresetOpen(true);
    }
  }, [savedNotesLoaded, savedNotes.length, presetHydrated]);

  const sortedNotes = useMemo(() => {
    return [...savedNotes].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    );
  }, [savedNotes]);

  const handleApplyPreset = (preset: SavedNotePresetRecord) => {
    const existingNotes = state.notes?.trim() ?? "";
    const addition = preset.body.trim();
    const nextNotes = existingNotes
      ? `${existingNotes}\n\n${addition}`
      : addition;
    updateSessionFields({
      notes: sanitizeNotesInput(nextNotes),
    });
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      await deleteSavedNotePreset(presetId);
      updateSavedNotes((current) =>
        current.filter((preset) => preset.id !== presetId)
      );
      toast({
        title: t("steps.notes.toastDeletedTitle"),
        description: t("steps.notes.toastDeletedDescription"),
      });
    } catch (error: unknown) {
      console.error("Failed to delete note preset", error);
      const message =
        error instanceof Error ? error.message : null;
      toast({
        title: t("steps.notes.toastErrorTitle"),
        description: message ?? t("steps.notes.toastErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const canSavePreset =
    newPreset.title.trim().length > 0 && newPreset.body.trim().length > 0;

  const handleSavePreset = async () => {
    if (!canSavePreset) return;
    try {
      const sanitizedTitle = sanitizeNotesInput(newPreset.title).trim();
      const sanitizedBody = sanitizeNotesInput(newPreset.body).trim();
      const preset = await createSavedNotePreset({
        title: sanitizedTitle,
        body: sanitizedBody,
      });
      updateSavedNotes((current) => [preset, ...current]);
      setSavedNotesError(null);
      setNewPreset({ title: "", body: "" });
      setNewPresetOpen(false);
      toast({
        title: t("steps.notes.toastSavedTitle"),
        description: t("steps.notes.toastSavedDescription"),
      });
    } catch (error: unknown) {
      console.error("Failed to save note preset", error);
      const message =
        error instanceof Error ? error.message : null;
      toast({
        title: t("steps.notes.toastErrorTitle"),
        description: message ?? t("steps.notes.toastErrorDescription"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("steps.notes.navigationLabel")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.notes.description")}
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {t("steps.notes.clientFacingHelper")}
        </div>
      </div>

      {savedNotesLoading && savedNotes.length === 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-28 rounded-full" />
            ))}
          </div>
        </div>
      ) : savedNotesError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-center justify-between gap-3">
            <span>{savedNotesError}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setSavedNotesError(null);
                void reloadSavedNotes();
              }}
            >
              {t("common:tryAgain")}
            </Button>
          </div>
        </div>
      ) : sortedNotes.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps.notes.savedHeading")}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("steps.notes.quickInsertHint")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedNotes.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center overflow-hidden rounded-full border border-slate-200 bg-white pl-2 shadow-sm"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-semibold text-slate-700 hover:bg-primary/10 hover:text-primary"
                  onClick={() => handleApplyPreset(preset)}
                >
                  {preset.title}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 border-l border-slate-200 px-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDeletePreset(preset.id)}
                  aria-label={t("steps.notes.deletePreset")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : savedNotesLoaded ? (
        <p className="text-xs text-muted-foreground">
          {t("steps.notes.noPresets")}
        </p>
      ) : null}

      {sortedNotes.length > 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setNewPresetOpen((prev) => !prev)}
        >
          {newPresetOpen
            ? t("steps.notes.hidePresetForm")
            : t("steps.notes.addPresetButton")}
        </Button>
      ) : null}

      <Collapsible open={newPresetOpen || sortedNotes.length === 0}>
        <CollapsibleContent className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t("steps.notes.addPresetHeading")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("steps.notes.addPresetDescription")}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="grid gap-2">
              <Label
                htmlFor="new-note-title"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("steps.notes.newPresetTitle")}
              </Label>
              <Input
                id="new-note-title"
                value={newPreset.title}
                placeholder={t("steps.notes.newPresetTitlePlaceholder")}
                onChange={(event) =>
                  setNewPreset((prev) => ({
                    ...prev,
                    title: sanitizeNotesInput(event.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="new-note-body"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("steps.notes.newPresetBody")}
              </Label>
              <Textarea
                id="new-note-body"
                rows={3}
                className="resize-none"
                placeholder={t("steps.notes.newPresetBodyPlaceholder")}
                value={newPreset.body}
                onChange={(event) =>
                  setNewPreset((prev) => ({
                    ...prev,
                    body: sanitizeNotesInput(event.target.value),
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                onClick={handleSavePreset}
                disabled={!canSavePreset}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("steps.notes.savePreset")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("steps.notes.savePresetHint")}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <div className="rounded-lg border border-border/70 bg-muted/40 p-4 shadow-sm">
        <Label
          htmlFor="session-notes"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("steps.notes.notesLabel")}
        </Label>
        <Textarea
          id="session-notes"
          rows={6}
          className="mt-2"
          value={state.notes ?? ""}
          placeholder={t("steps.notes.notesPlaceholder")}
          onChange={(event) =>
            updateSessionFields({
              notes: sanitizeNotesInput(event.target.value),
            })
          }
        />
      </div>
    </div>
  );
};
