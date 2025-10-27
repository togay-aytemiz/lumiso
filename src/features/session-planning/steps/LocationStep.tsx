import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  createSavedLocation,
  deleteSavedLocation,
  SavedLocationRecord,
  updateSavedLocation,
} from "../api/savedResources";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionSavedResources } from "../context/SessionSavedResourcesProvider";

type LocationFormMode =
  | { type: "create" }
  | { type: "edit"; id: string }
  | { type: "hidden" };

export const LocationStep = () => {
  const { state } = useSessionPlanningContext();
  const { updateSessionFields } = useSessionPlanningActions();
  const { t } = useTranslation(["sessionPlanning", "common"]);
  const { toast } = useToast();
  const {
    savedLocations,
    savedLocationsLoading,
    savedLocationsError,
    savedLocationsLoaded,
    updateSavedLocations,
    reloadSavedLocations,
    setSavedLocationsError,
  } = useSessionSavedResources();

  const [formMode, setFormMode] = useState<LocationFormMode>({
    type: "hidden",
  });
  const [formValues, setFormValues] = useState({
    label: "",
    address: "",
    meetingUrl: "",
  });

  const [customOpen, setCustomOpen] = useState(false);

  const selectedLocationId = state.locationId;

  const initialHydrationRef = useRef(false);
  const customToggleRef = useRef(false);

  useEffect(() => {
    if (!savedLocationsLoaded) {
      return;
    }

    if (savedLocations.length === 0) {
      customToggleRef.current = false;
      setFormMode((prev) =>
        prev.type === "edit" ? prev : { type: "create" }
      );
      setCustomOpen(true);
      return;
    }

    if (!initialHydrationRef.current) {
      initialHydrationRef.current = true;
      setFormMode({ type: "hidden" });
      setCustomOpen(false);
    }
  }, [savedLocationsLoaded, savedLocations.length]);

  useEffect(() => {
    if (!savedLocationsLoaded) return;
    if (!state.locationId) {
      const hasCustomDraft =
        (state.location && state.location.trim().length > 0) ||
        (state.meetingUrl && state.meetingUrl.trim().length > 0);
      if (hasCustomDraft && !customToggleRef.current) {
        setCustomOpen(true);
      }
    }
  }, [
    savedLocationsLoaded,
    state.locationId,
    state.location,
    state.meetingUrl,
  ]);

  const handleToggleCustom = () => {
    setCustomOpen((prev) => {
      const next = !prev;
      customToggleRef.current = true;
      if (!prev) {
        updateSessionFields({
          locationId: undefined,
          locationLabel: undefined,
        });
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormValues({ label: "", address: "", meetingUrl: "" });
    setFormMode({ type: "hidden" });
  };

  const handleSelectLocation = (location: SavedLocationRecord) => {
    updateSessionFields({
      locationId: location.id,
      locationLabel: location.label,
      location: location.address,
      meetingUrl: location.meetingUrl ?? "",
    });
  };

  const handleStartCreate = () => {
    setFormValues({ label: "", address: "", meetingUrl: "" });
    setFormMode({ type: "create" });
  };

  const handleStartEdit = (location: SavedLocationRecord) => {
    setFormValues({
      label: location.label,
      address: location.address,
      meetingUrl: location.meetingUrl ?? "",
    });
    setFormMode({ type: "edit", id: location.id });
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteSavedLocation(id);
      updateSavedLocations((current) =>
        current.filter((item) => item.id !== id)
      );
      if (state.locationId === id) {
        updateSessionFields({
          locationId: undefined,
          locationLabel: undefined,
        });
      }
      toast({
        title: t("steps.location.toastDeletedTitle"),
        description: t("steps.location.toastDeletedDescription"),
      });
    } catch (error: any) {
      console.error("Failed to delete location", error);
      toast({
        title: t("steps.location.toastErrorTitle"),
        description: error?.message ?? t("steps.location.toastErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleSubmitLocation = async () => {
    const payload = {
      label: formValues.label.trim(),
      address: formValues.address.trim(),
      meetingUrl: formValues.meetingUrl.trim(),
    };

    if (!payload.label || !payload.address) {
      toast({
        title: t("steps.location.toastValidationTitle"),
        description: t("steps.location.toastValidationDescription"),
        variant: "destructive",
      });
      return;
    }

    try {
      let location: SavedLocationRecord;
      if (formMode.type === "edit") {
        location = await updateSavedLocation(formMode.id, payload);
        updateSavedLocations((current) =>
          current.map((item) => (item.id === location.id ? location : item))
        );
      } else {
        location = await createSavedLocation(payload);
        updateSavedLocations((current) => {
          const without = current.filter((item) => item.id !== location.id);
          return [location, ...without];
        });
      }
      setSavedLocationsError(null);
      handleSelectLocation(location);
      resetForm();
      toast({
        title:
          formMode.type === "edit"
            ? t("steps.location.toastUpdatedTitle")
            : t("steps.location.toastSavedTitle"),
        description:
          formMode.type === "edit"
            ? t("steps.location.toastUpdatedDescription")
            : t("steps.location.toastSavedDescription"),
      });
    } catch (error: any) {
      console.error("Failed to save location", error);
      toast({
        title: t("steps.location.toastErrorTitle"),
        description: error?.message ?? t("steps.location.toastErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const sortedLocations = useMemo(() => {
    return [...savedLocations].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    );
  }, [savedLocations]);

  const renderSavedLocations = () => {
    if (savedLocationsLoading && savedLocations.length === 0) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (savedLocationsError) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-center justify-between gap-3">
            <span>{savedLocationsError}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setSavedLocationsError(null);
                void reloadSavedLocations();
              }}
            >
              {t("common:tryAgain")}
            </Button>
          </div>
        </div>
      );
    }

    if (sortedLocations.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-muted-foreground">
          {t("steps.location.emptyState")}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sortedLocations.map((location) => {
          const isActive = selectedLocationId === location.id;
          return (
            <div
              key={location.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition",
                isActive
                  ? "border-primary/60 bg-primary/10 shadow"
                  : "border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5"
              )}
            >
              <button
                type="button"
                onClick={() => handleSelectLocation(location)}
                className="flex flex-1 flex-col items-start text-left"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MapPin className="h-4 w-4 text-primary" />
                  {location.label}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {location.address}
                </span>
                {location.meetingUrl ? (
                  <span className="mt-1 text-xs font-medium text-primary">
                    {location.meetingUrl}
                  </span>
                ) : null}
              </button>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => handleStartEdit(location)}
                  aria-label={t("steps.location.editLocation")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDeleteLocation(location.id)}
                  aria-label={t("steps.location.deleteLocation")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderForm = () => (
    <Collapsible open={formMode.type !== "hidden"}>
      <CollapsibleContent className="mt-4 space-y-4 rounded-2xl border border-dashed border-slate-300 bg-white/90 p-5 data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {formMode.type === "edit"
                ? t("steps.location.editHeading")
                : t("steps.location.addNewHeading")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formMode.type === "edit"
                ? t("steps.location.editDescription")
                : t("steps.location.addNewDescription")}
            </p>
          </div>
          {formMode.type !== "hidden" && savedLocations.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="h-7 px-3 text-xs text-muted-foreground hover:text-primary"
            >
              {t("steps.location.cancel")}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label
              htmlFor="location-form-label"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("steps.location.newLabel")}
            </Label>
            <Input
              id="location-form-label"
              placeholder={t("steps.location.newLabelPlaceholder")}
              value={formValues.label}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  label: event.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="location-form-address"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("steps.location.newAddress")}
            </Label>
            <Textarea
              id="location-form-address"
              rows={3}
              className="resize-none"
              placeholder={t("steps.location.newAddressPlaceholder")}
              value={formValues.address}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="location-form-meeting-url"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("steps.location.newMeetingUrl")}
            </Label>
            <Input
              id="location-form-meeting-url"
              placeholder={t("steps.location.meetingUrlPlaceholder")}
              value={formValues.meetingUrl}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  meetingUrl: event.target.value,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              className="gap-2"
              onClick={handleSubmitLocation}
            >
              <Plus className="h-4 w-4" />
              {formMode.type === "edit"
                ? t("steps.location.updateLocation")
                : t("steps.location.saveLocation")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("steps.location.quickApplyHint")}
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  const renderCustomForm = (alwaysOpen: boolean) => (
    <Collapsible
      open={alwaysOpen ? true : customOpen}
      onOpenChange={setCustomOpen}
    >
      <CollapsibleContent className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.location.customHeading")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("steps.location.customDescription")}
            </p>
          </div>
          {!alwaysOpen ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-muted-foreground hover:text-primary"
              onClick={handleToggleCustom}
            >
              {t("steps.location.closeCustom")}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label
              htmlFor="custom-location-address"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("steps.location.addressLabel")}
            </Label>
            <Textarea
              id="custom-location-address"
              rows={3}
              className="resize-none"
              placeholder={t("steps.location.addressPlaceholder")}
              value={state.location ?? ""}
              onChange={(event) =>
                updateSessionFields({
                  locationId: undefined,
                  locationLabel: undefined,
                  location: event.target.value,
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="custom-location-url"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {t("steps.location.meetingUrlLabel")}
            </Label>
            <Input
              id="custom-location-url"
              placeholder={t("steps.location.meetingUrlPlaceholder")}
              value={state.meetingUrl ?? ""}
              onChange={(event) =>
                updateSessionFields({
                  locationId: undefined,
                  locationLabel: undefined,
                  meetingUrl: event.target.value,
                })
              }
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("steps.location.navigationLabel")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.location.description")}
        </p>
      </div>

      {renderSavedLocations()}

      {savedLocations.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-11 gap-2"
            onClick={
              formMode.type === "hidden" ? handleStartCreate : resetForm
            }
          >
            <Plus className="h-4 w-4" />
            {formMode.type === "hidden"
              ? t("steps.location.addButton")
              : t("steps.location.cancel")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-4 text-sm font-medium text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600"
            onClick={handleToggleCustom}
          >
            {customOpen
              ? t("steps.location.closeCustom")
              : t("steps.location.customButton")}
          </Button>
        </div>
      ) : null}

      {renderForm()}

      {savedLocations.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("steps.location.noSavedReminder")}
        </p>
      ) : null}

      {renderCustomForm(savedLocations.length === 0)}
    </div>
  );
};
