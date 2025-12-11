import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TemplateBuilderHeader } from "@/components/template-builder/TemplateBuilderHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, getUserLocale } from "@/lib/utils";
import { CalendarRange, ImageIcon, ImageUp, Loader2, Plus, Share2, Upload } from "lucide-react";

type GalleryType = "proof" | "retouch" | "final" | "other";
type GalleryStatus = "draft" | "published" | "archived";

interface GalleryDetailRow {
  id: string;
  title: string;
  type: GalleryType;
  status: GalleryStatus;
  branding: Record<string, unknown> | null;
  session_id: string | null;
  updated_at: string;
  created_at: string;
  published_at: string | null;
}

interface GallerySetRow {
  id: string;
  name: string;
  description: string | null;
  order_index: number | null;
}

interface UpdatePayload {
  title: string;
  type: GalleryType;
  status: GalleryStatus;
  branding: Record<string, unknown>;
  publishedAt?: string | null;
}

const AUTO_SAVE_DELAY = 1200;

const formatDateForDisplay = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(getUserLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const formatTimestamp = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(getUserLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

export default function GalleryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("pages");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"photos" | "settings">("photos");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GalleryType>("proof");
  const [status, setStatus] = useState<GalleryStatus>("draft");
  const [customType, setCustomType] = useState("");
  const [eventDate, setEventDate] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSetSheetOpen, setIsSetSheetOpen] = useState(false);
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [baseline, setBaseline] = useState({
    title: "",
    type: "proof" as GalleryType,
    status: "draft" as GalleryStatus,
    eventDate: "",
    customType: "",
  });
  const autoSaveTimerRef = useRef<number | null>(null);
  const attemptedDefaultSetRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["gallery", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<GalleryDetailRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("galleries")
        .select("id,title,type,status,branding,session_id,updated_at,created_at,published_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as GalleryDetailRow;
    },
  });

  useEffect(() => {
    if (!data) return;
    const branding = (data.branding || {}) as Record<string, unknown>;
    const storedDate = typeof branding.eventDate === "string" ? branding.eventDate : "";
    const storedCustomType = typeof branding.customType === "string" ? (branding.customType as string) : "";
    setTitle(data.title ?? "");
    setType(data.type);
    setStatus(data.status);
    setEventDate(storedDate);
    setCustomType(storedCustomType);
    setLastSavedAt(data.updated_at || data.created_at || null);
    setBaseline({
      title: data.title ?? "",
      type: data.type,
      status: data.status,
      eventDate: storedDate,
      customType: storedCustomType,
    });
  }, [data]);

  const { data: sets } = useQuery({
    queryKey: ["gallery_sets", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<GallerySetRow[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("gallery_sets")
        .select("id,name,description,order_index")
        .eq("gallery_id", id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const defaultSetName = t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Highlights" });

  useEffect(() => {
    if (!id) return;
    if (!sets || sets.length > 0) return;
    if (attemptedDefaultSetRef.current) return;
    attemptedDefaultSetRef.current = true;

    const createDefaultSet = async () => {
      const { error } = await supabase.from("gallery_sets").insert({
        gallery_id: id,
        name: defaultSetName,
        description: null,
        order_index: 1,
      });
      if (error) {
        attemptedDefaultSetRef.current = false;
        toast({
          title: t("sessionDetail.gallery.toast.errorTitle"),
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["gallery_sets", id] });
    };

    void createDefaultSet();
  }, [id, sets, defaultSetName, toast, queryClient]);

  const resolvedSets = useMemo(() => {
    if (sets && sets.length > 0) return sets;
    return [
      {
        id: "default-placeholder",
        name: defaultSetName,
        description: t("sessionDetail.gallery.sets.empty"),
        order_index: 1,
      },
    ];
  }, [sets, defaultSetName, t]);

  const typeOptions = useMemo(() => {
    const options = [
      { value: "proof", label: t("sessionDetail.gallery.types.proof") },
      { value: "final", label: t("sessionDetail.gallery.types.final") },
      { value: "other", label: t("sessionDetail.gallery.types.other") },
    ];
    if (data?.type === "retouch" || type === "retouch") {
      options.splice(1, 0, { value: "retouch", label: t("sessionDetail.gallery.types.retouch") });
    }
    return options;
  }, [t, data?.type, type]);

  const statusOptions = useMemo(
    () => [
      { value: "draft", label: t("sessionDetail.gallery.statuses.draft") },
      { value: "published", label: t("sessionDetail.gallery.statuses.published") },
      { value: "archived", label: t("sessionDetail.gallery.statuses.archived") },
    ],
    [t]
  );

  const typeLabel = useMemo(() => {
    if (type === "other") {
      return customType.trim() || t("sessionDetail.gallery.types.other", { defaultValue: "Custom type" });
    }
    const found = typeOptions.find((option) => option.value === type);
    return found?.label ?? type;
  }, [type, customType, typeOptions, t]);

  const formattedEventDate = useMemo(() => formatDateForDisplay(eventDate), [eventDate]);
  const eventLabel =
    formattedEventDate || t("sessionDetail.gallery.labels.eventDateUnset", { defaultValue: "Event date not set" });
  const displayTitle = title.trim() || t("sessionDetail.gallery.form.titlePlaceholder", { defaultValue: "Untitled gallery" });

  const draftLabel =
    statusOptions.find((option) => option.value === "draft")?.label ??
    t("sessionDetail.gallery.statuses.draft", { defaultValue: "Draft" });
  const publishedOrArchivedLabel =
    status === "archived"
      ? statusOptions.find((option) => option.value === "archived")?.label ??
        t("sessionDetail.gallery.statuses.archived", { defaultValue: "Archived" })
      : statusOptions.find((option) => option.value === "published")?.label ??
        t("sessionDetail.gallery.statuses.published", { defaultValue: "Published" });

  const hasUnsavedChanges = useMemo(
    () =>
      title.trim() !== baseline.title.trim() ||
      type !== baseline.type ||
      status !== baseline.status ||
      eventDate !== baseline.eventDate ||
      customType.trim() !== baseline.customType.trim(),
    [
      title,
      baseline.title,
      type,
      baseline.type,
      status,
      baseline.status,
      eventDate,
      baseline.eventDate,
      customType,
      baseline.customType,
    ]
  );

  const canAutoSave = useMemo(() => {
    if (!title.trim()) return false;
    if (type === "other" && !customType.trim()) return false;
    return hasUnsavedChanges;
  }, [title, type, customType, hasUnsavedChanges]);

  const updateMutation = useMutation<unknown, unknown, UpdatePayload>({
    mutationFn: async (payload) => {
      if (!id) return;
      const updateBody: Partial<GalleryDetailRow> & { branding: Record<string, unknown> } = {
        title: payload.title,
        type: payload.type,
        status: payload.status,
        branding: payload.branding,
      };
      if (payload.publishedAt) {
        updateBody.published_at = payload.publishedAt;
      }
      const { error } = await supabase.from("galleries").update(updateBody).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, payload) => {
      setBaseline({
        title: payload.title,
        type: payload.type,
        status: payload.status,
        eventDate: typeof payload.branding.eventDate === "string" ? (payload.branding.eventDate as string) : "",
        customType: typeof payload.branding.customType === "string" ? (payload.branding.customType as string) : "",
      });
      setLastSavedAt(new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ["gallery", id] });
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      if (data?.session_id) {
        queryClient.invalidateQueries({ queryKey: ["galleries", data.session_id] });
      }
    },
    onError: (error) => {
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const isSaving = updateMutation.isPending;
  const saveGallery = updateMutation.mutate;

  const formattedLastSaved = useMemo(() => formatTimestamp(lastSavedAt), [lastSavedAt]);

  const autoSaveLabel = useMemo(() => {
    if (isSaving) {
      return t("sessionDetail.gallery.form.saving", { defaultValue: "Saving..." });
    }
    if (!title.trim()) {
      return t("sessionDetail.gallery.form.errors.titleRequired", { defaultValue: "Title is required" });
    }
    if (type === "other" && !customType.trim()) {
      return t("sessionDetail.gallery.form.errors.customTypeRequired", { defaultValue: "Custom type required" });
    }
    if (hasUnsavedChanges) {
      return t("templateBuilder.status.unsavedChanges", { defaultValue: "Unsaved changes" });
    }
    if (formattedLastSaved) {
      return t("sessionDetail.gallery.form.savedAt", {
        defaultValue: `Saved ${formattedLastSaved}`,
        date: formattedLastSaved,
      });
    }
    return t("templateBuilder.status.notSavedYet", { defaultValue: "Not saved yet" });
  }, [isSaving, title, type, customType, hasUnsavedChanges, formattedLastSaved, t]);

  useEffect(() => {
    if (!data) return;
    if (!canAutoSave) return;
    if (isSaving) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      const branding: Record<string, unknown> = {};
      if (eventDate) branding.eventDate = eventDate;
      if (type === "other" && customType.trim()) {
        branding.customType = customType.trim();
      }
      const payload: UpdatePayload = {
        title: title.trim(),
        type,
        status,
        branding,
        publishedAt: status === "published" ? data.published_at ?? new Date().toISOString() : data?.published_at ?? null,
      };
      saveGallery(payload);
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    data,
    canAutoSave,
    title,
    type,
    status,
    eventDate,
    customType,
    saveGallery,
    isSaving,
  ]);

  const createSetMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (!setName.trim()) {
        throw new Error(t("sessionDetail.gallery.sets.errors.nameRequired", { defaultValue: "Name required" }));
      }
      const nextOrder = (sets?.length ?? 0) + 1;
      const { error } = await supabase.from("gallery_sets").insert({
        gallery_id: id,
        name: setName.trim(),
        description: setDescription.trim() || null,
        order_index: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setIsSetSheetOpen(false);
      setSetName("");
      setSetDescription("");
      queryClient.invalidateQueries({ queryKey: ["gallery_sets", id] });
      toast({
        title: t("sessionDetail.gallery.sets.toast.createdTitle", { defaultValue: "Set created" }),
        description: t("sessionDetail.gallery.sets.toast.createdDesc", {
          defaultValue: "You can upload into this set.",
        }),
      });
    },
    onError: (error) => {
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const backLabel = t("sessionDetail.gallery.actions.back", { defaultValue: "Back" });

  const handleBack = useCallback(() => {
    if (data?.session_id) {
      navigate(`/sessions/${data.session_id}`);
    } else {
      navigate(-1);
    }
  }, [data?.session_id, navigate]);

  const handleShare = useCallback(() => {
    toast({
      title: t("sessionDetail.gallery.actions.share"),
      description: t("sessionDetail.gallery.labels.shareSoon", { defaultValue: "Share link coming soon" }),
    });
  }, [t, toast]);

  const handlePreview = useCallback(() => {
    toast({
      title: t("featurePreview.preview", { defaultValue: "Preview" }),
      description: t("featurePreview.noPreview", { defaultValue: "Preview is coming soon for galleries." }),
    });
  }, [t, toast]);

  const scrollToSet = useCallback((setId: string) => {
    if (typeof window === "undefined") return;
    const target = document.getElementById(`set-${setId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleAddMedia = useCallback(
    (setName?: string) => {
      toast({
        title: t("sessionDetail.gallery.labels.addMedia"),
        description:
          t("sessionDetail.gallery.labels.uploadDesc", {
            defaultValue: "Drag & drop photos here to add to this gallery.",
          }) + (setName ? ` (${setName})` : ""),
      });
    },
    [toast, t]
  );

  if (isLoading) {
    return (
      <div className="space-y-6 px-6 py-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
        <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[520px] w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("sessionDetail.gallery.toast.errorDesc", { defaultValue: "Gallery could not be loaded." })}
      </div>
    );
  }

  return (
    <>
      <TemplateBuilderHeader
        name={displayTitle}
        onNameChange={(value) => setTitle(value)}
        statusLabel={autoSaveLabel}
        isDraft={status === "draft"}
        draftLabel={draftLabel}
        publishedLabel={publishedOrArchivedLabel}
        backLabel={backLabel}
        publishLabel={t("featurePreview.preview", { defaultValue: "Preview" })}
        doneLabel={t("featurePreview.preview", { defaultValue: "Preview" })}
        onBack={handleBack}
        onPrimaryAction={handlePreview}
        rightActions={
          <Button
            onClick={handleShare}
            variant="surface"
            size="sm"
            className="btn-surface-accent gap-2"
          >
            <Share2 className="h-4 w-4" />
            {t("sessionDetail.gallery.actions.share")}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {typeLabel}
            </span>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span>{eventLabel}</span>
            </div>
          </div>
        </div>
      </TemplateBuilderHeader>

      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 shadow-sm">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "photos" | "settings")}>
              <div className="flex items-center justify-between gap-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="photos" className="text-sm">
                    {t("sessionDetail.gallery.labels.media", { defaultValue: "Photos" })}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="text-sm">
                    {t("sessionDetail.gallery.labels.settings")}
                  </TabsTrigger>
                </TabsList>
                <Button
                  size="sm"
                  variant="surface"
                  className="btn-surface-accent gap-2"
                  onClick={() => setIsSetSheetOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  {t("sessionDetail.gallery.sets.add")}
                </Button>
              </div>

              <TabsContent value="photos" className="mt-4 space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/10">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {t("sessionDetail.gallery.labels.media")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("sessionDetail.gallery.labels.uploadDesc", {
                          defaultValue: "Drag & drop photos here to add to this gallery.",
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                      {resolvedSets.length}{" "}
                      {t("sessionDetail.gallery.labels.sets", { defaultValue: "Sets" })}
                    </Badge>
                  </div>
                  <div className="divide-y border-t border-border/60">
                    {resolvedSets.map((set) => (
                      <div
                        key={set.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{set.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {set.description ||
                              t("sessionDetail.gallery.sets.empty", { defaultValue: "Uploads land here." })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs"
                          onClick={() => scrollToSet(set.id)}
                        >
                          <ImageUp className="h-4 w-4" />
                          {t("sessionDetail.gallery.labels.addMedia")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>{t("sessionDetail.gallery.form.titleLabel", { defaultValue: "Gallery name" })}</Label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t("sessionDetail.gallery.form.titlePlaceholder")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("sessionDetail.gallery.form.eventDateLabel")}</Label>
                    <DateTimePicker
                      mode="date"
                      value={eventDate}
                      onChange={(value) => setEventDate(value)}
                      buttonClassName="w-full justify-between"
                      popoverModal
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("sessionDetail.gallery.form.statusLabel")}</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as GalleryStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("sessionDetail.gallery.form.typeLabel")}</Label>
                    <Select
                      value={type}
                      onValueChange={(value) => {
                        setType(value as GalleryType);
                        if (value !== "other") {
                          setCustomType("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={cn("space-y-2 transition-all", type === "other" ? "opacity-100" : "opacity-0")}>
                    <Label htmlFor="gallery-custom-type">
                      {t("sessionDetail.gallery.form.customTypeLabel", { defaultValue: "Custom type" })}
                    </Label>
                    <Input
                      id="gallery-custom-type"
                      value={customType}
                      onChange={(event) => setCustomType(event.target.value)}
                      placeholder={t("sessionDetail.gallery.form.customTypePlaceholder", {
                        defaultValue: "e.g., Album selection",
                      })}
                      disabled={type !== "other"}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  {autoSaveLabel}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-xl border border-border/70 bg-background shadow-sm">
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {t("sessionDetail.gallery.labels.media")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("sessionDetail.gallery.labels.uploadHint")}
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsSetSheetOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("sessionDetail.gallery.sets.add")}
              </Button>
            </div>

            <div className="space-y-4 border-t border-border/70 px-6 py-5">
              {resolvedSets.map((set) => (
                <div
                  key={set.id}
                  id={`set-${set.id}`}
                  className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{set.name}</p>
                        {set.id === "default-placeholder" ? (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase">
                            {t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Default" })}
                          </Badge>
                        ) : null}
                      </div>
                      {set.description ? (
                        <p className="text-xs text-muted-foreground">{set.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("sessionDetail.gallery.sets.empty", { defaultValue: "Uploads land here." })}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleAddMedia(set.name)}>
                      <ImageUp className="h-4 w-4" />
                      {t("sessionDetail.gallery.labels.addMedia")}
                    </Button>
                  </div>

                  <div className="border-t border-dashed border-muted-foreground/30 px-4 py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 bg-background text-muted-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {t("sessionDetail.gallery.labels.uploadTitle")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("sessionDetail.gallery.labels.uploadDesc")}
                    </p>
                    <Button
                      variant="surface"
                      size="sm"
                      className="btn-surface-accent mt-4 gap-2"
                      onClick={() => handleAddMedia(set.name)}
                    >
                      <ImageIcon className="h-4 w-4" />
                      {t("sessionDetail.gallery.labels.addMedia")}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("sessionDetail.gallery.labels.uploadHint")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isSetSheetOpen} onOpenChange={setIsSetSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {t("sessionDetail.gallery.sets.createTitle", { defaultValue: "Create photo set" })}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("sessionDetail.gallery.sets.name")}</Label>
              <Input
                value={setName}
                onChange={(event) => setSetName(event.target.value)}
                placeholder={t("sessionDetail.gallery.sets.namePlaceholder", {
                  defaultValue: "e.g., Ceremony, Reception",
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sessionDetail.gallery.sets.description")}</Label>
              <Textarea
                value={setDescription}
                onChange={(event) => setSetDescription(event.target.value)}
                placeholder={t("sessionDetail.gallery.sets.descriptionPlaceholder", { defaultValue: "Optional" })}
                rows={3}
              />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSetSheetOpen(false)} disabled={createSetMutation.isPending}>
              {t("sessionDetail.gallery.form.cancel")}
            </Button>
            <Button
              onClick={() => createSetMutation.mutate()}
              disabled={createSetMutation.isPending || !setName.trim()}
            >
              {createSetMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("sessionDetail.gallery.form.saving")}
                </div>
              ) : (
                t("sessionDetail.gallery.form.submit")
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
