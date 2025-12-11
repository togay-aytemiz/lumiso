import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TemplateBuilderHeader } from "@/components/template-builder/TemplateBuilderHeader";
import { EmptyStateInfoSheet } from "@/components/empty-states/EmptyStateInfoSheet";
import { SelectionDashboard, FAVORITES_FILTER_ID, type SelectionRule } from "@/components/galleries/SelectionDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, getUserLocale } from "@/lib/utils";
import { CalendarRange, Edit3, GripVertical, ImageIcon, ImageUp, Loader2, Plus, Share2, Trash2, Upload } from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

type GalleryType = "proof" | "retouch" | "final" | "other";
type GalleryStatus = "draft" | "published" | "archived";

type SelectionSettings = {
  enabled: boolean;
  limit: number | null;
  deadline: string | null;
  allowFavorites: boolean;
};

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

interface ClientSelectionRow {
  id: string;
  selection_part: string | null;
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

const normalizeSelectionPartKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const parseCountValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export default function GalleryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("pages");
  const { t: tForms } = useTranslation("forms");
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
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [selectionSheetOpen, setSelectionSheetOpen] = useState(false);
  const [selectionSettings, setSelectionSettings] = useState<SelectionSettings>({
    enabled: false,
    limit: null,
    deadline: null,
    allowFavorites: true,
  });
  const [selectionDraft, setSelectionDraft] = useState<SelectionSettings>({
    enabled: false,
    limit: null,
    deadline: null,
    allowFavorites: true,
  });
  const [activeSelectionRuleId, setActiveSelectionRuleId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSetNameRef = useRef<string | null>(null);
  const [orderedSets, setOrderedSets] = useState<GallerySetRow[]>([]);
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [isSetInfoSheetOpen, setIsSetInfoSheetOpen] = useState(false);
  const [baseline, setBaseline] = useState({
    title: "",
    type: "proof" as GalleryType,
    status: "draft" as GalleryStatus,
    eventDate: "",
    customType: "",
    selectionSettings: {
      enabled: false,
      limit: null,
      deadline: null,
      allowFavorites: true,
    } as SelectionSettings,
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
    const storedSelection = (branding.selectionSettings || {}) as Partial<SelectionSettings>;
    const storedDate = typeof branding.eventDate === "string" ? branding.eventDate : "";
    const storedCustomType = typeof branding.customType === "string" ? (branding.customType as string) : "";
    setTitle(data.title ?? "");
    setType(data.type);
    setStatus(data.status);
    setEventDate(storedDate);
    setCustomType(storedCustomType);
    setSelectionSettings({
      enabled: Boolean(storedSelection.enabled),
      limit: typeof storedSelection.limit === "number" ? storedSelection.limit : null,
      deadline: typeof storedSelection.deadline === "string" ? storedSelection.deadline : null,
      allowFavorites: storedSelection.allowFavorites !== false,
    });
    setLastSavedAt(data.updated_at || data.created_at || null);
    setBaseline({
      title: data.title ?? "",
      type: data.type,
      status: data.status,
      eventDate: storedDate,
      customType: storedCustomType,
      selectionSettings: {
        enabled: Boolean(storedSelection.enabled),
        limit: typeof storedSelection.limit === "number" ? storedSelection.limit : null,
        deadline: typeof storedSelection.deadline === "string" ? storedSelection.deadline : null,
        allowFavorites: storedSelection.allowFavorites !== false,
      },
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

  const { data: clientSelections } = useQuery({
    queryKey: ["client_selections", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ClientSelectionRow[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("client_selections")
        .select("id,selection_part")
        .eq("gallery_id", id);
      if (error) throw error;
      return (data as ClientSelectionRow[]) ?? [];
    },
  });

  const defaultSetName = t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Highlights" });
  const setInfoSectionsRaw = t("sessionDetail.gallery.sets.info.sections", {
    returnObjects: true,
    defaultValue: [],
  });
  const setInfoSections = Array.isArray(setInfoSectionsRaw)
    ? (setInfoSectionsRaw as { title: string; description: string }[])
    : [];
  const setInfoTitle = t("sessionDetail.gallery.sets.info.title", {
    defaultValue: "Keep galleries easy to skim with sets",
  });
  const setInfoDescription = t("sessionDetail.gallery.sets.info.description", {
    defaultValue: "Break big uploads into labeled sections so clients know where to start.",
  });
  const setInfoLearnMoreLabel = t("sessionDetail.gallery.sets.learnMore", {
    defaultValue: "Set nasıl çalışır?",
  });

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

  useEffect(() => {
    if (!sets || sets.length === 0) {
      setOrderedSets([]);
      setActiveSetId(null);
      return;
    }
    setOrderedSets(sets);
  }, [sets]);
  const visibleSets = orderedSets.length > 0 ? orderedSets : resolvedSets;
  const activeSet = useMemo(() => {
    if (!activeSetId) return visibleSets[0];
    return visibleSets.find((set) => set.id === activeSetId) ?? visibleSets[0];
  }, [activeSetId, visibleSets]);

  useEffect(() => {
    if (selectionSheetOpen) {
      setSelectionDraft(selectionSettings);
    }
  }, [selectionSheetOpen, selectionSettings]);

  useEffect(() => {
    setActiveSelectionRuleId(null);
  }, [id]);

  useEffect(() => {
    if (!visibleSets.length) {
      setActiveSetId(null);
      return;
    }
    if (!activeSetId || !visibleSets.find((set) => set.id === activeSetId)) {
      setActiveSetId(visibleSets[0]?.id ?? null);
    }
  }, [visibleSets, activeSetId]);

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
  const brandingData = (data?.branding || {}) as Record<string, unknown>;
  const coverUrl = typeof brandingData.coverUrl === "string" ? brandingData.coverUrl : "";
  const hasMedia = Boolean(brandingData.hasMedia);
  const selectionStats = useMemo(() => {
    const stats = (brandingData.selectionStats || {}) as Record<string, unknown>;
    const selected = typeof stats.selected === "number" ? stats.selected : 0;
    const favorites = typeof stats.favorites === "number" ? stats.favorites : 0;
    const total = typeof stats.total === "number" ? stats.total : 0;
    return { selected, favorites, total };
  }, [brandingData.selectionStats]);

  const selectionPartCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (clientSelections ?? []).forEach((entry) => {
      const key = normalizeSelectionPartKey(entry.selection_part);
      if (!key) return;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [clientSelections]);

  const selectionRules = useMemo<SelectionRule[]>(() => {
    const rules: SelectionRule[] = [];
    const groupsRaw = Array.isArray(brandingData.selectionTemplateGroups)
      ? (brandingData.selectionTemplateGroups as Record<string, unknown>[])
      : [];
    const templateRaw = Array.isArray(brandingData.selectionTemplate)
      ? (brandingData.selectionTemplate as Record<string, unknown>[])
      : [];

    const addRule = (ruleData: Record<string, unknown>, ruleId: string, serviceName: string | null) => {
      const part = typeof ruleData.part === "string" ? ruleData.part.trim() : "";
      const normalizedKey = normalizeSelectionPartKey(part);
      const minCount = Math.max(0, parseCountValue(ruleData.min) ?? 0);
      const rawMax = parseCountValue(ruleData.max);
      const maxCount = rawMax != null ? Math.max(rawMax, minCount) : null;
      const currentCount = normalizedKey ? selectionPartCounts[normalizedKey] ?? 0 : 0;
      const title =
        part ||
        t("sessionDetail.gallery.selectionTemplate.customLabel", {
          defaultValue: "Seçim kuralı",
        });
      rules.push({
        id: ruleId,
        title,
        minCount,
        maxCount,
        currentCount,
        serviceName,
      });
    };

    if (groupsRaw.length > 0) {
      groupsRaw.forEach((group, groupIndex) => {
        const typedGroup = group as Record<string, unknown>;
        const serviceName = typeof typedGroup.serviceName === "string" ? typedGroup.serviceName : null;
        const serviceId = typeof typedGroup.serviceId === "string" ? typedGroup.serviceId : null;
        const rulesRaw = Array.isArray(typedGroup.rules) ? (typedGroup.rules as Record<string, unknown>[]) : [];

        rulesRaw.forEach((rule, ruleIndex) => {
          const ruleData = (rule as Record<string, unknown>) ?? {};
          const part = typeof ruleData.part === "string" ? ruleData.part : "";
          const normalizedKey = normalizeSelectionPartKey(part);
          const ruleId = `${serviceId || `service-${groupIndex}`}-${normalizedKey || ruleIndex}`;
          addRule(ruleData, ruleId, serviceName);
        });
      });
    } else if (templateRaw.length > 0) {
      templateRaw.forEach((rule, ruleIndex) => {
        const ruleData = (rule as Record<string, unknown>) ?? {};
        const part = typeof ruleData.part === "string" ? ruleData.part : "";
        const normalizedKey = normalizeSelectionPartKey(part);
        const ruleId = `rule-${ruleIndex}-${normalizedKey || ruleIndex}`;
        addRule(ruleData, ruleId, null);
      });
    }

    return rules;
  }, [brandingData.selectionTemplateGroups, brandingData.selectionTemplate, selectionPartCounts, t]);

  const totalSelectedCount = useMemo(() => {
    if (selectionStats.selected > 0) return selectionStats.selected;
    if (clientSelections && clientSelections.length > 0) return clientSelections.length;
    return selectionRules.reduce((sum, rule) => sum + rule.currentCount, 0);
  }, [selectionStats.selected, clientSelections, selectionRules]);

  const favoritesCount = useMemo(() => {
    if (selectionStats.favorites > 0) return selectionStats.favorites;
    const favoriteKey = normalizeSelectionPartKey(FAVORITES_FILTER_ID);
    return selectionPartCounts[favoriteKey] ?? 0;
  }, [selectionStats.favorites, selectionPartCounts]);

  const totalPhotosCount = useMemo(
    () => Math.max(selectionStats.total || 0, totalSelectedCount, favoritesCount),
    [selectionStats.total, totalSelectedCount, favoritesCount]
  );

  const activeSelectionLabel = useMemo(() => {
    if (activeSelectionRuleId === FAVORITES_FILTER_ID) {
      return t("sessionDetail.gallery.selection.filterFavorites", {
        defaultValue: "Favoriler filtrede",
      });
    }
    if (activeSelectionRuleId) {
      const targetRule = selectionRules.find((rule) => rule.id === activeSelectionRuleId);
      if (targetRule) {
        return t("sessionDetail.gallery.selectionTemplate.ruleFilterLabel", {
          defaultValue: `${targetRule.title} filtresi aktif`,
          rule: targetRule.title,
        });
      }
    }
    return t("sessionDetail.gallery.selection.filterAll", { defaultValue: "Showing all items" });
  }, [activeSelectionRuleId, selectionRules, t]);

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
      customType.trim() !== baseline.customType.trim() ||
      selectionSettings.enabled !== baseline.selectionSettings.enabled ||
      selectionSettings.limit !== baseline.selectionSettings.limit ||
      selectionSettings.deadline !== baseline.selectionSettings.deadline ||
      selectionSettings.allowFavorites !== baseline.selectionSettings.allowFavorites,
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
      selectionSettings.enabled,
      baseline.selectionSettings.enabled,
      selectionSettings.limit,
      baseline.selectionSettings.limit,
      selectionSettings.deadline,
      baseline.selectionSettings.deadline,
      selectionSettings.allowFavorites,
      baseline.selectionSettings.allowFavorites,
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
        selectionSettings: (payload.branding.selectionSettings || {
          enabled: false,
          limit: null,
          deadline: null,
          allowFavorites: true,
        }) as SelectionSettings,
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
      return t("templateBuilder.status.saving", { defaultValue: "Saving..." });
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
      return t("templateBuilder.saved", {
        defaultValue: `Saved ${formattedLastSaved}`,
        time: formattedLastSaved,
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
      const branding: Record<string, unknown> = { ...(data?.branding ?? {}) };
      if (eventDate) {
        branding.eventDate = eventDate;
      } else {
        delete branding.eventDate;
      }
      if (type === "other" && customType.trim()) {
        branding.customType = customType.trim();
      } else {
        delete branding.customType;
      }
      branding.selectionSettings = selectionSettings;
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
    selectionSettings,
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
      setEditingSetId(null);
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

  const updateSetMutation = useMutation({
    mutationFn: async ({ setId, name, description }: { setId: string; name: string; description: string | null }) => {
      if (!id) return;
      if (!name.trim()) {
        throw new Error(t("sessionDetail.gallery.sets.errors.nameRequired", { defaultValue: "Name required" }));
      }
      const { error } = await supabase
        .from("gallery_sets")
        .update({ name: name.trim(), description })
        .eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      setIsSetSheetOpen(false);
      setEditingSetId(null);
      setSetName("");
      setSetDescription("");
      queryClient.invalidateQueries({ queryKey: ["gallery_sets", id] });
    },
    onError: (error) => {
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: async (setId: string) => {
      if (!id) return;
      const { error } = await supabase.from("gallery_sets").delete().eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery_sets", id] });
    },
    onError: (error) => {
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const resetSetForm = useCallback(() => {
    setEditingSetId(null);
    setSetName("");
    setSetDescription("");
  }, []);

  const reorderSetsMutation = useMutation({
    mutationFn: async (nextSets: GallerySetRow[]) => {
      if (!id) return;
      await Promise.all(
        nextSets.map(async (set, index) => {
          const { error } = await supabase
            .from("gallery_sets")
            .update({ order_index: index + 1 })
            .eq("id", set.id);
          if (error) throw error;
        })
      );
    },
    onError: (error) => {
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery_sets", id] });
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

  const handleAddMedia = useCallback(
    (setName?: string) => {
      pendingSetNameRef.current = setName ?? null;
      const target = fileInputRef.current;
      if (target) {
        target.click();
        return;
      }
      toast({
        title: t("sessionDetail.gallery.labels.addMedia"),
        description: t("sessionDetail.gallery.labels.uploadDesc", {
          defaultValue: "Select files to add to this gallery.",
        }),
      });
    },
    [t, toast]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        pendingSetNameRef.current = null;
        return;
      }
      // Placeholder: wire to upload flow when available
      const selected = files.length;
      const targetSet = pendingSetNameRef.current;
      pendingSetNameRef.current = null;
      toast({
        title: t("sessionDetail.gallery.labels.addMedia"),
        description:
          t("sessionDetail.gallery.labels.uploadDesc", {
            defaultValue: "Files ready to add to this gallery.",
          }) + (targetSet ? ` (${targetSet})` : ` (${selected})`),
      });
      event.target.value = "";
    },
    [t, toast]
  );

  const handleOpenCreateSet = useCallback(() => {
    resetSetForm();
    setIsSetSheetOpen(true);
  }, [resetSetForm]);

  const handleEditSet = useCallback(
    (set: GallerySetRow) => {
      if (typeof window === "undefined") return;
      setEditingSetId(set.id);
      setSetName(set.name);
      setSetDescription(set.description ?? "");
      setIsSetSheetOpen(true);
    },
    []
  );

  const handleDeleteSet = useCallback(
    (set: GallerySetRow) => {
      if (visibleSets.length <= 1 || set.id === "default-placeholder") {
        toast({
          title: t("sessionDetail.gallery.toast.errorTitle"),
          description: t("sessionDetail.gallery.sets.errors.cannotDeleteLast", {
            defaultValue: "At least one set is required.",
          }),
          variant: "destructive",
        });
        return;
      }
      deleteSetMutation.mutate(set.id);
    },
    [deleteSetMutation, visibleSets.length, t, toast]
  );

  const handleSetReorder = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      setOrderedSets((prev) => {
        if (prev.length === 0) return prev;
        const items = Array.from(prev);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        reorderSetsMutation.mutate(items);
        return items;
      });
    },
    [reorderSetsMutation]
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
        eyebrow={typeLabel}
        subtitle={
          <>
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <span>{eventLabel}</span>
          </>
        }
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
      />

      <div className="flex flex-col gap-6 px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-muted/20 shadow-sm transition-colors">
              {coverUrl ? (
                <div className="relative h-40 w-full bg-muted/40">
                  <img src={coverUrl} alt={displayTitle} className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 left-2 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                    {t("sessionDetail.gallery.labels.coverSelected", { defaultValue: "Cover photo" })}
                  </div>
                </div>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {hasMedia
                      ? t("sessionDetail.gallery.labels.coverMissing", { defaultValue: "Select a cover photo" })
                      : t("sessionDetail.gallery.labels.coverEmpty", { defaultValue: "Henüz kapak fotoğrafı yok" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasMedia
                      ? t("sessionDetail.gallery.labels.coverAfterUpload", {
                          defaultValue: "Pick any uploaded photo as your cover.",
                        })
                      : t("sessionDetail.gallery.labels.coverEmptyHint", {
                          defaultValue: "Galeriye fotoğraf ekledikten sonra kapak fotoğrafını seçebilirsin.",
                        })}
                  </p>
                </div>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "photos" | "settings")}>
              <div className="flex items-center gap-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="photos" className="text-sm">
                    {t("sessionDetail.gallery.labels.media", { defaultValue: "Photos" })}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="text-sm">
                    {t("sessionDetail.gallery.labels.settings")}
                  </TabsTrigger>
                </TabsList>
              </div>

              {activeTab === "photos" ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="surface"
                    className="gap-2"
                    onClick={handleOpenCreateSet}
                  >
                    <Plus className="h-4 w-4" />
                    {t("sessionDetail.gallery.sets.add")}
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-sm font-medium text-primary hover:text-primary/80"
                    onClick={() => setIsSetInfoSheetOpen(true)}
                  >
                    {setInfoLearnMoreLabel}
                  </Button>
                </div>
              ) : null}

             <TabsContent value="photos" className="mt-4 space-y-3">
                {orderedSets.length > 0 ? (
                  <DragDropContext onDragEnd={handleSetReorder}>
                    <Droppable droppableId="gallery-sets">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="space-y-2"
                        >
                          {orderedSets.map((set, index) => (
                            <Draggable key={set.id} draggableId={set.id} index={index}>
                          {(dragProvided, snapshot) => {
                            const isLastSet = visibleSets.length <= 1 || set.id === "default-placeholder";
                            return (
                            <div
                              ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  style={dragProvided.draggableProps.style}
                                  className={cn(
                                    "group rounded-lg border border-border/60 bg-background px-3 py-2.5 shadow-sm transition-shadow",
                                    snapshot.isDragging && "shadow-md ring-2 ring-primary/20"
                                  )}
                                  onClick={() => setActiveSetId(set.id)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <button
                                        type="button"
                                        className="text-muted-foreground/70 transition-colors hover:text-foreground"
                                        {...dragProvided.dragHandleProps}
                                        aria-label={t("sessionDetail.gallery.sets.reorder", {
                                          defaultValue: "Reorder set",
                                        })}
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </button>
                                      <p
                                        className={cn(
                                          "min-w-0 truncate text-sm font-semibold",
                                          activeSet?.id === set.id ? "text-primary" : "text-foreground"
                                        )}
                                      >
                                        {set.name}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-70 hover:opacity-100"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleEditSet(set);
                                        }}
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isLastSet || deleteSetMutation.isPending}
                                        className="h-8 w-8 opacity-70 hover:opacity-100 disabled:opacity-40"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDeleteSet(set);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-70 hover:opacity-100"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleAddMedia(set.name);
                                        }}
                                      >
                                        <ImageUp className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                );
                              }}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    {resolvedSets[0]?.id === "default-placeholder"
                      ? t("sessionDetail.gallery.sets.empty", { defaultValue: "Uploads land here." })
                      : null}
                  </div>
                )}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label>{t("sessionDetail.gallery.form.eventDateLabel")}</Label>
                    <DateTimePicker
                      mode="date"
                      value={eventDate}
                      onChange={(value) => setEventDate(value)}
                      buttonClassName="w-full justify-between"
                      popoverModal
                      fullWidth
                      todayLabel={tForms("dateTimePicker.today")}
                      clearLabel={tForms("dateTimePicker.clear")}
                      doneLabel={tForms("dateTimePicker.done")}
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label>{t("sessionDetail.gallery.form.statusLabel")}</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as GalleryStatus)}>
                      <SelectTrigger className="w-full justify-between">
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
                      disabled
                      onValueChange={(value) => {
                        setType(value as GalleryType);
                        if (value !== "other") {
                          setCustomType("");
                        }
                      }}
                    >
                      <SelectTrigger className="w-full justify-between">
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
                      disabled
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  {autoSaveLabel}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            {type === "proof" ? (
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                      {t("sessionDetail.gallery.selection.title", { defaultValue: "Selection settings" })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("sessionDetail.gallery.selection.description", {
                        defaultValue: "Manage client selections for this gallery.",
                      })}
                    </p>
                  </div>
                  <Button variant="surface" size="sm" onClick={() => setSelectionSheetOpen(true)} className="gap-2">
                    {t("sessionDetail.gallery.selection.open", { defaultValue: "Selection settings" })}
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {selectionRules.length > 0 ? (
                    <SelectionDashboard
                      rules={selectionRules}
                      favoritesCount={favoritesCount}
                      totalPhotos={totalPhotosCount}
                      totalSelected={totalSelectedCount}
                      activeRuleId={activeSelectionRuleId}
                      onSelectRuleFilter={(ruleId) =>
                        setActiveSelectionRuleId((prev) => (prev === ruleId ? null : ruleId))
                      }
                      onEditRules={() => setSelectionSheetOpen(true)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("sessionDetail.gallery.selectionTemplate.noTemplate", {
                        defaultValue: "Henüz seçim kuralı eklenmedi. Seçim ayarları içinden ekleyebilirsiniz.",
                      })}
                    </p>
                  )}
                  <p className="px-1 text-xs text-muted-foreground">{activeSelectionLabel}</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="space-y-4">
                {activeSet ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">{activeSet.name}</p>
                        {activeSet.id === "default-placeholder" ? (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase">
                            {t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Default" })}
                          </Badge>
                        ) : null}
                      </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={activeSet.id === "default-placeholder"}
                        onClick={() => handleEditSet(activeSet)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={visibleSets.length <= 1 || activeSet.id === "default-placeholder" || deleteSetMutation.isPending}
                        onClick={() => handleDeleteSet(activeSet)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="surface"
                        size="sm"
                        className="gap-2"
                        disabled={activeSet.id === "default-placeholder"}
                        onClick={() => handleAddMedia(activeSet.name)}
                      >
                        <ImageIcon className="h-4 w-4" />
                        {t("sessionDetail.gallery.labels.addMedia")}
                      </Button>
                    </div>
                  </div>
                    <div className="px-6 py-12 text-center">
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
                      className="mx-auto mt-4 gap-2"
                      disabled={activeSet.id === "default-placeholder"}
                      onClick={() => handleAddMedia(activeSet.name)}
                    >
                      <ImageIcon className="h-4 w-4" />
                      {t("sessionDetail.gallery.labels.addMedia")}
                    </Button>
                  </div>
                </div>
              ) : (
                  <div className="rounded-xl bg-muted/10 px-5 py-10 text-center text-sm text-muted-foreground">
                    {t("sessionDetail.gallery.sets.empty", { defaultValue: "Uploads land here." })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet
        open={isSetSheetOpen}
        onOpenChange={(open) => {
          setIsSetSheetOpen(open);
          if (!open) {
            resetSetForm();
          }
        }}
      >
        <SheetContent className="flex h-full flex-col w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingSetId
                ? t("sessionDetail.gallery.sets.editTitle", { defaultValue: "Edit photo set" })
                : t("sessionDetail.gallery.sets.createTitle", { defaultValue: "Create photo set" })}
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
          <SheetFooter className="mt-auto gap-2 border-t border-border/60 bg-background pt-4 [&>button]:w-full sm:[&>button]:flex-1">
            <Button
              variant="outline"
              onClick={() => setIsSetSheetOpen(false)}
              disabled={createSetMutation.isPending || updateSetMutation.isPending}
            >
              {t("sessionDetail.gallery.form.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (editingSetId) {
                  updateSetMutation.mutate({ setId: editingSetId, name: setName, description: setDescription.trim() || null });
                } else {
                  createSetMutation.mutate();
                }
              }}
              disabled={
                !setName.trim() ||
                (editingSetId ? updateSetMutation.isPending : createSetMutation.isPending)
              }
            >
              {editingSetId ? (
                updateSetMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("sessionDetail.gallery.form.saving")}
                  </div>
                ) : (
                  t("sessionDetail.gallery.sets.saveChanges", { defaultValue: "Save changes" })
                )
              ) : createSetMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("sessionDetail.gallery.form.saving")}
                </div>
              ) : (
                t("sessionDetail.gallery.sets.createSubmit", { defaultValue: "Create" })
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={selectionSheetOpen} onOpenChange={setSelectionSheetOpen}>
        <SheetContent className="flex h-full flex-col w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {t("sessionDetail.gallery.selection.title", { defaultValue: "Selection settings" })}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("sessionDetail.gallery.selection.enableLabel", { defaultValue: "Allow selections" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("sessionDetail.gallery.selection.enableHint", {
                    defaultValue: "Clients can pick favorites for this gallery.",
                  })}
                </p>
              </div>
              <Switch
                checked={selectionDraft.enabled}
                onCheckedChange={(checked) => setSelectionDraft((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("sessionDetail.gallery.selection.limitLabel", { defaultValue: "Selection limit" })}</Label>
              <Input
                type="number"
                min={0}
                value={selectionDraft.limit ?? ""}
                onChange={(event) =>
                  setSelectionDraft((prev) => ({
                    ...prev,
                    limit: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
                placeholder={t("sessionDetail.gallery.selection.limitPlaceholder", { defaultValue: "No limit" })}
                disabled={!selectionDraft.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("sessionDetail.gallery.selection.deadlineLabel", { defaultValue: "Selection deadline" })}</Label>
              <DateTimePicker
                mode="date"
                value={selectionDraft.deadline ?? ""}
                onChange={(value) => setSelectionDraft((prev) => ({ ...prev, deadline: value || null }))}
                buttonClassName="w-full justify-between"
                popoverModal
                fullWidth
                todayLabel={tForms("dateTimePicker.today")}
                clearLabel={tForms("dateTimePicker.clear")}
                doneLabel={tForms("dateTimePicker.done")}
                disabled={!selectionDraft.enabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("sessionDetail.gallery.selection.favoritesLabel", { defaultValue: "Allow favorites" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("sessionDetail.gallery.selection.favoritesHint", {
                    defaultValue: "Clients can mark photos as favorites.",
                  })}
                </p>
              </div>
              <Switch
                checked={selectionDraft.allowFavorites}
                onCheckedChange={(checked) => setSelectionDraft((prev) => ({ ...prev, allowFavorites: checked }))}
                disabled={!selectionDraft.enabled}
              />
            </div>
          </div>
          <SheetFooter className="mt-auto gap-2 border-t border-border/60 bg-background pt-4 [&>button]:w-full sm:[&>button]:flex-1">
            <Button variant="outline" onClick={() => setSelectionSheetOpen(false)}>
              {t("sessionDetail.gallery.form.cancel")}
            </Button>
            <Button
              onClick={() => {
                setSelectionSettings(selectionDraft);
                setSelectionSheetOpen(false);
              }}
            >
              {t("sessionDetail.gallery.sets.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <EmptyStateInfoSheet
        open={isSetInfoSheetOpen}
        onOpenChange={setIsSetInfoSheetOpen}
        title={setInfoTitle}
        description={setInfoDescription}
        sections={setInfoSections}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </>
  );
}
