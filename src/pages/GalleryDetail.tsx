import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationTimezone } from "@/hooks/useOrganizationTimezone";
import { TemplateBuilderHeader } from "@/components/template-builder/TemplateBuilderHeader";
import { EmptyStateInfoSheet } from "@/components/empty-states/EmptyStateInfoSheet";
import { NavigationGuardDialog } from "@/components/settings/NavigationGuardDialog";
import {
  FAVORITES_FILTER_ID,
  STARRED_FILTER_ID,
  SelectionDashboard,
  type SelectionRule,
} from "@/components/galleries/SelectionDashboard";
import { Lightbox } from "@/components/galleries/Lightbox";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn, getUserLocale } from "@/lib/utils";
import { buildGalleryProofPath, convertImageToProof, GALLERY_ASSETS_BUCKET, getStorageBasename } from "@/lib/galleryAssets";
import { shouldKeepLocalUploadItem } from "@/lib/galleryUploadQueue";
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
  Clock,
  Loader2,
  Maximize2,
  MoreVertical,
  MoreHorizontal,
  Plus,
  PlusCircle,
  RotateCcw,
  Share2,
  Star,
  Trash2,
  Upload,
  User,
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
  file?: File;
  name: string;
  size: number;
  setId: string | null;
  status: UploadStatus;
  progress: number;
  previewUrl?: string;
  starred?: boolean;
  error?: string | null;
  storagePathWeb?: string | null;
  uploadBatchId?: string;
  enqueuedAt?: number;
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

interface GalleryStorageUsageRow {
  gallery_bytes: number;
  org_bytes: number;
}

interface GalleryAssetRow {
  id: string;
  storage_path_web: string | null;
  width: number | null;
  height: number | null;
  status: "processing" | "ready" | "failed";
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface UpdatePayload {
  title: string;
  type: GalleryType;
  status: GalleryStatus;
  branding: Record<string, unknown>;
  publishedAt?: string | null;
}

const AUTO_SAVE_DELAY = 1200;
const GALLERY_ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_CONCURRENT_UPLOADS = 3;

type UploadBatchMeta = {
  id: string;
  startedAt: number;
};

type UploadBatchStats = {
  batchId: string;
  setId: string;
  startedAt: number;
  total: number;
  uploaded: number;
  errors: number;
  canceled: number;
  inProgress: number;
  completed: number;
  percent: number;
  estimatedRemainingMs: number | null;
};

type UploadBatchSummary = {
  batchId: string;
  uploaded: number;
  total: number;
  errors: number;
  canceled: number;
  completedAt: number;
  photoCountAtCompletion: number;
};

const isUploadInProgress = (status: UploadStatus) =>
  status === "queued" || status === "uploading" || status === "processing";

const isUploadTerminal = (status: UploadStatus) =>
  status === "done" || status === "error" || status === "canceled";

const formatBytes = (bytes: number | null | undefined) => {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "—";
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  const formatter = new Intl.NumberFormat(getUserLocale(), {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  });
  return `${formatter.format(value)} ${units[index]}`;
};

const formatDurationShortTR = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} sn`;
  if (seconds <= 0) return `${minutes} dk`;
  return `${minutes} dk ${seconds} sn`;
};

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

const isImageFile = (file: File) => file.type.startsWith("image/");

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
  const { activeOrganizationId } = useOrganization();
  const { timezone, timeFormat } = useOrganizationTimezone();
  const queryClient = useQueryClient();

  const signedUrlCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());
  const signedUrlRefreshInFlightRef = useRef<Set<string>>(new Set());

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
  const [pendingSelectionRemovalId, setPendingSelectionRemovalId] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(() => new Set());
  const [batchDeleteGuardOpen, setBatchDeleteGuardOpen] = useState(false);
  const [pendingBatchDeleteIds, setPendingBatchDeleteIds] = useState<Set<string> | null>(null);
  const [setDeleteGuardOpen, setSetDeleteGuardOpen] = useState(false);
  const [pendingDeleteSet, setPendingDeleteSet] = useState<{ set: GallerySetRow; count: number } | null>(null);
  const [galleryDeleteGuardOpen, setGalleryDeleteGuardOpen] = useState(false);
  const [galleryDeleteConfirmText, setGalleryDeleteConfirmText] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSetIdRef = useRef<string | null>(null);
  const dropzoneDragDepthRef = useRef(0);
  const canceledUploadIdsRef = useRef<Set<string>>(new Set());
  const [uploadBatchBySetId, setUploadBatchBySetId] = useState<Record<string, UploadBatchMeta>>({});
  const uploadBatchBySetIdRef = useRef<Record<string, UploadBatchMeta>>({});
  const [uploadBatchSummaryBySetId, setUploadBatchSummaryBySetId] = useState<Record<string, UploadBatchSummary>>({});
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
    coverAssetId: null as string | null,
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
    const storedCoverAssetId = typeof branding.coverAssetId === "string" ? branding.coverAssetId : null;
    const parsedTemplateGroups = parseSelectionTemplateGroups(branding);
    setTitle(data.title ?? "");
    setType(data.type);
    setStatus(data.status);
    setEventDate(storedDate);
    setCustomType(storedCustomType);
    setCoverPhotoId((prev) => prev ?? storedCoverAssetId);
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
      coverAssetId: storedCoverAssetId,
      selectionSettings: {
        enabled: Boolean(storedSelection.enabled),
        limit: typeof storedSelection.limit === "number" ? storedSelection.limit : null,
        deadline: typeof storedSelection.deadline === "string" ? storedSelection.deadline : null,
        allowFavorites: storedSelection.allowFavorites !== false,
      },
      selectionTemplateGroups: parsedTemplateGroups,
    });
  }, [data, parseSelectionTemplateGroups]);

  useEffect(() => {
    setCoverPhotoId(null);
    setUploadQueue([]);
    setSelectedBatchIds(new Set());
    setPhotoSelections({});
    setActiveSelectionRuleId(null);
    setPendingSelectionRemovalId(null);
    setPendingBatchDeleteIds(null);
    setBatchDeleteGuardOpen(false);
    canceledUploadIdsRef.current.clear();
    setUploadBatchBySetId({});
    uploadBatchBySetIdRef.current = {};
    setUploadBatchSummaryBySetId({});
  }, [id]);

  const { data: sets, isLoading: setsLoading } = useQuery({
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

  const { data: clientSelections, isLoading: clientSelectionsLoading } = useQuery({
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

  const { data: storageUsage, isLoading: storageUsageLoading } = useQuery({
    queryKey: ["gallery_storage_usage", id],
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<GalleryStorageUsageRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase.rpc("get_gallery_storage_usage", { gallery_uuid: id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      return row ?? null;
    },
  });

  const { data: storedAssets, isLoading: storedAssetsLoading } = useQuery({
    queryKey: ["gallery_assets", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<UploadItem[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("gallery_assets")
        .select("id,storage_path_web,width,height,status,metadata,created_at")
        .eq("gallery_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as GalleryAssetRow[];
      const now = Date.now();
      const signedUrlExpiresAt = now + GALLERY_ASSET_SIGNED_URL_TTL_SECONDS * 1000 - 15_000;
      const signedUrls = await Promise.all(
        rows.map(async (row) => {
          if (!row.storage_path_web) return { id: row.id, signedUrl: "" };
          const cached = signedUrlCacheRef.current.get(row.id);
          if (cached && cached.expiresAt > now) {
            return { id: row.id, signedUrl: cached.url };
          }
          const { data: urlData, error: urlError } = await supabase.storage
            .from(GALLERY_ASSETS_BUCKET)
            .createSignedUrl(row.storage_path_web, GALLERY_ASSET_SIGNED_URL_TTL_SECONDS);
          if (urlError) {
            console.warn("Failed to create signed url for gallery asset", urlError);
            return { id: row.id, signedUrl: "" };
          }
          if (urlData?.signedUrl) {
            signedUrlCacheRef.current.set(row.id, { url: urlData.signedUrl, expiresAt: signedUrlExpiresAt });
          }
          return { id: row.id, signedUrl: urlData.signedUrl };
        })
      );
      const signedUrlById = new Map(signedUrls.map((entry) => [entry.id, entry.signedUrl]));

      return rows.map((row) => {
        const metadata = row.metadata ?? {};
        const originalName = typeof metadata.originalName === "string" ? metadata.originalName : null;
        const setId = typeof metadata.setId === "string" ? metadata.setId : null;
        const name = originalName || (row.storage_path_web ? getStorageBasename(row.storage_path_web) : "photo");
        const size =
          typeof metadata.proofSize === "number"
            ? metadata.proofSize
            : typeof metadata.originalSize === "number"
              ? metadata.originalSize
              : 0;
        const starred = metadata.starred === true;
        const status: UploadStatus =
          row.status === "ready" ? "done" : row.status === "failed" ? "error" : "processing";

        const signedUrl = signedUrlById.get(row.id);

        return {
          id: row.id,
          name,
          size,
          setId,
          status,
          progress: status === "done" ? 100 : status === "error" ? 0 : 50,
          previewUrl: signedUrl || undefined,
          starred,
          error: status === "error" ? "Upload failed" : null,
          storagePathWeb: row.storage_path_web,
        };
      });
    },
  });

  useLayoutEffect(() => {
    if (!storedAssets) return;
    setUploadQueue((prev) => {
      if (prev.length === 0) return storedAssets;
      const prevById = new Map(prev.map((item) => [item.id, item]));
      const storedById = new Map(storedAssets.map((item) => [item.id, item]));

      const merged = storedAssets.map((stored) => {
        const local = prevById.get(stored.id);
        if (!local) return stored;

        const localInFlight =
          Boolean(local.file) && (local.status === "queued" || local.status === "processing" || local.status === "uploading");
        const localTerminal = local.status === "done" || local.status === "error" || local.status === "canceled";
        const storedTerminal = stored.status === "done" || stored.status === "error";

        const status = storedTerminal ? stored.status : localInFlight || localTerminal ? local.status : stored.status;
        const progress = storedTerminal ? stored.progress : localInFlight || localTerminal ? local.progress : stored.progress;

        const localPreviewUrl = local.previewUrl;
        const storedPreviewUrl = stored.previewUrl;
        const hasLocalPreview = typeof localPreviewUrl === "string" && localPreviewUrl.length > 0;
        const hasStoredPreview = typeof storedPreviewUrl === "string" && storedPreviewUrl.length > 0;
        const localPreviewIsBlob = hasLocalPreview && localPreviewUrl.startsWith("blob:");
        const keepBlobPreview = localPreviewIsBlob && (Boolean(local.file) || localTerminal);
        const previewUrl = hasLocalPreview && (!localPreviewIsBlob || keepBlobPreview || !hasStoredPreview)
          ? localPreviewUrl
          : storedPreviewUrl;

        return {
          ...stored,
          ...local,
          status,
          progress,
          previewUrl,
          storagePathWeb: local.storagePathWeb ?? stored.storagePathWeb,
        };
      });

      prev.forEach((item) => {
        if (storedById.has(item.id)) return;

        const shouldKeepLocal = shouldKeepLocalUploadItem(item);

        if (shouldKeepLocal) {
          merged.push(item);
          return;
        }

        if (item.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      return merged;
    });
  }, [storedAssets]);

  const galleryBytesFallback = useMemo(
    () =>
      uploadQueue.reduce((sum, item) => {
        if (item.status !== "done") return sum;
        if (!Number.isFinite(item.size) || item.size <= 0) return sum;
        return sum + item.size;
      }, 0),
    [uploadQueue]
  );

  const galleryBytes = storageUsage?.gallery_bytes ?? galleryBytesFallback;
  const orgBytes = storageUsage?.org_bytes ?? null;

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
    setPendingSelectionRemovalId(null);
    setIsDropzoneActive(false);
    dropzoneDragDepthRef.current = 0;
  }, [activeSelectionRuleId, activeSetId]);

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
  const displayTitle =
    title.trim() || t("sessionDetail.gallery.form.titlePlaceholder", { defaultValue: "Untitled gallery" });
  const brandingData = (data?.branding || {}) as Record<string, unknown>;
  const storedCoverUrl = typeof brandingData.coverUrl === "string" ? brandingData.coverUrl : "";
  const storedCoverAssetId = typeof brandingData.coverAssetId === "string" ? brandingData.coverAssetId : null;
  const resolvedCoverAssetId = coverPhotoId ?? storedCoverAssetId;
  const localCoverUrl = resolvedCoverAssetId
    ? uploadQueue.find((item) => item.id === resolvedCoverAssetId)?.previewUrl ?? ""
    : "";
  const coverUrl = localCoverUrl || storedCoverUrl;

  const selectionPartCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (clientSelections ?? []).forEach((entry) => {
      const key = normalizeSelectionPartKey(entry.selection_part);
      if (!key) return;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [clientSelections]);

  const localRuleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(photoSelections).forEach((ruleIds) => {
      ruleIds.forEach((ruleId) => {
        counts[ruleId] = (counts[ruleId] ?? 0) + 1;
      });
    });
    return counts;
  }, [photoSelections]);

  const localSelectedPhotoCount = useMemo(() => {
    let count = 0;
    Object.values(photoSelections).forEach((ruleIds) => {
      if (ruleIds.some((ruleId) => ruleId !== FAVORITES_FILTER_ID)) {
        count += 1;
      }
    });
    return count;
  }, [photoSelections]);

  const selectionRules = useMemo<SelectionRule[]>(() => {
    const rules: SelectionRule[] = [];

    const addRule = (ruleData: SelectionTemplateRuleForm, ruleId: string, serviceName: string | null) => {
      const part = typeof ruleData.part === "string" ? ruleData.part.trim() : "";
      const normalizedKey = normalizeSelectionPartKey(part);
      const minCount = Math.max(0, parseCountValue(ruleData.min) ?? 0);
      const rawMax = parseCountValue(ruleData.max);
      const maxCount = rawMax != null ? Math.max(rawMax, minCount) : null;
      const dbCount = normalizedKey ? selectionPartCounts[normalizedKey] ?? 0 : 0;
      const localCount = localRuleCounts[ruleId] ?? 0;
      const currentCount = Math.max(dbCount, localCount);
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
  }, [selectionTemplateGroups, selectionPartCounts, localRuleCounts, t]);

  const totalSelectedCount = useMemo(() => {
    if (clientSelections && clientSelections.length > 0) return clientSelections.length;
    if (localSelectedPhotoCount > 0) return localSelectedPhotoCount;
    return selectionRules.reduce((sum, rule) => sum + rule.currentCount, 0);
  }, [clientSelections, localSelectedPhotoCount, selectionRules]);

  const favoritesCount = useMemo(() => {
    const localFavorites = localRuleCounts[FAVORITES_FILTER_ID] ?? 0;
    const favoriteKey = normalizeSelectionPartKey(FAVORITES_FILTER_ID);
    return Math.max(selectionPartCounts[favoriteKey] ?? 0, localFavorites);
  }, [selectionPartCounts, localRuleCounts]);

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

  const localPhotosCount = useMemo(
    () => uploadQueue.filter((item) => item.status !== "canceled").length,
    [uploadQueue]
  );

  const totalPhotosCount = localPhotosCount;

  const hasMedia = localPhotosCount > 0;

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
      coverPhotoId !== baseline.coverAssetId ||
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
      coverPhotoId,
      baseline.coverAssetId,
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
	        updated_at: new Date().toISOString(),
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
        coverAssetId: typeof payload.branding.coverAssetId === "string" ? (payload.branding.coverAssetId as string) : null,
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

  const formattedLastSaved = useMemo(() => {
    if (!lastSavedAt) return "";
    const parsed = new Date(lastSavedAt);
    if (Number.isNaN(parsed.getTime())) return "";
    const locale = getUserLocale();
    const hour12 = timeFormat === "12-hour";

    try {
      return new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12,
      }).format(parsed);
    } catch {
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12,
      }).format(parsed);
    }
  }, [lastSavedAt, timeFormat, timezone]);

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
      if (coverPhotoId) {
        branding.coverAssetId = coverPhotoId;
      } else {
        delete branding.coverAssetId;
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
    coverPhotoId,
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
      const { data: createdSet, error } = await supabase.from("gallery_sets").insert({
        gallery_id: id,
        name: setName.trim(),
        description: setDescription.trim() || null,
        order_index: nextOrder,
      }).select("id,name,description,order_index").single();
      if (error) throw error;
      return createdSet;
    },
    onSuccess: (createdSet) => {
      setIsSetSheetOpen(false);
      setSetName("");
      setSetDescription("");
      setEditingSetId(null);
      if (createdSet?.id) {
        setOrderedSets((prev) => {
          if (prev.some((set) => set.id === createdSet.id)) return prev;
          return [...prev, createdSet];
        });
        setActiveSetId(createdSet.id);
      }
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
      const isFallbackSet = setId === legacyFallbackSetId;
      const idsToDelete = uploadQueueRef.current
        .filter((item) => item.status !== "canceled")
        .filter((item) => item.setId === setId || (isFallbackSet && !item.setId))
        .map((item) => item.id);

      idsToDelete.forEach((assetId) => {
        canceledUploadIdsRef.current.add(assetId);
        clearUploadTimer(assetId);
      });

      if (idsToDelete.length > 0) {
        await deleteGalleryAssets(idsToDelete);
      }

      const { error } = await supabase.from("gallery_sets").delete().eq("id", setId);
      if (error) throw error;
      return idsToDelete;
    },
    onSuccess: (idsToDelete: string[] | undefined, setId: string) => {
      const idsToRemove = new Set(idsToDelete ?? []);

      setCoverPhotoId((prev) => (prev && idsToRemove.has(prev) ? null : prev));
      setPendingSelectionRemovalId((prev) => (prev && idsToRemove.has(prev) ? null : prev));
      setSelectedBatchIds((prev) => {
        if (idsToRemove.size === 0 || prev.size === 0) return prev;
        const next = new Set(prev);
        idsToRemove.forEach((id) => next.delete(id));
        return next;
      });
      setPhotoSelections((prev) => {
        if (idsToRemove.size === 0 || Object.keys(prev).length === 0) return prev;
        const next: Record<string, string[]> = {};
        Object.entries(prev).forEach(([photoId, ruleIds]) => {
          if (!idsToRemove.has(photoId)) {
            next[photoId] = ruleIds;
          }
        });
        return next;
      });
      setUploadQueue((prev) => {
        if (idsToRemove.size === 0) return prev;
        const next: UploadItem[] = [];
        prev.forEach((item) => {
          if (idsToRemove.has(item.id)) {
            if (item.previewUrl?.startsWith("blob:")) {
              URL.revokeObjectURL(item.previewUrl);
            }
            return;
          }
          next.push(item);
        });
        return next;
      });

      queryClient.invalidateQueries({ queryKey: ["gallery_sets", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery_assets", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery_storage_usage", id] });
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

  const previewLabel = useMemo(
    () => t("sessionDetail.gallery.actions.preview", { defaultValue: "Önizle" }),
    [t]
  );

  const handlePreview = useCallback(() => {
    if (!id) return;
    const previewPath = `/galleries/${id}/preview`;
    const win = window.open(previewPath, "_blank", "noopener,noreferrer");
    win?.focus?.();
  }, [id]);

  const expectedGalleryNameForDelete = useMemo(() => title.trim(), [title]);
  const canConfirmGalleryDelete =
    expectedGalleryNameForDelete.length > 0 && galleryDeleteConfirmText.trim() === expectedGalleryNameForDelete;

  const openGalleryDeleteGuard = useCallback(() => {
    setGalleryDeleteConfirmText("");
    setGalleryDeleteGuardOpen(true);
  }, []);

  const closeGalleryDeleteGuard = useCallback(() => {
    setGalleryDeleteGuardOpen(false);
    setGalleryDeleteConfirmText("");
  }, []);

  const listStorageFilesInFolder = useCallback(async (folder: string) => {
    const files: string[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase.storage
        .from(GALLERY_ASSETS_BUCKET)
        .list(folder, { limit, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const rows = data ?? [];
      rows.forEach((entry) => {
        if (entry.id) {
          files.push(`${folder}/${entry.name}`);
        }
      });
      if (rows.length < limit) break;
      offset += limit;
    }

    return files;
  }, []);

  const deleteGalleryMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;

      const sessionId = data?.session_id ?? null;
      let organizationId = activeOrganizationId ?? null;
      if (sessionId) {
        const { data: sessionRow, error: sessionError } = await supabase
          .from("sessions")
          .select("organization_id")
          .eq("id", sessionId)
          .single();
        if (sessionError) throw sessionError;
        organizationId = sessionRow?.organization_id ?? organizationId;
      }

      if (!organizationId) {
        throw new Error("No organization found for this gallery.");
      }

      const basePrefix = `${organizationId}/galleries/${id}`;
      const storagePaths = new Set<string>();

      const { data: assetRows, error: assetError } = await supabase
        .from("gallery_assets")
        .select("storage_path_web,storage_path_original")
        .eq("gallery_id", id);
      if (assetError) throw assetError;

      (assetRows ?? []).forEach((row) => {
        const typedRow = row as { storage_path_web: string | null; storage_path_original: string | null };
        if (typedRow.storage_path_web) storagePaths.add(typedRow.storage_path_web);
        if (typedRow.storage_path_original) storagePaths.add(typedRow.storage_path_original);
      });

      const folderCandidates = [
        basePrefix,
        `${basePrefix}/proof`,
        `${basePrefix}/original`,
      ];

      await Promise.all(
        folderCandidates.map(async (folder) => {
          const files = await listStorageFilesInFolder(folder);
          files.forEach((path) => storagePaths.add(path));
        })
      );

      const pathsToRemove = Array.from(storagePaths);
      const chunkSize = 100;
      for (let index = 0; index < pathsToRemove.length; index += chunkSize) {
        const chunk = pathsToRemove.slice(index, index + chunkSize);
        const { error: removeError } = await supabase.storage.from(GALLERY_ASSETS_BUCKET).remove(chunk);
        if (removeError) throw removeError;
      }

      const { error: deleteError } = await supabase.from("galleries").delete().eq("id", id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      closeGalleryDeleteGuard();
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      if (data?.session_id) {
        queryClient.invalidateQueries({ queryKey: ["galleries", data.session_id] });
        navigate(`/sessions/${data.session_id}`);
      } else {
        navigate("/sessions");
      }
      toast({
        title: t("sessionDetail.gallery.toast.deletedTitle", { defaultValue: "Galeri silindi" }),
        description: t("sessionDetail.gallery.toast.deletedDesc", { defaultValue: "Galeri ve tüm medya kalıcı olarak silindi." }),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const handleAddMedia = useCallback(
    (setId?: string) => {
      if (setId === "default-placeholder") {
        toast({
          title: t("sessionDetail.gallery.toast.errorTitle"),
          description: t("sessionDetail.gallery.toast.errorDesc", {
            defaultValue: "Create a set before uploading.",
          }),
          variant: "destructive",
        });
        return;
      }
      pendingSetIdRef.current = setId ?? null;
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
    (files: FileList | File[], setId?: string | null) => {
      const list = Array.from(files ?? []);
      if (list.length === 0) return;

      const supportedFiles = list.filter(isImageFile);
      const skippedFilesCount = list.length - supportedFiles.length;
      if (skippedFilesCount > 0) {
        toast({
          title: t("sessionDetail.gallery.toast.unsupportedFilesTitle", {
            defaultValue: "Some files were skipped",
          }),
          description: t("sessionDetail.gallery.toast.unsupportedFilesDesc", {
            count: skippedFilesCount,
            defaultValue: "Only images are supported right now.",
          }),
        });
      }

      if (supportedFiles.length === 0) return;
      const resolvedSetId = setId ?? null;
      const now = Date.now();

      let batchId: string | null = null;
      if (resolvedSetId) {
        const existing = uploadBatchBySetIdRef.current[resolvedSetId] ?? null;
        const shouldReuseExisting =
          Boolean(existing) &&
          uploadQueueRef.current.some(
            (item) =>
              item.setId === resolvedSetId &&
              item.uploadBatchId === existing?.id &&
              isUploadInProgress(item.status)
          );

        if (shouldReuseExisting) {
          batchId = existing!.id;
        } else {
          batchId = crypto.randomUUID?.() ?? Math.random().toString(16).slice(2);
          const meta: UploadBatchMeta = { id: batchId, startedAt: now };
          uploadBatchBySetIdRef.current[resolvedSetId] = meta;
          setUploadBatchBySetId((prev) => ({ ...prev, [resolvedSetId]: meta }));
          setUploadBatchSummaryBySetId((prev) => {
            if (!(resolvedSetId in prev)) return prev;
            const next = { ...prev };
            delete next[resolvedSetId];
            return next;
          });
        }
      }

      setUploadQueue((prev) => [
        ...prev,
        ...supportedFiles.map((file) => {
          const id = crypto.randomUUID?.() ?? Math.random().toString(16).slice(2);
          return {
            id,
            file,
            name: file.name,
            size: file.size,
            setId: resolvedSetId,
            status: "queued" as UploadStatus,
            progress: 0,
            previewUrl: URL.createObjectURL(file),
            starred: false,
            error: null,
            uploadBatchId: batchId ?? undefined,
            enqueuedAt: now,
          };
        }),
      ]);
    },
    [t, toast]
  );

  const clearUploadTimer = useCallback((id: string) => {
    const timer = uploadTimersRef.current[id];
    if (timer) {
      window.clearInterval(timer);
      delete uploadTimersRef.current[id];
    }
  }, []);

  useEffect(() => {
    Object.keys(uploadTimersRef.current).forEach((uploadId) => clearUploadTimer(uploadId));
  }, [id, clearUploadTimer]);

  const startUpload = useCallback(
    async (item: UploadItem) => {
      if (!id) return;
      if (!activeOrganizationId) {
        setUploadQueue((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: "error",
                  progress: 0,
                  error: t("sessionDetail.gallery.toast.errorDesc", { defaultValue: "No active organization found." }),
                }
              : entry
          )
        );
        return;
      }

      const current = uploadQueueRef.current.find((entry) => entry.id === item.id);
      if (!current || current.status !== "queued") return;
      if (!current.file) {
        setUploadQueue((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "error", progress: 0, error: t("sessionDetail.gallery.toast.errorDesc") }
              : entry
          )
        );
        return;
      }

      const assetId = current.id;
      const sourceFile = current.file;

      clearUploadTimer(assetId);
      setUploadQueue((prev) =>
        prev.map((entry) =>
          entry.id === assetId ? { ...entry, status: "processing", progress: Math.max(entry.progress, 5), error: null } : entry
        )
      );

      try {
        const proof = await convertImageToProof(sourceFile);
        if (canceledUploadIdsRef.current.has(assetId)) return;

        const storagePathWeb = buildGalleryProofPath({
          organizationId: activeOrganizationId,
          galleryId: id,
          assetId,
          extension: proof.extension,
        });

        setUploadQueue((prev) =>
          prev.map((entry) =>
            entry.id === assetId
              ? {
                  ...entry,
                  status: "uploading",
                  progress: Math.max(entry.progress, 15),
                  error: null,
                  storagePathWeb,
                }
              : entry
          )
        );

        const timer = window.setInterval(() => {
          setUploadQueue((prev) =>
            prev.map((entry) => {
              if (entry.id !== assetId) return entry;
              if (entry.status !== "uploading") return entry;
              const next = Math.min(95, entry.progress + Math.random() * 8 + 4);
              return { ...entry, progress: next };
            })
          );
        }, 450);
        uploadTimersRef.current[assetId] = timer;

        const { error: uploadError } = await supabase.storage
          .from(GALLERY_ASSETS_BUCKET)
          .upload(storagePathWeb, proof.blob, {
            contentType: proof.contentType,
            cacheControl: "3600",
            upsert: true,
          });
        if (uploadError) throw uploadError;

        if (canceledUploadIdsRef.current.has(assetId)) {
          await supabase.storage.from(GALLERY_ASSETS_BUCKET).remove([storagePathWeb]);
          return;
        }

        const metadata = {
          originalName: sourceFile.name,
          originalSize: sourceFile.size,
          originalType: sourceFile.type,
          proofSize: proof.blob.size,
          proofType: proof.contentType,
          setId: current.setId,
          starred: Boolean(current.starred),
        };

        const { error: upsertError } = await supabase
          .from("gallery_assets")
          .upsert(
            {
              id: assetId,
              gallery_id: id,
              storage_path_web: storagePathWeb,
              width: proof.width,
              height: proof.height,
              status: "ready",
              metadata,
            },
            { onConflict: "id" }
          );
        if (upsertError) {
          await supabase.storage.from(GALLERY_ASSETS_BUCKET).remove([storagePathWeb]);
          throw upsertError;
        }

        clearUploadTimer(assetId);
        setUploadQueue((prev) =>
          prev.map((entry) => {
            if (entry.id !== assetId) return entry;
            return {
              ...entry,
              status: "done",
              progress: 100,
              size: proof.blob.size,
              file: undefined,
              storagePathWeb,
            };
          })
        );
      } catch (error: unknown) {
        clearUploadTimer(assetId);
        const message =
          error instanceof Error
            ? error.message
            : t("sessionDetail.gallery.toast.errorDesc", { defaultValue: "Upload failed." });
        setUploadQueue((prev) =>
          prev.map((entry) =>
            entry.id === assetId ? { ...entry, status: "error", progress: 0, error: message } : entry
          )
        );
      }
    },
    [activeOrganizationId, clearUploadTimer, id, t]
  );

  const handleCancelUpload = useCallback(
    (id: string) => {
      canceledUploadIdsRef.current.add(id);
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
      if (!target?.file) {
        toast({
          title: t("sessionDetail.gallery.toast.errorTitle"),
          description: t("sessionDetail.gallery.toast.errorDesc", {
            defaultValue: "Retry requires the original file. Please re-add it.",
          }),
          variant: "destructive",
        });
        return;
      }
      canceledUploadIdsRef.current.delete(id);
      setUploadQueue((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, status: "queued", progress: 0, error: null } : entry))
      );
    },
    [uploadQueue, toast, t]
  );

  const handleToggleStar = useCallback((id: string) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, starred: !item.starred } : item))
    );
  }, []);

  const deleteGalleryAssets = useCallback(
    async (assetIds: string[]) => {
      if (!id || assetIds.length === 0) return;

      const { data: rows, error: fetchError } = await supabase
        .from("gallery_assets")
        .select("id,storage_path_web,storage_path_original")
        .eq("gallery_id", id)
        .in("id", assetIds);
      if (fetchError) throw fetchError;

      const storagePaths = (rows ?? [])
        .flatMap((row) => [row.storage_path_web, row.storage_path_original])
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from(GALLERY_ASSETS_BUCKET).remove(storagePaths);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from("gallery_assets")
        .delete()
        .eq("gallery_id", id)
        .in("id", assetIds);
      if (deleteError) throw deleteError;

      queryClient.invalidateQueries({ queryKey: ["gallery_assets", id] });
      queryClient.invalidateQueries({ queryKey: ["gallery_storage_usage", id] });
    },
    [id, queryClient]
  );

  const handleDeleteUpload = useCallback(
    (assetId: string) => {
      canceledUploadIdsRef.current.add(assetId);
      clearUploadTimer(assetId);
      setCoverPhotoId((prev) => (prev === assetId ? null : prev));
      setPendingSelectionRemovalId((prev) => (prev === assetId ? null : prev));
      setSelectedBatchIds((prev) => {
        if (!prev.has(assetId)) return prev;
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
      setPhotoSelections((prev) => {
        if (!(assetId in prev)) return prev;
        const { [assetId]: _removed, ...rest } = prev;
        return rest;
      });

      setUploadQueue((prev) => {
        const target = prev.find((item) => item.id === assetId);
        if (target?.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(target.previewUrl);
        }
        return prev.filter((item) => item.id !== assetId);
      });

      void deleteGalleryAssets([assetId]).catch((error: unknown) => {
        toast({
          title: t("sessionDetail.gallery.toast.errorTitle"),
          description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
          variant: "destructive",
        });
      });
    },
    [clearUploadTimer, deleteGalleryAssets, t, toast]
  );

  const handleSetCover = useCallback((photoId: string) => {
    setCoverPhotoId(photoId);
  }, []);

  const refreshPreviewUrl = useCallback(
    (photoId: string) => {
      const current = uploadQueueRef.current.find((item) => item.id === photoId);
      if (!current) return;

      if (current.file) {
        setUploadQueue((prev) =>
          prev.map((item) => {
            if (item.id !== photoId) return item;
            if (!item.file) return item;
            if (item.previewUrl?.startsWith("blob:")) {
              URL.revokeObjectURL(item.previewUrl);
            }
            return { ...item, previewUrl: URL.createObjectURL(item.file) };
          })
        );
        return;
      }

      if (!current.storagePathWeb) return;
      if (signedUrlRefreshInFlightRef.current.has(photoId)) return;

      signedUrlRefreshInFlightRef.current.add(photoId);
      void (async () => {
        const { data: urlData, error } = await supabase.storage
          .from(GALLERY_ASSETS_BUCKET)
          .createSignedUrl(current.storagePathWeb, GALLERY_ASSET_SIGNED_URL_TTL_SECONDS);
        if (error || !urlData?.signedUrl) return;

        signedUrlCacheRef.current.set(photoId, {
          url: urlData.signedUrl,
          expiresAt: Date.now() + GALLERY_ASSET_SIGNED_URL_TTL_SECONDS * 1000 - 15_000,
        });

        setUploadQueue((prev) => prev.map((item) => (item.id === photoId ? { ...item, previewUrl: urlData.signedUrl } : item)));
      })().finally(() => {
        signedUrlRefreshInFlightRef.current.delete(photoId);
      });
    },
    []
  );

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

  useEffect(() => {
    if (
      pendingSelectionRemovalId &&
      activeSelectionRuleId &&
      !(photoSelections[pendingSelectionRemovalId] ?? []).includes(activeSelectionRuleId)
    ) {
      setPendingSelectionRemovalId(null);
    }
  }, [pendingSelectionRemovalId, activeSelectionRuleId, photoSelections]);

  const starredUploadCount = useMemo(
    () => uploadQueue.filter((item) => item.starred && item.status === "done").length,
    [uploadQueue]
  );

  const legacyFallbackSetId = visibleSets[0]?.id ?? null;

  const uploadsBySetId = useMemo(() => {
    const counts: Record<string, number> = {};
    uploadQueue.forEach((item) => {
      if (item.status === "canceled") return;
      const resolvedSetId = item.setId ?? legacyFallbackSetId;
      if (!resolvedSetId) return;
      counts[resolvedSetId] = (counts[resolvedSetId] ?? 0) + 1;
    });
    return counts;
  }, [uploadQueue, legacyFallbackSetId]);

  const uploadProgressBySetId = useMemo(() => {
    const aggregates: Record<string, { total: number; inProgress: number; sumProgress: number }> = {};

    const getAggregate = (setId: string) => {
      if (!aggregates[setId]) {
        aggregates[setId] = { total: 0, inProgress: 0, sumProgress: 0 };
      }
      return aggregates[setId];
    };

    uploadQueue.forEach((item) => {
      if (item.status === "canceled") return;
      const resolvedSetId = item.setId ?? legacyFallbackSetId;
      if (!resolvedSetId) return;

      const aggregate = getAggregate(resolvedSetId);
      aggregate.total += 1;

      const isInProgress =
        item.status === "queued" || item.status === "uploading" || item.status === "processing";
      if (isInProgress) {
        aggregate.inProgress += 1;
        aggregate.sumProgress += Math.max(0, Math.min(100, item.progress));
        return;
      }

      aggregate.sumProgress += 100;
    });

    const result: Record<string, { percent: number; inProgress: number; total: number }> = {};
    Object.entries(aggregates).forEach(([setId, aggregate]) => {
      result[setId] = {
        percent: aggregate.total > 0 ? aggregate.sumProgress / aggregate.total : 0,
        inProgress: aggregate.inProgress,
        total: aggregate.total,
      };
    });
    return result;
  }, [uploadQueue, legacyFallbackSetId]);

  const uploadBatchStatsBySetId = useMemo(() => {
    const result: Record<string, UploadBatchStats> = {};
    const now = Date.now();

    Object.entries(uploadBatchBySetId).forEach(([setId, batch]) => {
      const items = uploadQueue.filter((item) => item.setId === setId && item.uploadBatchId === batch.id);
      if (items.length === 0) return;

      const total = items.length;
      let uploaded = 0;
      let errors = 0;
      let canceled = 0;
      let inProgress = 0;
      let progressSum = 0;

      items.forEach((item) => {
        if (isUploadInProgress(item.status)) {
          inProgress += 1;
        }
        if (item.status === "done") uploaded += 1;
        if (item.status === "error") errors += 1;
        if (item.status === "canceled") canceled += 1;

        const contribution = isUploadTerminal(item.status)
          ? 100
          : Math.max(0, Math.min(100, item.progress));
        progressSum += contribution;
      });

      const completed = uploaded + errors + canceled;
      const percent = total > 0 ? progressSum / total : 0;

      const remaining = Math.max(0, total - completed);
      const elapsedMs = Math.max(0, now - batch.startedAt);
      const estimatedRemainingMs =
        completed > 0 && remaining > 0 ? (elapsedMs / completed) * remaining : null;

      result[setId] = {
        batchId: batch.id,
        setId,
        startedAt: batch.startedAt,
        total,
        uploaded,
        errors,
        canceled,
        inProgress,
        completed,
        percent,
        estimatedRemainingMs,
      };
    });

    return result;
  }, [uploadBatchBySetId, uploadQueue]);

  useEffect(() => {
    setUploadBatchSummaryBySetId((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(uploadBatchStatsBySetId).forEach(([setId, stats]) => {
        const isCompleted = stats.total > 0 && stats.inProgress === 0 && stats.completed >= stats.total;
        if (!isCompleted) return;
        if (prev[setId]?.batchId === stats.batchId) return;
        next[setId] = {
          batchId: stats.batchId,
          uploaded: stats.uploaded,
          total: stats.total,
          errors: stats.errors,
          canceled: stats.canceled,
          completedAt: Date.now(),
          photoCountAtCompletion: uploadsBySetId[setId] ?? 0,
        };
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [uploadBatchStatsBySetId, uploadsBySetId]);

  useEffect(() => {
    setUploadBatchSummaryBySetId((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;

      let changed = false;
      const next = { ...prev };

      entries.forEach(([setId, summary]) => {
        const currentCount = uploadsBySetId[setId] ?? 0;
        if (summary.photoCountAtCompletion !== currentCount) {
          delete next[setId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [uploadsBySetId]);

  const uploadsForActiveSet = useMemo(() => {
    const activeSetIdValue = activeSet?.id ?? null;
    if (!activeSetIdValue) return uploadQueue;
    return uploadQueue.filter((item) => {
      const resolvedSetId = item.setId ?? legacyFallbackSetId;
      return !resolvedSetId || resolvedSetId === activeSetIdValue;
    });
  }, [uploadQueue, activeSet?.id, legacyFallbackSetId]);

	  const filteredUploads = useMemo(() => {
	    if (!activeSelectionRuleId) return uploadsForActiveSet;
	    const baseUploads = uploadQueue;
	    if (activeSelectionRuleId === STARRED_FILTER_ID) {
	      return baseUploads.filter((item) => item.starred);
	    }
	    if (activeSelectionRuleId === FAVORITES_FILTER_ID) {
	      return baseUploads.filter((item) => (photoSelections[item.id] ?? []).includes(FAVORITES_FILTER_ID));
	    }
	    return baseUploads.filter((item) =>
	      (photoSelections[item.id] ?? []).includes(activeSelectionRuleId)
	    );
	  }, [uploadsForActiveSet, uploadQueue, activeSelectionRuleId, photoSelections]);

  const activeFilterMeta = useMemo(() => {
    if (!activeSelectionRuleId) return null;
    if (activeSelectionRuleId === FAVORITES_FILTER_ID) {
      return {
        serviceName: null,
        title: t("sessionDetail.gallery.selection.favoritesHeader", {
          defaultValue: "Müşteri Favorileri",
        }),
        kind: "favorites" as const,
      };
    }
    if (activeSelectionRuleId === STARRED_FILTER_ID) {
      return {
        serviceName: null,
        title: t("sessionDetail.gallery.selection.starredHeader", {
          defaultValue: "Yıldızlı Fotoğraflar",
        }),
        kind: "starred" as const,
      };
    }
    const targetRule = selectionRules.find((rule) => rule.id === activeSelectionRuleId);
    return {
      serviceName: targetRule?.serviceName ?? null,
      title: targetRule?.title ?? t("sessionDetail.gallery.selection.filterHeader", { defaultValue: "Seçimler" }),
      kind: "rule" as const,
    };
  }, [activeSelectionRuleId, selectionRules, t]);

  const activeHeaderCount = useMemo(() => {
    if (!activeSelectionRuleId) {
      const setId = activeSet?.id ?? null;
      if (setId) return uploadsBySetId[setId] ?? 0;
      return uploadQueue.filter((item) => item.status !== "canceled").length;
    }
    if (activeSelectionRuleId === FAVORITES_FILTER_ID) return favoritesCount;
    if (activeSelectionRuleId === STARRED_FILTER_ID) return starredUploadCount;
    const targetRule = selectionRules.find((rule) => rule.id === activeSelectionRuleId);
    return targetRule?.currentCount ?? filteredUploads.length;
  }, [
    activeSelectionRuleId,
    activeSet?.id,
    uploadsBySetId,
    uploadQueue,
    favoritesCount,
    starredUploadCount,
    selectionRules,
    filteredUploads.length,
  ]);

  const activeSetUploadBatch = useMemo(() => {
    if (activeSelectionRuleId) return null;
    const setId = activeSet?.id ?? null;
    if (!setId) return null;
    return uploadBatchStatsBySetId[setId] ?? null;
  }, [activeSelectionRuleId, activeSet?.id, uploadBatchStatsBySetId]);

  const activeSetUploadSummary = useMemo(() => {
    if (activeSelectionRuleId) return null;
    const setId = activeSet?.id ?? null;
    if (!setId) return null;
    return uploadBatchSummaryBySetId[setId] ?? null;
  }, [activeSelectionRuleId, activeSet?.id, uploadBatchSummaryBySetId]);

  const showActiveUploadBanner = Boolean(activeSetUploadBatch && activeSetUploadBatch.inProgress > 0);
  const showActiveUploadSummaryChip = Boolean(
    activeSetUploadSummary &&
      !showActiveUploadBanner &&
      (uploadsBySetId[activeSet?.id ?? ""] ?? 0) === activeSetUploadSummary.photoCountAtCompletion
  );
  const activeUploadEstimateLabel =
    activeSetUploadBatch?.estimatedRemainingMs != null
      ? formatDurationShortTR(activeSetUploadBatch.estimatedRemainingMs)
      : null;

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
      const idsArray = Array.from(idsToDelete);
	    setBatchDeleteGuardOpen(false);
	    setPendingBatchDeleteIds(null);
	    setSelectedBatchIds(new Set());
	    setCoverPhotoId((prev) => (prev && idsToDelete.has(prev) ? null : prev));

	    window.setTimeout(() => {
	      setUploadQueue((prev) => {
	        prev.forEach((item) => {
	          if (idsToDelete.has(item.id) && item.previewUrl?.startsWith("blob:")) {
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

      void deleteGalleryAssets(idsArray).catch((error: unknown) => {
        toast({
          title: t("sessionDetail.gallery.toast.errorTitle"),
          description: error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc"),
          variant: "destructive",
        });
      });
  }, [pendingBatchDeleteIds, closeBatchDeleteGuard, deleteGalleryAssets, t, toast]);

  const openLightboxAt = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const lightboxPhotos = useMemo(
    () =>
      filteredUploads.map((item) => {
        const selectedRuleIds = photoSelections[item.id] ?? [];
        return {
          id: item.id,
          url: item.previewUrl ?? "",
          filename: item.name,
          isFavorite: selectedRuleIds.includes(FAVORITES_FILTER_ID),
          isStarred: Boolean(item.starred),
          selections: selectedRuleIds.filter((ruleId) => ruleId !== FAVORITES_FILTER_ID),
        };
      }),
    [filteredUploads, photoSelections]
  );

  const handleLightboxNavigate = useCallback(
    (nextIndex: number) => {
      setLightboxIndex(() => {
        if (lightboxPhotos.length === 0) return 0;
        return Math.max(0, Math.min(nextIndex, lightboxPhotos.length - 1));
      });
    },
    [lightboxPhotos.length]
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    if (lightboxPhotos.length === 0) {
      setLightboxOpen(false);
      setLightboxIndex(0);
      return;
    }
    setLightboxIndex((prev) => Math.min(prev, lightboxPhotos.length - 1));
  }, [lightboxOpen, lightboxPhotos.length]);

  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
    const inflightCount = uploadQueue.filter((item) => item.status === "processing" || item.status === "uploading").length;
    const availableSlots = Math.max(0, MAX_CONCURRENT_UPLOADS - inflightCount);
    if (availableSlots === 0) return;
    const queued = uploadQueue.filter((item) => item.status === "queued").slice(0, availableSlots);
    queued.forEach((item) => {
      void startUpload(item);
    });
  }, [startUpload, uploadQueue]);

  useEffect(
    () => () => {
      uploadQueueRef.current.forEach((item) => {
        if (item.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      });
      Object.keys(uploadTimersRef.current).forEach((id) => clearUploadTimer(id));
    },
    [clearUploadTimer]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        pendingSetIdRef.current = null;
        return;
      }
      const targetSetId = pendingSetIdRef.current;
      pendingSetIdRef.current = null;
      enqueueUploads(files, targetSetId);
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
      const count = uploadsBySetId[set.id] ?? 0;
      if (count > 0) {
        setPendingDeleteSet({ set, count });
        setSetDeleteGuardOpen(true);
        return;
      }
      deleteSetMutation.mutate(set.id);
    },
    [deleteSetMutation, visibleSets.length, uploadsBySetId, t, toast]
  );

  const closeSetDeleteGuard = useCallback(() => {
    setSetDeleteGuardOpen(false);
    setPendingDeleteSet(null);
  }, []);

  const confirmSetDelete = useCallback(() => {
    if (!pendingDeleteSet) {
      closeSetDeleteGuard();
      return;
    }
    deleteSetMutation.mutate(pendingDeleteSet.set.id);
    closeSetDeleteGuard();
  }, [pendingDeleteSet, deleteSetMutation, closeSetDeleteGuard]);

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

  if (isLoading || setsLoading || storedAssetsLoading) {
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
	        isDraft={status === "draft"}
	        draftLabel={draftLabel}
	        publishedLabel={publishedOrArchivedLabel}
        backLabel={backLabel}
        publishLabel={previewLabel}
        doneLabel={previewLabel}
        onBack={handleBack}
        onPrimaryAction={handlePreview}
        primaryDisabled={deleteGalleryMutation.isPending}
        primaryClassName="hover:!bg-muted/80 hover:!text-foreground"
        primaryLeftActions={
          <Button
            type="button"
            onClick={openGalleryDeleteGuard}
            variant="surface"
            size="sm"
            className="btn-surface-destructive"
            disabled={deleteGalleryMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            {t("sessionDetail.gallery.actions.delete", { defaultValue: "Galeriyi sil" })}
          </Button>
        }
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
            disabled={deleteGalleryMutation.isPending}
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
	                  <img
	                    src={coverUrl}
	                    alt={displayTitle}
                      loading="lazy"
                      decoding="async"
	                    className="h-full w-full object-cover"
	                    onError={() => {
	                      if (coverPhotoId) refreshPreviewUrl(coverPhotoId);
	                    }}
	                  />
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
                            const isFilterMode = Boolean(activeSelectionRuleId);
                            const isActiveSetVisual = !isFilterMode && activeSet?.id === set.id;
	                            const setUploadCount = uploadsBySetId[set.id] ?? 0;
	                            const setUploadProgress = uploadProgressBySetId[set.id];
	                            const showSetProgress = Boolean(setUploadProgress && setUploadProgress.inProgress > 0);
	                            return (
	                            <div
	                              ref={dragProvided.innerRef}
	                                  {...dragProvided.draggableProps}
	                                  style={dragProvided.draggableProps.style}
	                                  className={cn(
	                                    "group relative overflow-hidden rounded-lg border border-border/60 bg-background px-3 py-2.5 shadow-sm transition-shadow",
	                                    snapshot.isDragging && "shadow-md ring-2 ring-primary/20"
	                                  )}
	                                  onClick={() => {
	                                    if (isFilterMode) {
	                                      setActiveSelectionRuleId(null);
	                                    }
	                                    setActiveSetId(set.id);
	                                  }}
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
                                      <div className="flex min-w-0 items-center gap-2">
                                        <p
                                          className={cn(
                                            "min-w-0 truncate text-sm font-semibold",
                                            isActiveSetVisual ? "text-primary" : "text-foreground"
                                          )}
                                        >
                                          {set.name}
                                        </p>
                                        {setUploadCount > 0 ? (
                                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                                            {setUploadCount}
                                          </span>
                                        ) : null}
                                      </div>
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
	                                          setActiveSetId(set.id);
	                                          handleAddMedia(set.id);
	                                        }}
	                                      >
	                                        <ImageUp className="h-4 w-4" />
	                                      </Button>
	                                    </div>
	                                  </div>
	                                  {showSetProgress ? (
	                                    <div className="pointer-events-none absolute inset-x-0 bottom-0">
	                                      <Progress value={setUploadProgress?.percent ?? 0} className="h-1 rounded-none bg-muted/50" />
	                                    </div>
                                  ) : null}
                                </div>
                                );
                              }}
	                            </Draggable>
	                          ))}
                          <div className="flex items-center gap-2 px-1 pt-1 text-[11px] text-muted-foreground/70">
                            <span className="truncate">
                              {t("sessionDetail.gallery.storage.galleryLabel", { defaultValue: "Galeri" })}{" "}
                              {formatBytes(galleryBytes)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">
                              {t("sessionDetail.gallery.storage.totalLabel", { defaultValue: "Toplam" })}{" "}
                              {formatBytes(orgBytes)}
                            </span>
                          </div>
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
	            {type === "proof" && totalPhotosCount > 0 ? (
	              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
	                <SelectionDashboard
	                  rules={selectionRules}
	                  favoritesCount={favoritesCount}
	                  starredCount={starredUploadCount}
	                  totalPhotos={totalPhotosCount}
	                  totalSelected={totalSelectedCount}
	                  activeRuleId={activeSelectionRuleId}
	                  onSelectRuleFilter={setActiveSelectionRuleId}
	                />
	              </div>
	            ) : null}

	            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
	              <div className="space-y-4">
	                {activeSet ? (
	                  <div
	                    className="space-y-4 rounded-xl"
		                    onDragEnter={(event) => {
		                      if (activeSelectionRuleId) return;
		                      event.preventDefault();
		                      dropzoneDragDepthRef.current += 1;
		                      setIsDropzoneActive(true);
	                    }}
	                    onDragLeave={(event) => {
	                      if (activeSelectionRuleId) return;
	                      event.preventDefault();
	                      dropzoneDragDepthRef.current = Math.max(0, dropzoneDragDepthRef.current - 1);
	                      if (dropzoneDragDepthRef.current === 0) {
	                        setIsDropzoneActive(false);
	                      }
	                    }}
	                    onDragOver={(event) => {
	                      if (activeSelectionRuleId) return;
	                      event.preventDefault();
	                    }}
	                    onDrop={(event) => {
	                      event.preventDefault();
	                      dropzoneDragDepthRef.current = 0;
	                      setIsDropzoneActive(false);
	                      if (activeSelectionRuleId) return;
	                      if (event.dataTransfer.files?.length) {
                          if (activeSet.id === "default-placeholder") {
                            toast({
                              title: t("sessionDetail.gallery.toast.errorTitle"),
                              description: t("sessionDetail.gallery.toast.errorDesc", {
                                defaultValue: "Create a set before uploading.",
                              }),
                              variant: "destructive",
                            });
                            return;
                          }
	                        enqueueUploads(event.dataTransfer.files, activeSet.id);
	                      }
	                    }}
	                  >
	                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
	                      <div className="min-w-0 space-y-0.5">
	                        {activeFilterMeta?.serviceName ? (
	                          <span
	                            className={cn(
	                              "text-[10px] font-bold uppercase tracking-wider",
	                              activeFilterMeta.kind === "favorites"
	                                ? "text-rose-600"
	                                : activeFilterMeta.kind === "starred"
	                                  ? "text-amber-600"
	                                  : "text-primary"
	                            )}
	                          >
	                            {activeFilterMeta.serviceName}
	                          </span>
	                        ) : null}
	                        <div className="flex min-w-0 items-center gap-2">
	                          <p className="truncate text-lg font-semibold text-foreground">
	                            {activeFilterMeta ? activeFilterMeta.title : activeSet.name}
	                          </p>
	                            {!activeFilterMeta && showActiveUploadSummaryChip && activeSetUploadSummary ? (
	                              <span
	                                className={cn(
	                                  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold",
	                                  activeSetUploadSummary.errors + activeSetUploadSummary.canceled > 0
	                                    ? "border border-amber-200 bg-amber-50 text-amber-800"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                )}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {activeSetUploadSummary.errors + activeSetUploadSummary.canceled > 0
                                  ? `${activeSetUploadSummary.uploaded}/${activeSetUploadSummary.total} yüklendi`
                                  : `${activeSetUploadSummary.total} fotoğraf yüklendi`}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold",
                                  activeFilterMeta?.kind === "favorites"
                                    ? "bg-rose-50 text-rose-600"
                                    : activeFilterMeta?.kind === "starred"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-muted text-muted-foreground"
                                )}
                              >
                                {activeHeaderCount}
                              </span>
                            )}
	                          {!activeFilterMeta && activeSet.id === "default-placeholder" ? (
	                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] uppercase">
	                              {t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Default" })}
	                            </Badge>
	                          ) : null}
	                        </div>
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

                      {!activeSelectionRuleId ? (
                        <>
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
                            disabled={
                              visibleSets.length <= 1 ||
                              activeSet.id === "default-placeholder" ||
                              deleteSetMutation.isPending
                            }
                            onClick={() => handleDeleteSet(activeSet)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="surface"
                            size="sm"
                            className="gap-2"
                            disabled={activeSet.id === "default-placeholder"}
                            onClick={() => handleAddMedia(activeSet.id)}
                          >
                            <ImageIcon className="h-4 w-4" />
                            {t("sessionDetail.gallery.labels.addMedia")}
                          </Button>
                        </>
	                      ) : null}
	                    </div>
	                  </div>
	
	                  {showActiveUploadBanner ? (
	                    <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 shadow-sm duration-300">
	                      <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div className="min-w-0 space-y-0.5">
	                          <p className="text-sm font-semibold text-foreground">
	                            {t("sessionDetail.gallery.upload.banner.title", {
	                              defaultValue: "Fotoğraflar yükleniyor",
	                            })}
	                          </p>
	                          <p className="text-xs text-muted-foreground">
	                            {t("sessionDetail.gallery.upload.banner.description", {
	                              defaultValue:
	                                "Lütfen bu sayfayı kapatmayın, farklı bir sete geçebilirsiniz.",
	                            })}
	                          </p>
	                        </div>
	                        <div className="shrink-0 text-right">
	                          <p className="text-sm font-semibold tabular-nums text-foreground">
	                            {activeSetUploadBatch ? `${activeSetUploadBatch.uploaded}/${activeSetUploadBatch.total}` : "0/0"}
	                          </p>
	                          {activeUploadEstimateLabel ? (
	                            <p className="text-xs text-muted-foreground">
	                              {t("sessionDetail.gallery.upload.banner.remaining", {
	                                defaultValue: "Kalan ~{{duration}}",
	                                duration: activeUploadEstimateLabel,
	                              })}
	                            </p>
	                          ) : null}
	                        </div>
	                      </div>
	                      <div className="pt-3">
	                        <Progress value={activeSetUploadBatch?.percent ?? 0} className="h-2 bg-muted/60" />
	                      </div>
	                    </div>
	                  ) : null}

	                    <div
	                      className={cn(
	                        "relative rounded-3xl transition-colors",
	                        isDropzoneActive && !activeSelectionRuleId && "bg-emerald-50/40 p-1 ring-2 ring-emerald-200"
	                      )}
	                    >
	                      {isDropzoneActive && !activeSelectionRuleId ? (
	                        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-emerald-500/10 backdrop-blur-sm">
	                          <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-white/80 px-6 py-4 text-center shadow-sm">
	                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
	                              <Upload className="h-6 w-6" />
	                            </div>
	                            <p className="text-sm font-semibold text-emerald-900">
	                              {t("sessionDetail.gallery.dropzoneOverlay.title", { defaultValue: "Buraya bırak" })}
	                            </p>
	                            <p className="text-xs text-emerald-900/70">
	                              {t("sessionDetail.gallery.dropzoneOverlay.subtitle", {
	                                defaultValue: "Fotoğraflar bu sete eklenecek",
	                              })}
	                            </p>
	                          </div>
	                        </div>
	                      ) : null}
	
			                    {!activeSelectionRuleId && uploadsForActiveSet.length === 0 ? (
	                          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-24 text-center animate-in fade-in zoom-in duration-300">
	                            <div className="btn-surface-action btn-surface-accent mb-4 !rounded-full p-6">
	                              <Upload size={48} />
	                            </div>
                            <h3 className="mb-2 text-lg font-bold text-gray-800">
                              {t("sessionDetail.gallery.emptySetTitle", {
                                defaultValue: "Henüz fotoğraf yok",
                              })}
                            </h3>
                            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
                              {t("sessionDetail.gallery.emptySetDesc", {
                                defaultValue:
                                  "Yüklemek için fotoğrafları sürükleyip bırakın veya aşağıdan ekleyebilirsiniz.",
                              })}
                            </p>
                            <Button
                              variant="surface"
                              size="sm"
                              className="btn-surface-accent mt-8 gap-2"
                              disabled={activeSet.id === "default-placeholder"}
                              onClick={() => handleAddMedia(activeSet.id)}
                            >
                              <ImageIcon className="h-4 w-4" />
                              {t("sessionDetail.gallery.labels.addMedia")}
                            </Button>
                          </div>
		                    ) : null}

                        {activeSelectionRuleId && filteredUploads.length === 0 ? (() => {
                          const kind = activeFilterMeta?.kind;
                          const targetRule =
                            kind === "rule"
                              ? selectionRules.find((rule) => rule.id === activeSelectionRuleId)
                              : null;

                          const title =
                            kind === "favorites"
                              ? t("sessionDetail.gallery.selection.emptyFavoritesTitle", {
                                  defaultValue: "Müşteri Seçimi Bekleniyor",
                                })
                              : kind === "starred"
                                ? t("sessionDetail.gallery.selection.emptyStarredTitle", {
                                    defaultValue: "Yıldızlı Fotoğraf Yok",
                                  })
                                : t("sessionDetail.gallery.selection.emptyRuleTitle", {
                                    defaultValue: `${targetRule?.title ?? "Bu kural"} Seçimi Yapılmadı`,
                                  });

                          const description =
                            kind === "favorites"
                              ? t("sessionDetail.gallery.selection.emptyFavoritesDesc", {
                                  defaultValue:
                                    "Müşteri henüz beğendiği fotoğrafları favorilerine eklemedi. Seçim yaptığında burada listelenecektir.",
                                })
                              : kind === "starred"
                                ? t("sessionDetail.gallery.selection.emptyStarredDesc", {
                                    defaultValue:
                                      "Kendi portfolyonuz veya önerileriniz için henüz fotoğraf işaretlemediniz.",
                                  })
                                : t("sessionDetail.gallery.selection.emptyRuleDesc", {
                                    defaultValue:
                                      `Müşteri bu kategori (Min: ${targetRule?.minCount ?? 0} adet) için henüz fotoğraf seçmedi. ` +
                                      "Müşterinin seçim sürecini tamamlaması bekleniyor.",
                                  });

                          const iconWrapClass =
                            kind === "favorites"
                              ? "bg-orange-50 text-orange-400"
                              : kind === "starred"
                                ? "bg-amber-50 text-amber-300"
                                : "bg-blue-50 text-blue-400";

                          const showActionHint = kind === "starred" || kind === "rule";

                          return (
                            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-24 text-center animate-in fade-in zoom-in duration-300">
                              <div className={cn("mb-4 rounded-full p-6", iconWrapClass)}>
                                {kind === "favorites" ? (
                                  <Clock size={48} />
                                ) : kind === "starred" ? (
                                  <Star size={48} fill="currentColor" />
                                ) : (
                                  <User size={48} />
                                )}
                              </div>
                              <h3 className="mb-2 text-lg font-bold text-gray-800">{title}</h3>
                              <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
                                {description}
                              </p>

                              {showActionHint && kind !== "starred" ? (
                                <div className="mt-8 flex flex-col items-center gap-2">
                                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                                    Fotoğrafçı İşlemi
                                  </span>
                                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
                                    <PlusCircle size={14} className="text-brand-600" />
                                    <span>Müşteri yerine seçim yapmak için 'Tüm Fotoğraflar'a dönün</span>
                                  </div>
                                </div>
                              ) : null}

                              {kind === "starred" ? (
                                <div className="mt-6 flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-medium text-amber-600">
                                  <Star size={14} fill="currentColor" />
                                  <span>Fotoğrafları yıldızlamak için 'Tüm Fotoğraflar'a dönün</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })() : null}

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
                                        loading="lazy"
                                        decoding="async"
	                                      className={cn(
	                                        "h-full w-full object-cover",
	                                        item.status !== "done" &&
	                                          item.status !== "error" &&
	                                          item.status !== "canceled" &&
	                                          "opacity-40"
	                                      )}
	                                      onError={() => refreshPreviewUrl(item.id)}
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
                                    isSelectedInActiveRule ? (
                                      pendingSelectionRemovalId === item.id ? (
                                        <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                                          <button
                                            type="button"
                                            onClick={() => setPendingSelectionRemovalId(null)}
                                            className="h-9 rounded-lg border border-border/60 bg-white px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                                          >
                                            İptal et
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              togglePhotoRuleSelection(item.id, activeSelectionRuleId);
                                              setPendingSelectionRemovalId(null);
                                            }}
                                            className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
                                          >
                                            Kaldır
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setPendingSelectionRemovalId(item.id)}
                                          className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                                        >
                                          Seçimi kaldır
                                        </button>
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => togglePhotoRuleSelection(item.id, activeSelectionRuleId)}
                                        className="h-9 rounded-lg border border-border/60 bg-white px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                                      >
                                        Seç
                                      </button>
                                    )
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

	                                  <DropdownMenu>
	                                    <DropdownMenuTrigger asChild>
	                                      <button
	                                        type="button"
	                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
	                                        onClick={(event) => event.stopPropagation()}
	                                        aria-label="Fotoğraf menüsü"
	                                      >
	                                        <MoreHorizontal size={16} />
	                                      </button>
	                                    </DropdownMenuTrigger>
		                                    <DropdownMenuContent
		                                      align="end"
		                                      sideOffset={8}
		                                      className="w-52 rounded-xl border-border/60 p-1.5 shadow-xl"
		                                      onClick={(event) => event.stopPropagation()}
		                                    >
		                                      <DropdownMenuItem
		                                        className="gap-2 rounded-lg px-3 py-2 text-sm font-medium focus:bg-muted/60 focus:text-foreground"
		                                        disabled={!isDone}
		                                        onSelect={() => openLightboxAt(index)}
		                                      >
		                                        <Maximize2 className="h-4 w-4 text-muted-foreground" />
		                                        Aç
		                                      </DropdownMenuItem>
		                                      <DropdownMenuItem
		                                        className="gap-2 rounded-lg px-3 py-2 text-sm font-medium focus:bg-muted/60 focus:text-foreground"
		                                        disabled={!item.previewUrl || coverPhotoId === item.id}
		                                        onSelect={() => handleSetCover(item.id)}
		                                      >
		                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
		                                        Kapak yap
		                                      </DropdownMenuItem>
		                                      <DropdownMenuSeparator />
		                                      <DropdownMenuItem
		                                        className="gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
		                                        onSelect={() => handleDeleteUpload(item.id)}
		                                      >
		                                        <Trash2 className="h-4 w-4" />
		                                        Sil
	                                      </DropdownMenuItem>
	                                    </DropdownMenuContent>
	                                  </DropdownMenu>
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
	                            const isCoverPhoto = coverPhotoId === item.id;

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
                                      decoding="async"
                                      fetchPriority="low"
	                                    className={cn(
	                                      "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] transform-gpu will-change-transform",
	                                      item.status !== "done" &&
	                                        item.status !== "error" &&
	                                        item.status !== "canceled" &&
	                                        "opacity-40"
	                                    )}
	                                    onError={() => refreshPreviewUrl(item.id)}
	                                  />
	                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <ImageIcon className="h-6 w-6" />
                                  </div>
                                )}

                                {isDone ? (
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                ) : null}

	                                {isCoverPhoto || selectedRuleLabels.length > 0 ? (
	                                  <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5 max-w-[70%]">
	                                    {isCoverPhoto ? (
	                                      <div className="inline-flex w-fit items-center rounded-md border border-white/15 bg-slate-950/60 px-2 py-1 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-left-2 duration-200">
	                                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-white">
	                                          Kapak
	                                        </span>
	                                      </div>
	                                    ) : null}
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

	                                  <DropdownMenu>
	                                    <DropdownMenuTrigger asChild>
	                                      <button
	                                        type="button"
	                                        onClick={(event) => event.stopPropagation()}
	                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:bg-white hover:text-slate-900 backdrop-blur-md transition-all duration-200 ease-out opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100 hover:!scale-110 shadow-lg"
	                                        aria-label="Fotoğraf menüsü"
	                                      >
	                                        <MoreVertical size={16} />
	                                      </button>
	                                    </DropdownMenuTrigger>
		                                    <DropdownMenuContent
		                                      align="end"
		                                      sideOffset={8}
		                                      className="w-52 rounded-xl border-border/60 p-1.5 shadow-xl"
		                                      onClick={(event) => event.stopPropagation()}
		                                    >
		                                      <DropdownMenuItem
		                                        className="gap-2 rounded-lg px-3 py-2 text-sm font-medium focus:bg-muted/60 focus:text-foreground"
		                                        disabled={!isDone}
		                                        onSelect={() => openLightboxAt(index)}
		                                      >
		                                        <Maximize2 className="h-4 w-4 text-muted-foreground" />
		                                        Aç
		                                      </DropdownMenuItem>
		                                      <DropdownMenuItem
		                                        className="gap-2 rounded-lg px-3 py-2 text-sm font-medium focus:bg-muted/60 focus:text-foreground"
		                                        disabled={!item.previewUrl || coverPhotoId === item.id}
		                                        onSelect={() => handleSetCover(item.id)}
		                                      >
		                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
		                                        Kapak yap
		                                      </DropdownMenuItem>
		                                      <DropdownMenuSeparator />
		                                      <DropdownMenuItem
		                                        className="gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
		                                        onSelect={() => handleDeleteUpload(item.id)}
		                                      >
		                                        <Trash2 className="h-4 w-4" />
		                                        Sil
	                                      </DropdownMenuItem>
	                                    </DropdownMenuContent>
	                                  </DropdownMenu>
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
                                        isSelectedInActiveRule ? (
                                          pendingSelectionRemovalId === item.id ? (
                                            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                                              <button
                                                type="button"
                                                onClick={() => setPendingSelectionRemovalId(null)}
                                                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-white/90 text-xs font-bold text-slate-900 shadow-lg backdrop-blur-md transition-colors hover:bg-white"
                                              >
                                                İPTAL ET
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  togglePhotoRuleSelection(item.id, activeSelectionRuleId);
                                                  setPendingSelectionRemovalId(null);
                                                }}
                                                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-rose-600 text-xs font-bold text-white shadow-lg transition-colors hover:bg-rose-700"
                                              >
                                                KALDIR
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setPendingSelectionRemovalId(item.id)}
                                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-rose-700"
                                            >
                                              <X size={16} strokeWidth={3} />
                                              SEÇİMİ KALDIR
                                            </button>
                                          )
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              togglePhotoRuleSelection(item.id, activeSelectionRuleId)
                                            }
                                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-colors hover:bg-slate-100"
                                          >
                                            <Check size={16} strokeWidth={3} />
                                            SEÇ
                                          </button>
                                        )
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

      <NavigationGuardDialog
        open={setDeleteGuardOpen}
        onDiscard={confirmSetDelete}
        onStay={closeSetDeleteGuard}
        title="Set silme onayı"
        stayLabel="İptal et"
        discardLabel="Sil"
        message={`${pendingDeleteSet?.set.name ?? ""} setinde ${pendingDeleteSet?.count ?? 0} fotoğraf var. Seti silerseniz bu fotoğrafların hepsi silinecek. Devam etmek istiyor musunuz?`}
      />

      <AlertDialog open={galleryDeleteGuardOpen} onOpenChange={(open) => !open && closeGalleryDeleteGuard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("sessionDetail.gallery.delete.title", { defaultValue: "Galeriyi sil" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("sessionDetail.gallery.delete.description", {
                defaultValue:
                  "Bu işlem geri alınamaz. Galeriye ait tüm fotoğraflar, setler ve müşteri seçimleri kalıcı olarak silinecek.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="gallery-delete-confirm">
              {t("sessionDetail.gallery.delete.confirmLabel", { defaultValue: "Silmek için galeri adını yazın" })}
            </Label>
            <Input
              id="gallery-delete-confirm"
              value={galleryDeleteConfirmText}
              onChange={(event) => setGalleryDeleteConfirmText(event.target.value)}
              placeholder={expectedGalleryNameForDelete}
              autoFocus
              disabled={deleteGalleryMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t("sessionDetail.gallery.delete.confirmHint", {
                defaultValue: `Galeri adı: ${expectedGalleryNameForDelete}`,
                name: expectedGalleryNameForDelete,
              })}
            </p>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={closeGalleryDeleteGuard} disabled={deleteGalleryMutation.isPending}>
              {t("buttons.cancel", { defaultValue: "İptal" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGalleryMutation.mutate()}
              disabled={!canConfirmGalleryDelete || deleteGalleryMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGalleryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("sessionDetail.gallery.delete.deleting", { defaultValue: "Siliniyor..." })}
                </>
              ) : (
                t("sessionDetail.gallery.delete.confirmButton", { defaultValue: "Galeriyi sil" })
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        onNavigate={handleLightboxNavigate}
        rules={selectionRules}
        onToggleRule={togglePhotoRuleSelection}
        onToggleStar={handleToggleStar}
        mode="admin"
        onImageError={refreshPreviewUrl}
      />

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
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </>
  );
}
