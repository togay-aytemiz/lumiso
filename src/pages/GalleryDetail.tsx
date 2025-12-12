import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TemplateBuilderHeader } from "@/components/template-builder/TemplateBuilderHeader";
import { EmptyStateInfoSheet } from "@/components/empty-states/EmptyStateInfoSheet";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import {
  SelectionDashboard,
  FAVORITES_FILTER_ID,
  STARRED_FILTER_ID,
  type SelectionRule,
} from "@/components/galleries/SelectionDashboard";
import {
  SelectionTemplateSection,
  type SelectionTemplateRuleForm,
  createEmptyRule,
  deserializeSelectionTemplate,
  normalizeSelectionTemplate,
} from "@/components/SelectionTemplateSection";
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
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, getUserLocale } from "@/lib/utils";
import {
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Edit3,
  GripVertical,
  Heart,
  ImageIcon,
  ImageUp,
  Loader2,
  Maximize2,
  MoreVertical,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

type GalleryType = "proof" | "retouch" | "final" | "other";
type GalleryStatus = "draft" | "published" | "archived";

type SelectionSettings = {
  enabled: boolean;
  limit: number | null;
  deadline: string | null;
  allowFavorites: boolean;
};

type SelectionTemplateGroupForm = {
  key: string;
  serviceId: string | null;
  serviceName: string | null;
  billingType?: string | null;
  disabled?: boolean;
  rules: SelectionTemplateRuleForm[];
};

type UploadStatus = "queued" | "uploading" | "processing" | "done" | "error" | "canceled";

type UploadItem = {
  id: string;
  name: string;
  size: number;
  setName: string | null;
  status: UploadStatus;
  progress: number;
  previewUrl?: string;
  starred?: boolean;
  error?: string | null;
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

const cloneSelectionTemplateGroups = (groups: SelectionTemplateGroupForm[]) =>
  groups.map((group) => ({
    ...group,
    rules: group.rules.map((rule) => ({ ...rule })),
  }));

const fingerprintSelectionTemplateGroups = (groups: SelectionTemplateGroupForm[]) =>
  JSON.stringify(
    groups.map((group) => ({
      serviceId: group.serviceId ?? null,
      serviceName: group.serviceName ?? null,
      billingType: group.billingType ?? null,
      rules: group.rules.map((rule) => ({
        part: rule.part.trim(),
        min: rule.min,
        max: rule.max,
        required: Boolean(rule.required),
      })),
    }))
  );

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
  const [selectionTemplateGroups, setSelectionTemplateGroups] = useState<SelectionTemplateGroupForm[]>([]);
  const [selectionTemplateDraft, setSelectionTemplateDraft] = useState<SelectionTemplateGroupForm[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const uploadTimersRef = useRef<Record<string, number>>({});
  const uploadQueueRef = useRef<UploadItem[]>([]);
  const [activeSelectionRuleId, setActiveSelectionRuleId] = useState<string | null>(null);
  const [photoSelections, setPhotoSelections] = useState<Record<string, string[]>>({});
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(() => new Set());
  const [batchDeleteGuardOpen, setBatchDeleteGuardOpen] = useState(false);
  const [pendingBatchDeleteIds, setPendingBatchDeleteIds] = useState<Set<string> | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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
    selectionTemplateGroups: [] as SelectionTemplateGroupForm[],
  });
  const autoSaveTimerRef = useRef<number | null>(null);
  const attemptedDefaultSetRef = useRef(false);

  const parseSelectionTemplateGroups = useCallback(
    (branding: Record<string, unknown> | null): SelectionTemplateGroupForm[] => {
      const groupsRaw = branding && Array.isArray((branding as Record<string, unknown>).selectionTemplateGroups)
        ? ((branding as Record<string, unknown>).selectionTemplateGroups as Record<string, unknown>[])
        : [];
      if (groupsRaw.length > 0) {
        return groupsRaw.map((group, index) => {
          const typedGroup = group as Record<string, unknown>;
          const serviceId = typeof typedGroup.serviceId === "string" ? typedGroup.serviceId : null;
          const serviceName = typeof typedGroup.serviceName === "string" ? typedGroup.serviceName : null;
          const billingType = typeof typedGroup.billingType === "string" ? typedGroup.billingType : null;
          return {
            key: serviceId ?? `group-${index}`,
            serviceId,
            serviceName,
            billingType,
            disabled: typedGroup.disabled === true,
            rules: deserializeSelectionTemplate(typedGroup.rules),
          };
        });
      }

      const templateRaw =
        branding && Array.isArray((branding as Record<string, unknown>).selectionTemplate)
          ? ((branding as Record<string, unknown>).selectionTemplate as Record<string, unknown>[])
          : [];

      if (templateRaw.length > 0) {
        return [
          {
            key: "manual-template",
            serviceId: null,
            serviceName: t("sessionDetail.gallery.selectionTemplate.manualGroupTitle", {
              defaultValue: "İlave kurallar",
            }),
            billingType: null,
            disabled: false,
            rules: deserializeSelectionTemplate(templateRaw),
          },
        ];
      }

      return [];
    },
    [t]
  );

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
    const parsedTemplateGroups = parseSelectionTemplateGroups(branding);
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
    setSelectionTemplateGroups(parsedTemplateGroups);
    setSelectionTemplateDraft(cloneSelectionTemplateGroups(parsedTemplateGroups));
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
      selectionTemplateGroups: parsedTemplateGroups,
    });
  }, [data, parseSelectionTemplateGroups]);

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
      setSelectionTemplateDraft(cloneSelectionTemplateGroups(selectionTemplateGroups));
    }
  }, [selectionSheetOpen, selectionSettings, selectionTemplateGroups]);

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

    const addRule = (ruleData: SelectionTemplateRuleForm, ruleId: string, serviceName: string | null) => {
      const part = typeof ruleData.part === "string" ? ruleData.part.trim() : "";
      const normalizedKey = normalizeSelectionPartKey(part);
      const minCount = Math.max(0, parseCountValue(ruleData.min) ?? 0);
      const rawMax = parseCountValue(ruleData.max);
      const maxCount = rawMax != null ? Math.max(rawMax, minCount) : null;
      const currentCount = normalizedKey ? selectionPartCounts[normalizedKey] ?? 0 : 0;
      const required = ruleData.required !== false;
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
        required,
      });
    };

    if (selectionTemplateGroups.length > 0) {
      selectionTemplateGroups.forEach((group, groupIndex) => {
        group.rules.forEach((rule, ruleIndex) => {
          const normalizedKey = normalizeSelectionPartKey(rule.part);
          const ruleId = `${group.key}-${groupIndex}-${normalizedKey || ruleIndex}`;
          addRule(rule, ruleId, group.serviceName ?? null);
        });
      });
    }

    return rules;
  }, [selectionTemplateGroups, selectionPartCounts, t]);

  const localRuleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(photoSelections).forEach((ruleIds) => {
      ruleIds.forEach((ruleId) => {
        counts[ruleId] = (counts[ruleId] ?? 0) + 1;
      });
    });
    return counts;
  }, [photoSelections]);

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

  const handleSelectionTemplateRulesChange = useCallback(
    (groupKey: string, rules: SelectionTemplateRuleForm[]) => {
      setSelectionTemplateDraft((prev) =>
        prev.map((group) => (group.key === groupKey ? { ...group, rules } : group))
      );
    },
    []
  );

  const handleServiceNameChange = useCallback((groupKey: string, value: string) => {
    setSelectionTemplateDraft((prev) =>
      prev.map((group) => (group.key === groupKey ? { ...group, serviceName: value } : group))
    );
  }, []);

  const handleAddRuleToGroup = useCallback((groupKey: string) => {
    setSelectionTemplateDraft((prev) =>
      prev.map((group) =>
        group.key === groupKey ? { ...group, rules: [...group.rules, createEmptyRule()] } : group
      )
    );
  }, []);

  const handleToggleGroupDisabled = useCallback((groupKey: string, disabled: boolean) => {
    setSelectionTemplateDraft((prev) =>
      prev.map((group) => (group.key === groupKey ? { ...group, disabled } : group))
    );
  }, []);

  const handleAddTemplateGroup = useCallback(() => {
    setSelectionTemplateDraft((prev) => [
      ...prev,
      {
        key: `manual-${prev.length}`,
        serviceId: null,
        serviceName: t("sessionDetail.gallery.selectionTemplate.manualGroupTitle", {
          defaultValue: "İlave kurallar",
        }),
        billingType: null,
        disabled: false,
        rules: [createEmptyRule()],
      },
    ]);
  }, [t]);

  const cleanSelectionTemplateDraft = useCallback(
    (groups: SelectionTemplateGroupForm[]) =>
      groups
        .map((group, index) => {
          const rules = group.rules.filter((rule) => {
            const partValue = typeof rule.part === "string" ? rule.part.trim() : "";
            const minValue =
              typeof rule.min === "string" ? rule.min.trim() : rule.min != null ? String(rule.min) : "";
            const maxValue =
              typeof rule.max === "string" ? rule.max.trim() : rule.max != null ? String(rule.max) : "";
            return partValue || minValue || maxValue;
          });
          return {
            ...group,
            key: group.key || `group-${index}`,
            rules,
          };
        })
        .filter((group) => group.disabled === true || group.rules.length > 0),
    []
  );

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
    if (activeSelectionRuleId === STARRED_FILTER_ID) {
      return t("sessionDetail.gallery.selection.filterStarred", { defaultValue: "Yıldızlı yüklemeler" });
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
      selectionSettings.allowFavorites !== baseline.selectionSettings.allowFavorites ||
      fingerprintSelectionTemplateGroups(selectionTemplateGroups) !==
        fingerprintSelectionTemplateGroups(baseline.selectionTemplateGroups),
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
      selectionTemplateGroups,
      baseline.selectionTemplateGroups,
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
      const parsedTemplateGroups = parseSelectionTemplateGroups(payload.branding);
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
        selectionTemplateGroups: parsedTemplateGroups,
      });
      setSelectionTemplateGroups(parsedTemplateGroups);
      setSelectionTemplateDraft(cloneSelectionTemplateGroups(parsedTemplateGroups));
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
      const normalizedTemplateGroups = selectionTemplateGroups
        .map((group) => {
          const rules = normalizeSelectionTemplate(group.rules) ?? [];
          return {
            serviceId: group.serviceId ?? null,
            serviceName: group.serviceName ?? null,
            billingType: group.billingType ?? null,
            disabled: group.disabled === true,
            rules,
          };
        })
        .filter((group) => group.disabled || group.rules.length > 0);

      if (normalizedTemplateGroups.length > 0) {
        branding.selectionTemplateGroups = normalizedTemplateGroups.map((group) => ({
          serviceId: group.serviceId,
          serviceName: group.serviceName,
          billingType: group.billingType,
          rules: group.rules,
          disabled: group.disabled,
        }));
        branding.selectionTemplate = normalizedTemplateGroups.flatMap((group) => group.rules ?? []);
      } else {
        delete branding.selectionTemplateGroups;
        delete branding.selectionTemplate;
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
    selectionSettings,
    selectionTemplateGroups,
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

  const enqueueUploads = useCallback(
    (files: FileList | File[], setName?: string | null) => {
      const list = Array.from(files ?? []);
      if (list.length === 0) return;
      setUploadQueue((prev) => [
        ...prev,
        ...list.map((file) => {
          const id = `upload-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
          return {
            id,
            name: file.name,
            size: file.size,
            setName: setName ?? null,
            status: "queued" as UploadStatus,
            progress: 0,
            previewUrl: URL.createObjectURL(file),
            starred: false,
            error: null,
          };
        }),
      ]);
    },
    []
  );

  const clearUploadTimer = useCallback((id: string) => {
    const timer = uploadTimersRef.current[id];
    if (timer) {
      window.clearInterval(timer);
      delete uploadTimersRef.current[id];
    }
  }, []);

  const startUpload = useCallback(
    (item: UploadItem) => {
      clearUploadTimer(item.id);
      setUploadQueue((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, status: "uploading", progress: Math.max(entry.progress, 5), error: null } : entry
        )
      );

      const timer = window.setInterval(() => {
        setUploadQueue((prev) =>
          prev.map((entry) => {
            if (entry.id !== item.id) return entry;
            const nextProgress = Math.min(100, entry.progress + Math.random() * 15 + 5);
            if (nextProgress >= 100) {
              clearUploadTimer(item.id);
              return { ...entry, progress: 100, status: "done" };
            }
            return { ...entry, progress: nextProgress, status: "uploading" };
          })
        );
      }, 450);
      uploadTimersRef.current[item.id] = timer;
    },
    [clearUploadTimer]
  );

  const handleCancelUpload = useCallback(
    (id: string) => {
      clearUploadTimer(id);
      setUploadQueue((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, status: "canceled", error: "Canceled by user" } : entry))
      );
    },
    [clearUploadTimer]
  );

  const handleRetryUpload = useCallback(
    (id: string) => {
      const target = uploadQueue.find((item) => item.id === id);
      if (!target) return;
      startUpload({ ...target, progress: 0, status: "queued", error: null });
    },
    [startUpload, uploadQueue]
  );

  const handleToggleStar = useCallback((id: string) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, starred: !item.starred } : item))
    );
  }, []);

  const isBatchSelectionMode =
    !activeSelectionRuleId || activeSelectionRuleId === FAVORITES_FILTER_ID || activeSelectionRuleId === STARRED_FILTER_ID;

  const toggleBatchSelect = useCallback((id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearBatchSelection = useCallback(() => {
    setSelectedBatchIds(new Set());
  }, []);

  useEffect(() => {
    if (!isBatchSelectionMode && selectedBatchIds.size > 0) {
      setSelectedBatchIds(new Set());
    }
  }, [isBatchSelectionMode, selectedBatchIds.size]);

  const togglePhotoRuleSelection = useCallback((photoId: string, ruleId: string) => {
    setPhotoSelections((prev) => {
      const current = prev[photoId] ?? [];
      if (current.includes(ruleId)) {
        const next = current.filter((id) => id !== ruleId);
        if (next.length === 0) {
          const { [photoId]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [photoId]: next };
      }
      return { ...prev, [photoId]: [...current, ruleId] };
    });
  }, []);

  const starredUploadCount = useMemo(
    () => uploadQueue.filter((item) => item.starred && item.status === "done").length,
    [uploadQueue]
  );

  const uploadsForActiveSet = useMemo(() => {
    const activeSetName = activeSet?.name ?? null;
    if (!activeSetName) return uploadQueue;
    return uploadQueue.filter((item) => !item.setName || item.setName === activeSetName);
  }, [uploadQueue, activeSet?.name]);

  const filteredUploads = useMemo(() => {
    if (!activeSelectionRuleId) return uploadsForActiveSet;
    if (activeSelectionRuleId === STARRED_FILTER_ID) {
      return uploadsForActiveSet.filter((item) => item.starred);
    }
    if (activeSelectionRuleId === FAVORITES_FILTER_ID) {
      return uploadsForActiveSet;
    }
    return uploadsForActiveSet.filter((item) =>
      (photoSelections[item.id] ?? []).includes(activeSelectionRuleId)
    );
  }, [uploadsForActiveSet, activeSelectionRuleId, photoSelections]);

  const selectableDoneUploadIds = useMemo(
    () => filteredUploads.filter((item) => item.status === "done").map((item) => item.id),
    [filteredUploads]
  );

  const handleBatchSelectAll = useCallback(() => {
    setSelectedBatchIds(new Set(selectableDoneUploadIds));
  }, [selectableDoneUploadIds]);

  const handleBatchStar = useCallback(() => {
    if (selectedBatchIds.size === 0) return;
    setUploadQueue((prev) =>
      prev.map((item) => (selectedBatchIds.has(item.id) ? { ...item, starred: true } : item))
    );
    setSelectedBatchIds(new Set());
  }, [selectedBatchIds]);

  const requestBatchDelete = useCallback(() => {
    if (selectedBatchIds.size === 0) return;
    setPendingBatchDeleteIds(new Set(selectedBatchIds));
    setBatchDeleteGuardOpen(true);
  }, [selectedBatchIds]);

  const closeBatchDeleteGuard = useCallback(() => {
    setBatchDeleteGuardOpen(false);
    setPendingBatchDeleteIds(null);
  }, []);

  const confirmBatchDelete = useCallback(() => {
    if (!pendingBatchDeleteIds || pendingBatchDeleteIds.size === 0) {
      closeBatchDeleteGuard();
      return;
    }

    const idsToDelete = new Set(pendingBatchDeleteIds);
    setBatchDeleteGuardOpen(false);
    setPendingBatchDeleteIds(null);
    setSelectedBatchIds(new Set());

    window.setTimeout(() => {
      setUploadQueue((prev) => {
        prev.forEach((item) => {
          if (idsToDelete.has(item.id) && item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return prev.filter((item) => !idsToDelete.has(item.id));
      });

      setPhotoSelections((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        const next: Record<string, string[]> = {};
        Object.entries(prev).forEach(([photoId, ruleIds]) => {
          if (!idsToDelete.has(photoId)) {
            next[photoId] = ruleIds;
          }
        });
        return next;
      });
    }, 0);
  }, [pendingBatchDeleteIds, closeBatchDeleteGuard]);

  const openLightboxAt = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const lightboxPhotos = filteredUploads;
  const currentLightboxPhoto = lightboxPhotos[lightboxIndex];
  const currentLightboxSelectionIds = currentLightboxPhoto
    ? (photoSelections[currentLightboxPhoto.id] ?? [])
    : [];
  const isCurrentLightboxFavorite = currentLightboxSelectionIds.includes(FAVORITES_FILTER_ID);

  const navigateLightbox = useCallback(
    (delta: number) => {
      setLightboxIndex((prev) => {
        if (lightboxPhotos.length === 0) return 0;
        const nextIndex = prev + delta;
        return Math.max(0, Math.min(nextIndex, lightboxPhotos.length - 1));
      });
    },
    [lightboxPhotos.length]
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        navigateLightbox(-1);
      }
      if (event.key === "ArrowRight") {
        navigateLightbox(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, navigateLightbox]);

  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
    const queued = uploadQueue.filter((item) => item.status === "queued");
    queued.forEach((item) => startUpload(item));
  }, [startUpload, uploadQueue]);

  useEffect(
    () => () => {
      uploadQueueRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      Object.keys(uploadTimersRef.current).forEach((id) => clearUploadTimer(id));
    },
    [clearUploadTimer]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        pendingSetNameRef.current = null;
        return;
      }
      const targetSet = pendingSetNameRef.current;
      pendingSetNameRef.current = null;
      enqueueUploads(files, targetSet);
      event.target.value = "";
    },
    [enqueueUploads]
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
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <p className="text-lg font-semibold text-foreground">Seçim özeti</p>
                  <Button variant="surface" size="sm" onClick={() => setSelectionSheetOpen(true)} className="gap-2">
                    {t("sessionDetail.gallery.selection.open", { defaultValue: "Selection settings" })}
                  </Button>
                </div>

                <div className="mt-2 space-y-2">
                  {selectionRules.length > 0 ? (
                    <SelectionDashboard
                      rules={selectionRules}
                      favoritesCount={favoritesCount}
                      starredCount={starredUploadCount}
                      totalPhotos={totalPhotosCount}
                      totalSelected={totalSelectedCount}
                      activeRuleId={activeSelectionRuleId}
                      onSelectRuleFilter={(ruleId) =>
                        setActiveSelectionRuleId((prev) => (prev === ruleId ? null : ruleId))
                      }
                      onEditRules={() => setSelectionSheetOpen(true)}
                      showHeader={false}
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
                  <div
                    className="space-y-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (event.dataTransfer.files?.length) {
                        enqueueUploads(event.dataTransfer.files, activeSet.name);
                      }
                    }}
                  >
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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t("sessionDetail.gallery.viewMode.label", { defaultValue: "Görünüm" })}
                        </span>
                        <SegmentedControl
                          size="sm"
                          value={viewMode}
                          onValueChange={(value) => setViewMode(value as "grid" | "list")}
                          options={[
                            {
                              value: "grid",
                              label: t("sessionDetail.gallery.viewMode.board", { defaultValue: "Pano" }),
                              ariaLabel: t("sessionDetail.gallery.viewMode.grid", { defaultValue: "Pano görünümü" }),
                            },
                            {
                              value: "list",
                              label: t("sessionDetail.gallery.viewMode.listLabel", { defaultValue: "Liste" }),
                              ariaLabel: t("sessionDetail.gallery.viewMode.list", { defaultValue: "Liste görünümü" }),
                            },
                          ]}
                        />
                      </div>

                      <div className="h-6 w-px bg-border/60" aria-hidden="true" />

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
                    {uploadQueue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {t("sessionDetail.gallery.labels.uploadTitle", { defaultValue: "Dosyaları bırak veya seç" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("sessionDetail.gallery.labels.uploadDesc", {
                              defaultValue: "2560px uzun kenar WebP; sürükleyip bırak ya da dosya seç.",
                            })}
                          </p>
                        </div>
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
                    ) : null}

                    {filteredUploads.length > 0 ? (
                      viewMode === "list" ? (
                        <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-white">
                          {filteredUploads.map((item, index) => {
                            const isDone = item.status === "done";
                            const isError = item.status === "error";
                            const isCanceled = item.status === "canceled";
                            const selectedRuleIds = photoSelections[item.id] ?? [];
                            const selectedRuleLabels = selectedRuleIds
                              .map((ruleId) => selectionRules.find((rule) => rule.id === ruleId)?.title)
                              .filter(Boolean) as string[];
                            const isSelectedInActiveRule =
                              Boolean(activeSelectionRuleId) &&
                              activeSelectionRuleId !== FAVORITES_FILTER_ID &&
                              activeSelectionRuleId !== STARRED_FILTER_ID &&
                              selectedRuleIds.includes(activeSelectionRuleId);
                            const isClientFavorite = selectedRuleIds.includes(FAVORITES_FILTER_ID);
                            const isBatchSelected = selectedBatchIds.has(item.id);

                            const progressLabel =
                              item.status === "uploading"
                                ? t("sessionDetail.gallery.labels.uploading", { defaultValue: "Yükleniyor" })
                                : item.status === "processing"
                                  ? t("sessionDetail.gallery.labels.processing", { defaultValue: "İşleniyor" })
                                  : item.status === "done"
                                    ? t("sessionDetail.gallery.labels.done", { defaultValue: "Tamamlandı" })
                                    : item.status === "error"
                                      ? item.error ?? t("sessionDetail.gallery.labels.error", { defaultValue: "Hata" })
                                      : item.status === "canceled"
                                        ? t("sessionDetail.gallery.labels.canceled", { defaultValue: "İptal edildi" })
                                        : t("sessionDetail.gallery.labels.queued", { defaultValue: "Sırada" });

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (isDone) openLightboxAt(index);
                                }}
                                className={cn(
                                  "group flex cursor-pointer items-center gap-4 border-b border-border/40 p-3 transition-colors hover:bg-muted/30 last:border-0",
                                  isSelectedInActiveRule && "bg-emerald-50/40"
                                )}
                              >
                                {isBatchSelectionMode && isDone ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleBatchSelect(item.id);
                                    }}
                                    className={cn(
                                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                      isBatchSelected
                                        ? "border-[hsl(var(--accent-300))] bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-800))]"
                                        : "border-border/60 bg-white text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                    )}
                                    title={isBatchSelected ? "Seçimi kaldır" : "Seç"}
                                    aria-label={isBatchSelected ? "Seçimi kaldır" : "Seç"}
                                  >
                                    {isBatchSelected ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      <Circle className="h-5 w-5" />
                                    )}
                                  </button>
                                ) : null}

                                <div
                                  className={cn(
                                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20",
                                    isBatchSelectionMode &&
                                      isBatchSelected &&
                                      "border-[hsl(var(--accent-500))] ring-1 ring-[hsl(var(--accent-500))]"
                                  )}
                                >
                                  {item.previewUrl ? (
                                    <img
                                      src={item.previewUrl}
                                      alt={item.name}
                                      className={cn(
                                        "h-full w-full object-cover",
                                        item.status !== "done" &&
                                          item.status !== "error" &&
                                          item.status !== "canceled" &&
                                          "opacity-40"
                                      )}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                      <ImageIcon className="h-5 w-5" />
                                    </div>
                                  )}
                                  {!isDone ? (
                                    <div className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-emerald-100">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          isError ? "bg-destructive" : "bg-emerald-400"
                                        )}
                                        style={{ width: `${item.progress}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                                    {isClientFavorite ? (
                                      <span
                                        className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600"
                                        title="Müşteri Favorisi"
                                      >
                                        <Heart size={10} fill="currentColor" />
                                        Favori
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedRuleLabels.length > 0 ? (
                                      selectedRuleLabels.map((label) => (
                                        <span
                                          key={`${item.id}-${label}`}
                                          className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                                        >
                                          {label}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">
                                        Seçim yok
                                      </span>
                                    )}
                                  </div>
                                  {!isDone ? (
                                    <div className="text-[11px] text-muted-foreground">{progressLabel} · {Math.round(item.progress)}%</div>
                                  ) : null}
                                </div>

                                <div
                                  className="flex shrink-0 items-center gap-2"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStar(item.id)}
                                    className={cn(
                                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                                      item.starred
                                        ? "border-amber-200 bg-amber-50 text-amber-500"
                                        : "border-border/60 bg-white text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                    )}
                                    title={item.starred ? "Yıldızı kaldır" : "Yıldızla"}
                                  >
                                    <Star size={16} fill={item.starred ? "currentColor" : "none"} />
                                  </button>

                                  {activeSelectionRuleId &&
                                  activeSelectionRuleId !== FAVORITES_FILTER_ID &&
                                  activeSelectionRuleId !== STARRED_FILTER_ID ? (
                                    <button
                                      type="button"
                                      onClick={() => togglePhotoRuleSelection(item.id, activeSelectionRuleId)}
                                      className={cn(
                                        "h-9 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                        isSelectedInActiveRule
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                          : "border-border/60 bg-white text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                      )}
                                    >
                                      {isSelectedInActiveRule ? "Seçildi" : "Seç"}
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openLightboxAt(index)}
                                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-white px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                                      >
                                        <Maximize2 className="h-4 w-4" />
                                        İncele
                                      </button>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                                  >
                                    <MoreHorizontal size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid w-full gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                          {filteredUploads.map((item, index) => {
                            const isDone = item.status === "done";
                            const isError = item.status === "error";
                            const isCanceled = item.status === "canceled";
                            const selectedRuleIds = photoSelections[item.id] ?? [];
                            const selectedRuleLabels = selectedRuleIds
                              .map((ruleId) => selectionRules.find((rule) => rule.id === ruleId)?.title)
                              .filter(Boolean) as string[];
                            const isClientFavorite = selectedRuleIds.includes(FAVORITES_FILTER_ID);
                            const isSelectedInActiveRule =
                              Boolean(activeSelectionRuleId) &&
                              activeSelectionRuleId !== FAVORITES_FILTER_ID &&
                              activeSelectionRuleId !== STARRED_FILTER_ID &&
                              selectedRuleIds.includes(activeSelectionRuleId);
                            const isBatchSelected = selectedBatchIds.has(item.id);

                            const progressLabel =
                              item.status === "uploading"
                                ? t("sessionDetail.gallery.labels.uploading", { defaultValue: "Yükleniyor" })
                                : item.status === "processing"
                                  ? t("sessionDetail.gallery.labels.processing", { defaultValue: "İşleniyor" })
                                  : item.status === "done"
                                    ? t("sessionDetail.gallery.labels.done", { defaultValue: "Tamamlandı" })
                                    : item.status === "error"
                                      ? item.error ?? t("sessionDetail.gallery.labels.error", { defaultValue: "Hata" })
                                      : item.status === "canceled"
                                        ? t("sessionDetail.gallery.labels.canceled", { defaultValue: "İptal edildi" })
                                        : t("sessionDetail.gallery.labels.queued", { defaultValue: "Sırada" });

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (isDone) openLightboxAt(index);
                                }}
                                className={cn(
                                  "group relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted/20 transition-all duration-300",
                                  isBatchSelectionMode && isBatchSelected
                                    ? "border-[hsl(var(--accent-500))] ring-2 ring-[hsl(var(--accent-500))] shadow-md"
                                    : isSelectedInActiveRule
                                      ? "border-emerald-500 ring-1 ring-emerald-500 shadow-md"
                                      : "border-transparent hover:border-border/70"
                                )}
                              >
                                {item.previewUrl ? (
                                  <img
                                    src={item.previewUrl}
                                    alt={item.name}
                                    loading="lazy"
                                    className={cn(
                                      "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] transform-gpu will-change-transform",
                                      item.status !== "done" &&
                                        item.status !== "error" &&
                                        item.status !== "canceled" &&
                                        "opacity-40"
                                    )}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <ImageIcon className="h-6 w-6" />
                                  </div>
                                )}

                                {isDone ? (
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                ) : null}

                                {selectedRuleLabels.length > 0 ? (
                                  <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5 max-w-[70%]">
                                    {selectedRuleLabels.map((label) => (
                                      <div
                                        key={`${item.id}-${label}`}
                                        className="flex items-center gap-1.5 rounded-md border border-gray-100 bg-white/95 px-2 py-1 shadow-sm animate-in fade-in slide-in-from-left-2 duration-200"
                                      >
                                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                        <span className="truncate text-[10px] font-bold leading-none text-slate-800">
                                          {label}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {isClientFavorite ? (
                                  <div className="absolute bottom-3 left-3 z-10" title="Müşteri Favorisi">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg backdrop-blur-sm animate-in zoom-in duration-300">
                                      <Heart size={12} fill="currentColor" />
                                    </div>
                                  </div>
                                ) : null}

                                <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-2">
                                  <div onClick={(event) => event.stopPropagation()} className="relative">
                                    {item.starred ? (
                                      <div className="absolute right-0 top-0 rounded-full bg-amber-400 p-1.5 text-white shadow-sm transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
                                        <Star size={12} fill="currentColor" />
                                      </div>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStar(item.id)}
                                      className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 ease-out opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100 hover:!scale-110 shadow-lg",
                                        item.starred
                                          ? "bg-amber-400 text-white shadow-amber-500/30"
                                          : "bg-black/40 text-white/70 hover:bg-white hover:text-amber-500"
                                      )}
                                    >
                                      <Star size={16} fill={item.starred ? "currentColor" : "none"} />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(event) => event.stopPropagation()}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:bg-white hover:text-slate-900 backdrop-blur-md transition-all duration-200 ease-out opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100 hover:!scale-110 shadow-lg"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                </div>

                                {isDone ? (
                                  <div
                                    className={cn(
                                      "absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 p-3 transition-transform duration-300",
                                      isBatchSelectionMode && isBatchSelected
                                        ? "translate-y-0"
                                        : "translate-y-full group-hover:translate-y-0"
                                    )}
                                  >
                                    <span className="truncate px-1 text-xs font-medium text-white/80">
                                      {item.name}
                                    </span>
                                    <div onClick={(event) => event.stopPropagation()}>
                                      {activeSelectionRuleId &&
                                      activeSelectionRuleId !== FAVORITES_FILTER_ID &&
                                      activeSelectionRuleId !== STARRED_FILTER_ID ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            togglePhotoRuleSelection(item.id, activeSelectionRuleId)
                                          }
                                          className={cn(
                                            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold shadow-lg transition-colors",
                                            isSelectedInActiveRule
                                              ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                              : "bg-white text-slate-900 hover:bg-slate-100"
                                          )}
                                        >
                                          <Check size={16} strokeWidth={3} />
                                          {isSelectedInActiveRule ? "SEÇİLDİ" : "SEÇ"}
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => toggleBatchSelect(item.id)}
                                            className={cn(
                                              "flex h-10 w-10 items-center justify-center rounded-lg shadow-lg backdrop-blur-md transition-colors",
                                              isBatchSelected
                                                ? "bg-[hsl(var(--accent-500))] text-white hover:bg-[hsl(var(--accent-600))]"
                                                : "bg-white/90 text-muted-foreground hover:bg-white hover:text-foreground"
                                            )}
                                            title={isBatchSelected ? "Seçimi kaldır" : "Seç"}
                                            aria-label={isBatchSelected ? "Seçimi kaldır" : "Seç"}
                                          >
                                            {isBatchSelected ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => openLightboxAt(index)}
                                            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-white/90 text-xs font-bold text-slate-900 shadow-lg backdrop-blur-md transition-colors hover:bg-white"
                                          >
                                            <Maximize2 className="h-4 w-4" />
                                            İNCELE
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/60 px-3 py-2 text-[11px] text-white/80 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="shrink-0">
                                        {progressLabel} · {Math.round(item.progress)}%
                                      </span>
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all",
                                            isError ? "bg-destructive" : "bg-emerald-400"
                                          )}
                                          style={{ width: `${item.progress}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : null}
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

      {activeTab === "photos" && isBatchSelectionMode && selectedBatchIds.size > 0 && !lightboxOpen ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="animate-in fade-in slide-in-from-bottom-2 flex w-full max-w-3xl items-center gap-3 rounded-full border border-white/10 bg-slate-950/90 px-4 py-3 text-white shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                  {selectedBatchIds.size}
                </span>
                <span className="text-sm font-semibold">Seçildi</span>
              </div>
              <button
                type="button"
                onClick={clearBatchSelection}
                className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Seçimi temizle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-white/15" aria-hidden="true" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleBatchSelectAll}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Tümünü Seç
              </button>
              <button
                type="button"
                onClick={handleBatchStar}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Star className="h-4 w-4" />
                Yıldızla
              </button>
              <button
                type="button"
                onClick={requestBatchDelete}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-destructive/20 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Sil
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <NavigationGuardDialog
        open={batchDeleteGuardOpen}
        onDiscard={confirmBatchDelete}
        onStay={closeBatchDeleteGuard}
        title="Silme onayı"
        stayLabel="Vazgeç"
        discardLabel="Sil"
        message={`${pendingBatchDeleteIds?.size ?? 0} seçili görseli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
      />

      {lightboxOpen && currentLightboxPhoto ? (
        <div className="fixed inset-0 z-[100] flex bg-black/95 text-white backdrop-blur-sm">
          <div className="relative flex flex-1 flex-col">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium opacity-80">
                  {lightboxIndex + 1} / {lightboxPhotos.length}
                </span>
                <span className="max-w-[60vw] truncate text-sm font-mono text-white/60">
                  {currentLightboxPhoto.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="rounded-full p-2 hover:bg-white/10"
                  aria-label={t("sessionDetail.gallery.labels.close", { defaultValue: "Kapat" })}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigateLightbox(-1)}
              disabled={lightboxIndex === 0}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
              aria-label={t("sessionDetail.gallery.labels.previous", { defaultValue: "Önceki" })}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <button
              type="button"
              onClick={() => navigateLightbox(1)}
              disabled={lightboxIndex >= lightboxPhotos.length - 1}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
              aria-label={t("sessionDetail.gallery.labels.next", { defaultValue: "Sonraki" })}
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <div className="flex flex-1 items-center justify-center p-4 md:p-8">
              {currentLightboxPhoto.previewUrl ? (
                <img
                  src={currentLightboxPhoto.previewUrl}
                  alt={currentLightboxPhoto.name}
                  className="max-h-[calc(100vh-8rem)] max-w-full object-contain shadow-2xl"
                />
              ) : (
                <div className="text-sm text-white/60">
                  {t("sessionDetail.gallery.labels.noPreview", { defaultValue: "Önizleme yok" })}
                </div>
              )}
            </div>
          </div>

          <div className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-black/80">
            <div className="border-b border-white/10 p-5">
              <h3 className="text-lg font-semibold">
                {t("sessionDetail.gallery.selection.lightboxTitle", { defaultValue: "Seçim detayları" })}
              </h3>
              <p className="text-xs text-white/60">
                {t("sessionDetail.gallery.selection.lightboxDesc", {
                  defaultValue: "Bu fotoğrafı hangi listelere eklemek istersiniz?",
                })}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Fotoğraf Durumu
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleStar(currentLightboxPhoto.id)}
                  aria-label={t("sessionDetail.gallery.labels.star", { defaultValue: "Yıldızla" })}
                  title={currentLightboxPhoto.starred ? "Yıldızı kaldır" : "Yıldızla"}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                    currentLightboxPhoto.starred
                      ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Star
                      size={16}
                      className={cn(currentLightboxPhoto.starred ? "fill-current" : "fill-none")}
                    />
                    Fotoğrafçı Önerisi
                  </span>
                  {currentLightboxPhoto.starred ? (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      Seçildi
                    </span>
                  ) : null}
                </button>

                <div
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2",
                    isCurrentLightboxFavorite
                      ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                      : "border-white/10 bg-transparent text-white/50 opacity-70"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Heart
                      size={16}
                      className={cn(isCurrentLightboxFavorite ? "fill-current" : "fill-none")}
                    />
                    Müşteri Favorisi
                  </span>
                  {isCurrentLightboxFavorite ? (
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-100">
                      Beğendi
                    </span>
                  ) : (
                    <span className="text-[10px]">Henüz yok</span>
                  )}
                </div>
              </div>

              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                Seçim Kuralları
              </div>

              <div className="space-y-2">
                {selectionRules.map((rule) => {
                  const selectedForRule = currentLightboxSelectionIds.includes(rule.id);
                  const localCount = localRuleCounts[rule.id] ?? 0;
                  const maxAllowed = rule.maxCount ?? null;
                  const isFull = maxAllowed != null && localCount >= maxAllowed;
                  const isDisabled = !selectedForRule && isFull;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() =>
                        !isDisabled && togglePhotoRuleSelection(currentLightboxPhoto.id, rule.id)
                      }
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                        selectedForRule
                          ? "border-emerald-400/60 bg-white/10"
                          : "border-white/10 hover:border-white/20 hover:bg-white/5",
                        isDisabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="truncate text-[10px] font-bold uppercase tracking-wider text-white/50">
                          {rule.serviceName || "Genel"}
                        </div>
                        <div className="truncate text-sm font-medium text-white">{rule.title}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-white/50">
                          <span className={isFull && !selectedForRule ? "text-amber-400" : undefined}>
                            {localCount} / {maxAllowed ?? "∞"}
                          </span>
                          <span>
                            {rule.required === false ? "(Opsiyonel)" : "(Zorunlu)"}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
                          selectedForRule
                            ? "border-emerald-400 bg-emerald-400 text-white"
                            : "border-white/30 text-transparent group-hover:border-white/60"
                        )}
                      >
                        {selectedForRule ? <CheckCircle2 size={14} /> : <Circle size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
        <SheetContent className="flex h-full flex-col w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>
              {t("sessionDetail.gallery.selection.title", { defaultValue: "Selection settings" })}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            {(() => {
              const serviceGroups = selectionTemplateDraft.filter((group) => group.serviceId);
              const manualGroups = selectionTemplateDraft.filter((group) => !group.serviceId);
              const manualGroup = manualGroups[0];
              const manualPillLabel = t("sessionDetail.gallery.selectionTemplate.manualPill", {
                defaultValue: "Hizmetten bağımsız",
              });
              const addGeneralRuleLabel = t("sessionDetail.gallery.selectionTemplate.addGeneralRule", {
                defaultValue: "İlave kural ekle",
              });
              const manualGroupTitle =
                manualGroup?.serviceName ||
                t("sessionDetail.gallery.selectionTemplate.manualGroupTitle", {
                  defaultValue: "İlave kurallar",
                });

              const renderManualGroup = () => {
                if (!manualGroup) {
                  return (
                    <div className="space-y-2 rounded-lg border border-dashed border-emerald-200/70 bg-white/70 p-3 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {t("sessionDetail.gallery.selectionTemplate.manualGroupTitle", {
                              defaultValue: "İlave kurallar",
                            })}
                          </p>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            {manualPillLabel}
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2 border-emerald-300 text-emerald-700 bg-white hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-60"
                          onClick={handleAddTemplateGroup}
                        >
                          <Plus className="h-4 w-4" />
                          {addGeneralRuleLabel}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("sessionDetail.gallery.selectionTemplate.manualAddPrompt", {
                          defaultValue: "İlave kural eklemek için tıklayın.",
                        })}
                      </p>
                    </div>
                  );
                }

                const hasManualRules = (manualGroup.rules?.length ?? 0) > 0;
                return (
                  <div className="space-y-2 rounded-lg border border-dashed border-emerald-200/70 bg-white/70 p-3 w-full">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{manualGroupTitle}</p>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          {manualPillLabel}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant={hasManualRules ? "outline" : "link"}
                        size="sm"
                        className={cn(
                          "h-8 gap-2",
                          hasManualRules
                            ? "border-emerald-300 text-emerald-700 bg-white hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-60"
                            : "px-0 text-emerald-700 hover:text-emerald-800 disabled:opacity-60"
                        )}
                        onClick={() => handleAddRuleToGroup(manualGroup.key)}
                      >
                        <Plus className="h-4 w-4" />
                        {addGeneralRuleLabel}
                      </Button>
                    </div>
                    {hasManualRules ? (
                      <SelectionTemplateSection
                        enabled
                        rules={manualGroup.rules}
                        onRulesChange={(rules) => handleSelectionTemplateRulesChange(manualGroup.key, rules)}
                        tone="emerald"
                        showHeader={false}
                        showToggle={false}
                        variant="unstyled"
                        showAddButton={false}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("sessionDetail.gallery.selectionTemplate.manualAddPrompt", {
                          defaultValue: "İlave kural eklemek için tıklayın.",
                        })}
                      </p>
                    )}
                  </div>
                );
              };

              if (serviceGroups.length === 0 && !manualGroup) {
                return (
                  <div className="space-y-2 rounded-lg border border-dashed border-emerald-200/70 bg-white/70 p-3 w-full">
                    <p className="text-sm text-muted-foreground">
                      {t("sessionDetail.gallery.selectionTemplate.noTemplate", {
                        defaultValue: "Henüz seçim kuralı eklenmedi. Kuralları buradan ekleyebilirsiniz.",
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 border-emerald-300 text-emerald-700 bg-white hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                        onClick={handleAddTemplateGroup}
                      >
                        <Plus className="h-4 w-4" />
                        {addGeneralRuleLabel}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="space-y-4">
                    {serviceGroups.map((group) => {
                      const defaultServiceLabel = t("sessionDetail.gallery.selectionTemplate.customLabel", {
                        defaultValue: "Özel seçim kuralları",
                      });
                      const serviceNameValue = group.serviceName ?? defaultServiceLabel;
                      const isDisabled = Boolean(group.disabled);
                      return (
                        <div key={group.key} className="space-y-2 w-full">
                          <div className="space-y-2 rounded-lg border border-emerald-100 bg-white/80 p-3 w-full">
                            <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                              <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                                <Input
                                  value={serviceNameValue}
                                  onChange={(event) => handleServiceNameChange(group.key, event.target.value)}
                                  className="h-8 text-sm"
                                  disabled={isDisabled}
                                  aria-label={t("sessionDetail.gallery.selectionTemplate.serviceNameInput", {
                                    defaultValue: "Hizmet adı",
                                  })}
                                />
                                {!isDisabled ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {t("sessionDetail.gallery.selectionTemplate.serviceNameHelper", {
                                      defaultValue: "Müşterinin göreceği hizmet adı",
                                    })}
                                  </p>
                                ) : null}
                              </div>
                              {group.serviceId ? (
                                <div className="flex items-center gap-2">
                                  {!isDisabled ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-2 border-emerald-300 text-emerald-700 bg-white hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                                      onClick={() => handleAddRuleToGroup(group.key)}
                                    >
                                      <Plus className="h-4 w-4" />
                                      {tForms("service.selection_template.add_rule")}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-emerald-700 hover:text-emerald-800"
                                    onClick={() => handleToggleGroupDisabled(group.key, !isDisabled)}
                                  >
                                    {isDisabled
                                      ? t("sessionDetail.gallery.selectionTemplate.enableSelections", {
                                          defaultValue: "Seçime aç",
                                        })
                                      : t("sessionDetail.gallery.selectionTemplate.disableSelections", {
                                          defaultValue: "Seçime kapat",
                                        })}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            {isDisabled ? (
                              <p className="text-xs text-muted-foreground">
                                {t("sessionDetail.gallery.selectionTemplate.disabledHint", {
                                  defaultValue: "Bu hizmet için seçimler kapalı.",
                                })}
                              </p>
                            ) : (
                              <SelectionTemplateSection
                                enabled
                                rules={group.rules}
                                onRulesChange={(rules) => handleSelectionTemplateRulesChange(group.key, rules)}
                                tone="emerald"
                                showHeader={false}
                                showToggle={false}
                                variant="unstyled"
                                showAddButton={false}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {renderManualGroup()}
                </div>
              );
            })()}
          </div>
          <SheetFooter className="mt-auto gap-2 border-t border-border/60 bg-background pt-4 [&>button]:w-full sm:[&>button]:flex-1">
            <Button variant="outline" onClick={() => setSelectionSheetOpen(false)}>
              {t("sessionDetail.gallery.form.cancel")}
            </Button>
            <Button
              onClick={() => {
                setSelectionSettings(selectionDraft);
                const cleanedGroups = cleanSelectionTemplateDraft(selectionTemplateDraft);
                setSelectionTemplateGroups(cleanedGroups);
                setSelectionTemplateDraft(cloneSelectionTemplateGroups(cleanedGroups));
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
