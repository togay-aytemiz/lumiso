import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { deserializeSelectionTemplate, type SelectionTemplateRuleForm } from "@/components/SelectionTemplateSection";
import { GalleryWatermarkOverlay } from "@/components/galleries/GalleryWatermarkOverlay";
import { Lightbox } from "@/components/galleries/Lightbox";
import { MobilePhotoSelectionSheet } from "@/components/galleries/MobilePhotoSelectionSheet";
import { ClientSelectionLockedBanner } from "@/components/galleries/ClientSelectionLockedBanner";
import { ClientSelectionReopenedBanner } from "@/components/galleries/ClientSelectionReopenedBanner";
import { SelectionLockBanner } from "@/components/galleries/SelectionLockBanner";
import { SelectionExportSheet } from "@/components/galleries/SelectionExportSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { GALLERY_ASSETS_BUCKET, getStorageBasename, isSupabaseStorageObjectMissingError } from "@/lib/galleryAssets";
import { parseGalleryWatermarkFromBranding } from "@/lib/galleryWatermark";
import { useI18nToast } from "@/lib/toastHelpers";
import { FloatingActionBar } from "@/components/galleries/FloatingActionBar";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Download,
  Grid3x3,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  ListPlus,
  Lock,
  Loader2,
  Maximize2,
  Rows,
  SearchX,
  SendHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type GridSize = "small" | "medium" | "large";
type FilterType = "all" | "favorites" | "starred" | "unselected" | "selected" | string;
type HeroMode = "selection" | "delivery";
type MobileTab = "gallery" | "tasks" | "favorites" | "starred";

type GalleryDetailRow = {
  id: string;
  title: string;
  type: string;
  branding: Record<string, unknown> | null;
};

type GallerySetRow = {
  id: string;
  name: string;
  description: string | null;
  order_index: number | null;
};

type GalleryAssetRow = {
  id: string;
  storage_path_web: string | null;
  storage_path_original: string | null;
  width: number | null;
  height: number | null;
  status: "processing" | "ready" | "failed";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ClientPreviewPhotoBase = {
  id: string;
  url: string;
  originalPath: string | null;
  filename: string;
  setId: string | null;
  isStarred: boolean;
  width: number | null;
  height: number | null;
};

type ClientPreviewPhoto = ClientPreviewPhotoBase & {
  isFavorite: boolean;
  selections: string[];
};

type ClientPreviewRuleBase = {
  id: string;
  title: string;
  serviceName: string | null;
  minCount: number;
  maxCount: number | null;
  required: boolean;
  selectionPartKey: string;
};

type ClientPreviewRule = ClientPreviewRuleBase & {
  currentCount: number;
};

type SelectionTemplateGroupForm = {
  key: string;
  serviceId: string | null;
  serviceName: string | null;
  billingType?: string | null;
  disabled?: boolean;
  rules: SelectionTemplateRuleForm[];
};

type GalleryClientFooterBranding = {
  logoUrl: string | null;
  businessName: string | null;
};

type GalleryClientPreviewProps = {
  galleryId?: string;
  branding?: GalleryClientFooterBranding | null;
};

type ClientSelectionRow = {
  id: string;
  asset_id: string | null;
  selection_part: string | null;
  client_id: string | null;
};

type GallerySelectionStateRow = {
  gallery_id: string;
  is_locked: boolean;
  note: string | null;
  locked_at: string | null;
  unlocked_at: string | null;
};

const ITEMS_PER_PAGE = 60;
const GALLERY_ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60;
const SET_SECTION_ID_PREFIX = "client-preview-set-section-";
const SET_SENTINEL_ID_PREFIX = "client-preview-set-sentinel-";
const SECTION_SKELETON_COUNT = 10;

// Helper to determine rule status
const getRuleStatus = (
  rule: ClientPreviewRuleBase & { currentCount: number },
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const isRequired = rule.required;
  const currentCount = rule.currentCount;
  const minCount = Math.max(0, rule.minCount); // Ensure non-negative
  const maxCount = rule.maxCount;

  // 1. Mandatory Rules
  if (isRequired) {
    const effectiveMin = minCount < 1 ? 1 : minCount;
    const isComplete = currentCount >= effectiveMin;
    const targetCount = maxCount ?? effectiveMin;
    const progress = targetCount > 0 ? Math.min(1, currentCount / targetCount) : 0;

    if (isComplete) {
      return {
        isComplete: true,
        progress,
        statusLabel: t("sessionDetail.gallery.clientPreview.labels.validSelection"),
        statusColor: "text-emerald-600",
        progressColor: "bg-emerald-500",
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50",
        borderColor: "border-emerald-200 hover:border-emerald-300",
      };
    } else {
      const missing = effectiveMin - currentCount;
      return {
        isComplete: false,
        progress,
        statusLabel: t("sessionDetail.gallery.clientPreview.tasks.missingCount", { count: missing }),
        statusColor: "text-orange-600",
        progressColor: "bg-orange-500",
        iconColor: "text-orange-600",
        iconBg: "bg-orange-50",
        borderColor: "border-orange-200 hover:border-orange-300",
      };
    }
  }

  // 2. Optional Rules
  const targetCount = maxCount ?? (minCount > 0 ? minCount : 1);
  const progress = targetCount > 0 ? Math.min(1, currentCount / targetCount) : 0;

  if (currentCount === 0) {
    // Totally empty optional rule -> Valid (or specific "Empty" state?)
    // User request: "The only optional place is the button...".
    // If optional, 0/5 is valid.
    return {
      isComplete: true, // It is "valid" in the sense of not blocking
      progress,
      statusLabel: t("sessionDetail.gallery.clientPreview.labels.optional"), // Or "Seçim yapılmadı"
      statusColor: "text-gray-400",
      progressColor: "bg-gray-300",
      iconColor: "text-gray-400", // Neutral
      iconBg: "bg-gray-100",
      borderColor: "border-gray-200 hover:border-gray-300",
    };
  }

  // Started but not reached min
  if (minCount > 0 && currentCount < minCount) {
    const missing = minCount - currentCount;
    // Screenshot 2 shows "1 tane daha" (1 more needed) and "Eksik" label.
    return {
      isComplete: false,
      progress,
      statusLabel: t("sessionDetail.gallery.clientPreview.tasks.missingCount", { count: missing }),
      statusColor: "text-orange-600",
      progressColor: "bg-orange-500",
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
      borderColor: "border-orange-200 hover:border-orange-300",
    };
  }

  // Satisfied min count
  return {
    isComplete: true,
    progress,
    statusLabel: t("sessionDetail.gallery.clientPreview.labels.validSelection"),
    statusColor: "text-emerald-600",
    progressColor: "bg-emerald-500",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    borderColor: "border-emerald-200 hover:border-emerald-300",
  };
};

const normalizeSelectionPartKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const parsePositiveNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const parseCountValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export default function GalleryClientPreview({ galleryId, branding }: GalleryClientPreviewProps = {}) {
  const { id: routeGalleryId } = useParams<{ id?: string }>();
  const resolvedGalleryId = galleryId ?? routeGalleryId ?? "";
  const { t, i18n } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const i18nToast = useI18nToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isInternalUserView = useMemo(
    () => location.pathname.startsWith("/galleries/"),
    [location.pathname]
  );

  const galleryRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const [showBottomNav, setShowBottomNav] = useState(false);

  const [gridSize, setGridSize] = useState<GridSize>("small");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [mobileTab, setMobileTab] = useState<MobileTab>("gallery");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [sheetPhotoId, setSheetPhotoId] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(() => new Set());
  const lastSignedUrlRefreshAtRef = useRef(0);
  const lastPhotoUrlByIdRef = useRef<Map<string, string>>(new Map());
  const originalSignedUrlCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());

  const [favoritePhotoIds, setFavoritePhotoIds] = useState<Set<string>>(() => new Set());
  const favoritesTouchedRef = useRef(false);
  const [photoSelectionsById, setPhotoSelectionsById] = useState<Record<string, string[]>>({});
  const selectionsTouchedRef = useRef(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const visibleCountRef = useRef(visibleCount);
  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  const [visibleCountBySetId, setVisibleCountBySetId] = useState<Record<string, number>>({});

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [photographerNote, setPhotographerNote] = useState("");

  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setViewerId(data.user?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setViewerId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ["gallery_client_preview", resolvedGalleryId],
    enabled: Boolean(resolvedGalleryId),
    queryFn: async (): Promise<GalleryDetailRow | null> => {
      if (!resolvedGalleryId) return null;
      const { data, error } = await supabase
        .from("galleries")
        .select("id,title,type,branding")
        .eq("id", resolvedGalleryId)
        .single();
      if (error) throw error;
      return data as GalleryDetailRow;
    },
  });

  const normalizedGalleryType = (gallery?.type ?? "").trim().toLowerCase();
  const isSelectionGallery = normalizedGalleryType === "proof";
  const isFinalGallery = normalizedGalleryType === "final";

  const selectionStateQueryKey = useMemo(
    () => ["gallery_selection_state", resolvedGalleryId],
    [resolvedGalleryId]
  );

  const { data: selectionState } = useQuery({
    queryKey: selectionStateQueryKey,
    enabled: Boolean(resolvedGalleryId && isSelectionGallery),
    queryFn: async (): Promise<GallerySelectionStateRow | null> => {
      if (!resolvedGalleryId) return null;
      const { data, error } = await supabase
        .from("gallery_selection_states")
        .select("gallery_id,is_locked,note,locked_at,unlocked_at")
        .eq("gallery_id", resolvedGalleryId)
        .maybeSingle();
      if (error) throw error;
      return (data as GallerySelectionStateRow | null) ?? null;
    },
  });

  const isSelectionsLocked = selectionState?.is_locked ?? false;
  const hasSubmittedSelections = Boolean(selectionState?.locked_at);
  const showClientReopenedBanner = !isInternalUserView && !isSelectionsLocked && hasSubmittedSelections;

  useEffect(() => {
    if (!isSelectionsLocked) return;
    setActiveMenuId(null);
    setSheetPhotoId(null);
  }, [isSelectionsLocked]);

  const { data: sets, isLoading: setsLoading } = useQuery({
    queryKey: ["gallery_sets", resolvedGalleryId],
    enabled: Boolean(resolvedGalleryId),
    queryFn: async (): Promise<GallerySetRow[]> => {
      if (!resolvedGalleryId) return [];
      const { data, error } = await supabase
        .from("gallery_sets")
        .select("id,name,description,order_index")
        .eq("gallery_id", resolvedGalleryId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data as GallerySetRow[]) ?? [];
    },
  });

  const { data: photosBase, isLoading: photosLoading } = useQuery({
    queryKey: ["gallery_client_preview_photos", resolvedGalleryId],
    enabled: Boolean(resolvedGalleryId),
    refetchOnWindowFocus: true,
    staleTime: (GALLERY_ASSET_SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
    queryFn: async (): Promise<ClientPreviewPhotoBase[]> => {
      if (!resolvedGalleryId) return [];
      const { data, error } = await supabase
        .from("gallery_assets")
        .select("id,storage_path_web,storage_path_original,status,metadata,created_at,width,height")
        .eq("gallery_id", resolvedGalleryId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as GalleryAssetRow[];
      const readyRows = rows.filter((row) => row.status === "ready");

      const signedUrls = await Promise.all(
        readyRows.map(async (row) => {
          if (!row.storage_path_web) return { id: row.id, signedUrl: "", missing: true };
          const { data: urlData, error: urlError } = await supabase.storage
            .from(GALLERY_ASSETS_BUCKET)
            .createSignedUrl(row.storage_path_web, GALLERY_ASSET_SIGNED_URL_TTL_SECONDS);
          if (urlError) {
            console.warn("Failed to create signed url for gallery asset", urlError);
            return { id: row.id, signedUrl: "", missing: isSupabaseStorageObjectMissingError(urlError) };
          }
          return { id: row.id, signedUrl: urlData?.signedUrl ?? "", missing: false };
        })
      );
      const missingAssetIds = signedUrls.filter((entry) => entry.missing).map((entry) => entry.id);
      if (missingAssetIds.length > 0) {
        const { error: cleanupError } = await supabase
          .from("gallery_assets")
          .delete()
          .eq("gallery_id", resolvedGalleryId)
          .in("id", missingAssetIds);
        if (cleanupError) {
          console.warn("GalleryClientPreview: Failed to clean up missing gallery assets", cleanupError);
        }
      }

      const missingIds = new Set(missingAssetIds);
      const signedUrlById = new Map(signedUrls.map((entry) => [entry.id, entry.signedUrl]));

      return readyRows.filter((row) => !missingIds.has(row.id)).map((row) => {
        const metadata = row.metadata ?? {};
        const originalName = typeof metadata.originalName === "string" ? metadata.originalName : null;
        const setId = typeof metadata.setId === "string" ? metadata.setId : null;
        const filename =
          originalName || (row.storage_path_web ? getStorageBasename(row.storage_path_web) : "photo");
        const isStarred = metadata.starred === true;
        const url = signedUrlById.get(row.id) ?? "";
        const width = parsePositiveNumber(row.width) ?? parsePositiveNumber(metadata.width);
        const height = parsePositiveNumber(row.height) ?? parsePositiveNumber(metadata.height);

        return {
          id: row.id,
          url,
          originalPath: row.storage_path_original,
          filename,
          setId,
          isStarred,
          width,
          height,
        };
      });
    },
  });

  const brandingData = useMemo(() => (gallery?.branding || {}) as Record<string, unknown>, [gallery?.branding]);
  const selectionTemplateHasRuleIds = useMemo(() => {
    const groupsRaw = Array.isArray(brandingData.selectionTemplateGroups)
      ? (brandingData.selectionTemplateGroups as unknown[])
      : [];

    const hasIdInGroups = groupsRaw.some((group) => {
      if (!group || typeof group !== "object") return false;
      const rules = (group as Record<string, unknown>).rules;
      if (!Array.isArray(rules)) return false;
      return rules.some((rule) => {
        if (!rule || typeof rule !== "object") return false;
        const id = (rule as Record<string, unknown>).id;
        return typeof id === "string" && id.trim().length > 0;
      });
    });
    if (hasIdInGroups) return true;

    const templateRaw = Array.isArray(brandingData.selectionTemplate) ? (brandingData.selectionTemplate as unknown[]) : [];
    return templateRaw.some((rule) => {
      if (!rule || typeof rule !== "object") return false;
      const id = (rule as Record<string, unknown>).id;
      return typeof id === "string" && id.trim().length > 0;
    });
  }, [brandingData.selectionTemplate, brandingData.selectionTemplateGroups]);
  const selectionSettings = useMemo(() => (brandingData.selectionSettings || {}) as Record<string, unknown>, [brandingData]);
  const watermark = useMemo(() => parseGalleryWatermarkFromBranding(brandingData), [brandingData]);
  const favoritesEnabled = selectionSettings.allowFavorites !== false;
  const hasFavorites = favoritesEnabled && favoritePhotoIds.size > 0;
  const eventDate = typeof brandingData.eventDate === "string" ? brandingData.eventDate : "";

  const viewInitializedRef = useRef<string | null>(null);
  useEffect(() => {
    const galleryId = gallery?.id ?? "";
    if (!galleryId) return;
    if (viewInitializedRef.current === galleryId) return;
    viewInitializedRef.current = galleryId;

    setMobileTab("gallery");
    setActiveFilter("all");
  }, [gallery?.id]);

  useEffect(() => {
    if (isSelectionGallery) return;
    if (!isMobile) return;
    if (mobileTab === "tasks" || mobileTab === "starred") {
      setMobileTab("gallery");
      setActiveFilter("all");
    }
  }, [isMobile, isSelectionGallery, mobileTab]);

  useEffect(() => {
    if (isSelectionGallery) return;
    if (activeFilter === "all" || activeFilter === "favorites") return;
    setActiveFilter("all");
  }, [activeFilter, isSelectionGallery]);

  useEffect(() => {
    if (isSelectionGallery) return;
    if (activeFilter !== "favorites") return;
    if (hasFavorites) return;
    setActiveFilter("all");
  }, [activeFilter, hasFavorites, isSelectionGallery]);

  const { data: persistedClientSelections } = useQuery({
    queryKey: ["gallery_client_preview_client_selections", resolvedGalleryId, viewerId],
    enabled: Boolean(resolvedGalleryId && viewerId),
    queryFn: async (): Promise<ClientSelectionRow[]> => {
      if (!resolvedGalleryId || !viewerId) return [];
      const { data, error } = await supabase
        .from("client_selections")
        .select("id,asset_id,selection_part,client_id")
        .eq("gallery_id", resolvedGalleryId)
        .eq("client_id", viewerId);
      if (error) throw error;
      return (data as ClientSelectionRow[]) ?? [];
    },
  });

  const persistedFavoritePhotoIds = useMemo(() => {
    if (!favoritesEnabled) return [] as string[];
    const favoriteKey = normalizeSelectionPartKey("favorites");
    const ids = new Set<string>();
    (persistedClientSelections ?? []).forEach((row) => {
      const partKey = normalizeSelectionPartKey(row.selection_part);
      if (partKey !== favoriteKey) return;
      if (typeof row.asset_id === "string" && row.asset_id) {
        ids.add(row.asset_id);
      }
    });
    return Array.from(ids);
  }, [favoritesEnabled, persistedClientSelections]);

  useEffect(() => {
    favoritesTouchedRef.current = false;
    setFavoritePhotoIds(new Set());
    selectionsTouchedRef.current = false;
    setPhotoSelectionsById({});
    setBrokenPhotoIds(new Set());
    lastPhotoUrlByIdRef.current = new Map();
  }, [resolvedGalleryId]);

  useEffect(() => {
    if (!favoritesEnabled) return;
    if (!persistedClientSelections) return;
    if (favoritesTouchedRef.current) return;
    setFavoritePhotoIds(new Set(persistedFavoritePhotoIds));
  }, [favoritesEnabled, persistedClientSelections, persistedFavoritePhotoIds]);

  const formattedEventDate = useMemo(() => {
    if (!eventDate) return "";
    const parsed = new Date(`${eventDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat(i18n.language || "en", { dateStyle: "long" }).format(parsed);
  }, [eventDate, i18n.language]);

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
            serviceName: t("sessionDetail.gallery.selectionTemplate.manualGroupTitle"),
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

  const selectionRulesBase = useMemo<ClientPreviewRuleBase[]>(() => {
    if (!isSelectionGallery) return [];
    const groups = parseSelectionTemplateGroups(brandingData);
    const rules: ClientPreviewRuleBase[] = [];

    groups.forEach((group, groupIndex) => {
      if (group.disabled) return;
      group.rules.forEach((rule, ruleIndex) => {
        const part = typeof rule.part === "string" ? rule.part.trim() : "";
        const normalizedKey = normalizeSelectionPartKey(part);
        const storedKey = normalizeSelectionPartKey(rule.id);
        const selectionPartKey = storedKey || normalizedKey;
        const minCount = Math.max(0, parseCountValue(rule.min) ?? 0);
        const rawMax = parseCountValue(rule.max);
        const maxCount = rawMax != null ? Math.max(rawMax, minCount) : null;
        const ruleId = `${group.key}-${groupIndex}-${selectionPartKey || ruleIndex}`;
        const required = rule.required !== false;

        rules.push({
          id: ruleId,
          title: part || t("sessionDetail.gallery.selectionTemplate.customLabel"),
          serviceName: group.serviceName ?? null,
          minCount,
          maxCount,
          required,
          selectionPartKey,
        });
      });
    });

    return rules;
  }, [brandingData, isSelectionGallery, parseSelectionTemplateGroups, t]);

  const legacySingleRuleSelectionPartKeyOverride = useMemo(() => {
    if (selectionTemplateHasRuleIds) return null;
    if (selectionRulesBase.length !== 1) return null;

    const favoritesKey = normalizeSelectionPartKey("favorites");
    const keys = new Set<string>();
    (persistedClientSelections ?? []).forEach((row) => {
      const partKey = normalizeSelectionPartKey(row.selection_part);
      if (!partKey || partKey === favoritesKey) return;
      keys.add(partKey);
    });

    if (keys.size !== 1) return null;

    const persistedKey = Array.from(keys)[0];
    const templateKey = normalizeSelectionPartKey(selectionRulesBase[0]?.selectionPartKey);
    if (!templateKey || templateKey === persistedKey) return null;

    return persistedKey;
  }, [persistedClientSelections, selectionRulesBase, selectionTemplateHasRuleIds]);

  const selectionPartKeyByRuleId = useMemo(() => {
    const map = new Map<string, string>();
    selectionRulesBase.forEach((rule) => {
      const selectionPartKey = legacySingleRuleSelectionPartKeyOverride ?? rule.selectionPartKey;
      if (!selectionPartKey) return;
      map.set(rule.id, selectionPartKey);
    });
    return map;
  }, [legacySingleRuleSelectionPartKeyOverride, selectionRulesBase]);

  const selectionRuleIdByPartKey = useMemo(() => {
    const map = new Map<string, string>();
    selectionRulesBase.forEach((rule) => {
      if (!rule.selectionPartKey) return;
      if (map.has(rule.selectionPartKey)) return;
      map.set(rule.selectionPartKey, rule.id);
    });
    if (legacySingleRuleSelectionPartKeyOverride && selectionRulesBase.length === 1) {
      map.set(legacySingleRuleSelectionPartKeyOverride, selectionRulesBase[0].id);
    }
    return map;
  }, [legacySingleRuleSelectionPartKeyOverride, selectionRulesBase]);

  const persistedRuleSelectionsById = useMemo(() => {
    const selections: Record<string, string[]> = {};
    (persistedClientSelections ?? []).forEach((row) => {
      if (typeof row.asset_id !== "string" || !row.asset_id) return;
      const partKey = normalizeSelectionPartKey(row.selection_part);
      if (!partKey || partKey === normalizeSelectionPartKey("favorites")) return;
      const ruleId = selectionRuleIdByPartKey.get(partKey);
      if (!ruleId) return;
      const current = selections[row.asset_id] ?? [];
      if (!current.includes(ruleId)) {
        selections[row.asset_id] = [...current, ruleId];
      }
    });
    return selections;
  }, [persistedClientSelections, selectionRuleIdByPartKey]);

  useEffect(() => {
    if (!persistedClientSelections) return;
    if (selectionsTouchedRef.current) return;
    setPhotoSelectionsById(persistedRuleSelectionsById);
  }, [persistedClientSelections, persistedRuleSelectionsById]);

  const ruleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(photoSelectionsById).forEach((ruleIds) => {
      ruleIds.forEach((ruleId) => {
        counts[ruleId] = (counts[ruleId] ?? 0) + 1;
      });
    });
    return counts;
  }, [photoSelectionsById]);

  const selectionRules = useMemo<ClientPreviewRule[]>(() => {
    return selectionRulesBase.map((rule) => ({
      ...rule,
      currentCount: ruleCounts[rule.id] ?? 0,
    }));
  }, [selectionRulesBase, ruleCounts]);

  const selectionRuleTitleById = useMemo(() => {
    return new Map(selectionRules.map((rule) => [rule.id, rule.title] as const));
  }, [selectionRules]);

  const orderedSets = useMemo(() => sets ?? [], [sets]);
  const hasMultipleSets = orderedSets.length > 1;

  useEffect(() => {
    if (!hasMultipleSets) {
      setActiveCategoryId("");
      return;
    }

    setActiveCategoryId((prev) => {
      if (prev && orderedSets.some((set) => set.id === prev)) return prev;
      return orderedSets[0]?.id ?? "";
    });
  }, [hasMultipleSets, orderedSets]);

  useEffect(() => {
    if (!hasMultipleSets) {
      setVisibleCountBySetId({});
      return;
    }

    setVisibleCountBySetId(() => {
      const next: Record<string, number> = {};
      orderedSets.forEach((set, index) => {
        next[set.id] = index === 0 ? ITEMS_PER_PAGE : 0;
      });
      return next;
    });
  }, [activeFilter, hasMultipleSets, orderedSets, resolvedGalleryId]);

  const resolvedPhotos = useMemo<ClientPreviewPhoto[]>(() => {
    const fallbackSetId = orderedSets[0]?.id ?? null;
    const base = photosBase ?? [];

    return base.map((photo) => {
      const setId = photo.setId || fallbackSetId;
      const selections = photoSelectionsById[photo.id] ?? [];
      const isFavorite = favoritesEnabled && favoritePhotoIds.has(photo.id);
      return {
        ...photo,
        setId,
        isFavorite,
        selections,
      };
    });
  }, [favoritePhotoIds, favoritesEnabled, orderedSets, photoSelectionsById, photosBase]);

  const exportDisabled = useMemo(
    () => !resolvedPhotos.some((photo) => photo.isFavorite || photo.selections.length > 0),
    [resolvedPhotos]
  );

  const filteredPhotosUnsorted = useMemo(() => {
    switch (activeFilter) {
      case "all":
        return resolvedPhotos;
      case "favorites":
        return resolvedPhotos.filter((photo) => photo.isFavorite);
      case "starred":
        return resolvedPhotos.filter((photo) => photo.isStarred);
      case "unselected":
        return resolvedPhotos.filter((photo) => photo.selections.length === 0);
      case "selected":
        return resolvedPhotos.filter((photo) => photo.selections.length > 0);
      default:
        return resolvedPhotos.filter((photo) => photo.selections.includes(activeFilter));
    }
  }, [resolvedPhotos, activeFilter]);

  const filteredPhotosBySetId = useMemo(() => {
    if (!hasMultipleSets) return {} as Record<string, ClientPreviewPhoto[]>;
    const bySetId: Record<string, ClientPreviewPhoto[]> = {};
    orderedSets.forEach((set) => {
      bySetId[set.id] = [];
    });

    const fallbackSetId = orderedSets[0]?.id ?? "";
    filteredPhotosUnsorted.forEach((photo) => {
      const rawSetId = photo.setId ?? fallbackSetId;
      const targetSetId =
        rawSetId && Object.prototype.hasOwnProperty.call(bySetId, rawSetId) ? rawSetId : fallbackSetId;
      if (!targetSetId) return;
      bySetId[targetSetId].push(photo);
    });

    return bySetId;
  }, [filteredPhotosUnsorted, hasMultipleSets, orderedSets]);

  const filteredPhotos = useMemo(() => {
    if (!hasMultipleSets) return filteredPhotosUnsorted;
    return orderedSets.flatMap((set) => filteredPhotosBySetId[set.id] ?? []);
  }, [filteredPhotosBySetId, filteredPhotosUnsorted, hasMultipleSets, orderedSets]);

  const coverUrl = useMemo(() => {
    const coverAssetId = typeof brandingData.coverAssetId === "string" ? brandingData.coverAssetId : "";
    if (coverAssetId) {
      const match = resolvedPhotos.find((photo) => photo.id === coverAssetId && photo.url);
      if (match?.url) return match.url;
      const first = resolvedPhotos.find((photo) => Boolean(photo.url));
      return first?.url ?? "";
    }

    const storedCoverUrl = typeof brandingData.coverUrl === "string" ? brandingData.coverUrl : "";
    if (storedCoverUrl) return storedCoverUrl;
    const first = resolvedPhotos.find((photo) => Boolean(photo.url));
    return first?.url ?? "";
  }, [brandingData.coverAssetId, brandingData.coverUrl, resolvedPhotos]);

  useEffect(() => {
    if (!photosBase) return;

    setBrokenPhotoIds((prev) => {
      const next = prev.size === 0 ? prev : new Set(prev);

      photosBase.forEach((photo) => {
        const prevUrl = lastPhotoUrlByIdRef.current.get(photo.id);
        if (prevUrl && prevUrl !== photo.url) {
          next.delete(photo.id);
        }
        lastPhotoUrlByIdRef.current.set(photo.id, photo.url);
      });

      return next;
    });
  }, [photosBase]);

  // Scroll to top on mount
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      // noop (jsdom)
    }
  }, []);

  // Reset visible count when filters change (single-section view)
  useEffect(() => {
    if (hasMultipleSets) return;
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeFilter, hasMultipleSets, resolvedGalleryId]);

  // Sticky Nav Logic
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolled(scrollY > 50);

      if (!isMobile) return;
      const shouldShow = mobileTab !== "gallery" || activeFilter !== "all" || scrollY > 100;
      setShowBottomNav(shouldShow);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeFilter, isMobile, mobileTab]);

  // Mobile Tabs Scroll Reset
  useEffect(() => {
    if (isMobile && mobileTab === "tasks") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [isMobile, mobileTab]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navRef.current;
    if (!nav) return;

    const update = () => setNavHeight(nav.getBoundingClientRect().height);
    update();

    const handleResize = () => update();
    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(nav);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [galleryLoading, photosLoading, setsLoading]);

  // Infinite Scroll Logic (single-section view)
  useEffect(() => {
    if (hasMultipleSets) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCountRef.current < filteredPhotos.length) {
          setVisibleCount((prev) => {
            if (prev >= filteredPhotos.length) return prev;
            return Math.min(prev + ITEMS_PER_PAGE, filteredPhotos.length);
          });
        }
      },
      { threshold: 0.1, rootMargin: "800px 0px" }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [filteredPhotos.length, hasMultipleSets]); // Removed visibleCount from deps

  const scrollToSet = useCallback(
    (setId: string) => {
      if (!setId) return;

      setActiveCategoryId(setId);
      setVisibleCountBySetId((prev) => {
        const total = filteredPhotosBySetId[setId]?.length ?? 0;
        const current = prev[setId] ?? 0;
        const nextCount = total > 0 ? Math.min(Math.max(current, ITEMS_PER_PAGE), total) : 0;
        if (nextCount === current) return prev;
        return { ...prev, [setId]: nextCount };
      });

      const targetId = `${SET_SECTION_ID_PREFIX}${setId}`;
      const target = typeof document !== "undefined" ? document.getElementById(targetId) : null;
      if (!target) return;

      const navOffset = navHeight || navRef.current?.offsetHeight || 0;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY;
      const scrollTarget = Math.max(0, targetPosition - navOffset - 12);
      const behavior: ScrollBehavior =
        typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth";

      try {
        window.scrollTo({ top: scrollTarget, behavior });
      } catch {
        // noop (jsdom)
      }
    },
    [filteredPhotosBySetId, navHeight]
  );

  // Section activation (lazy render per set)
  useEffect(() => {
    if (!hasMultipleSets) return;
    if (typeof window === "undefined") return;

    const sectionElements = orderedSets
      .map((set) => document.getElementById(`${SET_SECTION_ID_PREFIX}${set.id}`))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        if (intersecting.length === 0) return;

        setVisibleCountBySetId((prev) => {
          let changed = false;
          const next: Record<string, number> = { ...prev };

          intersecting.forEach((entry) => {
            const setId = (entry.target as HTMLElement).dataset.setId ?? "";
            if (!setId) return;
            const total = filteredPhotosBySetId[setId]?.length ?? 0;
            if (total === 0) return;
            const current = next[setId] ?? 0;
            if (current >= Math.min(ITEMS_PER_PAGE, total)) return;
            next[setId] = Math.min(ITEMS_PER_PAGE, total);
            changed = true;
          });

          return changed ? next : prev;
        });
      },
      { threshold: 0.01, rootMargin: "800px 0px 800px 0px" }
    );

    sectionElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filteredPhotosBySetId, hasMultipleSets, orderedSets]);

  // Load more per section
  useEffect(() => {
    if (!hasMultipleSets) return;
    if (typeof window === "undefined") return;

    const sentinelElements = orderedSets
      .map((set) => document.getElementById(`${SET_SENTINEL_ID_PREFIX}${set.id}`))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sentinelElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const setId = target.dataset.setId ?? "";
          if (!setId) return;

          const total = filteredPhotosBySetId[setId]?.length ?? 0;
          if (total === 0) return;

          setVisibleCountBySetId((prev) => {
            const current = prev[setId] ?? 0;
            if (current >= total) return prev;
            const nextCount = Math.min(current + ITEMS_PER_PAGE, total);
            if (nextCount === current) return prev;
            return { ...prev, [setId]: nextCount };
          });
        });
      },
      { threshold: 0.1, rootMargin: "600px 0px" }
    );

    sentinelElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filteredPhotosBySetId, hasMultipleSets, orderedSets]);

  // Active section tracking (for nav highlight)
  useEffect(() => {
    if (!hasMultipleSets) return;
    if (typeof window === "undefined") return;

    const sectionElements = orderedSets
      .map((set) => document.getElementById(`${SET_SECTION_ID_PREFIX}${set.id}`))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sectionElements.length === 0) return;

    const navOffset = navHeight || navRef.current?.offsetHeight || 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const setId = (visible[0]?.target as HTMLElement | undefined)?.dataset.setId ?? "";
        if (setId) setActiveCategoryId(setId);
      },
      { rootMargin: `-${navOffset + 24}px 0px -60% 0px`, threshold: [0, 0.5, 1] }
    );

    sectionElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [hasMultipleSets, navHeight, orderedSets]);

  const visiblePhotos = useMemo(() => filteredPhotos.slice(0, visibleCount), [filteredPhotos, visibleCount]);

  const filteredPhotoIndexById = useMemo(() => {
    const map = new Map<string, number>();
    filteredPhotos.forEach((photo, index) => {
      map.set(photo.id, index);
    });
    return map;
  }, [filteredPhotos]);

  const scrollToGallery = () => {
    const behavior: ScrollBehavior =
      typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";

    try {
      window.scrollTo({ top: window.innerHeight, behavior });
    } catch {
      // noop (jsdom)
    }
  };

  const scrollToContentStart = useCallback(() => {
    const targetTop = navRef.current?.offsetTop ?? 0;

    try {
      window.scrollTo({ top: targetTop, behavior: "auto" });
      document.documentElement.scrollTop = targetTop;
      document.body.scrollTop = targetTop;
    } catch {
      // noop (jsdom)
    }
  }, []);

  const handleMobileTabChange = useCallback(
    (nextTab: MobileTab) => {
      if (!isMobile) return;
      const resolvedTab =
        !isSelectionGallery && (nextTab === "tasks" || nextTab === "starred") ? "gallery" : nextTab;
      setMobileTab(resolvedTab);
      if (resolvedTab === "gallery") setActiveFilter("all");
      if (resolvedTab === "favorites") setActiveFilter("favorites");
      if (resolvedTab === "starred") setActiveFilter("starred");
      scrollToContentStart();
    },
    [isMobile, isSelectionGallery, scrollToContentStart]
  );

  const handleMobileTaskSelect = useCallback(
    (ruleId: string) => {
      setActiveFilter(ruleId);
      setMobileTab("gallery");
      scrollToContentStart();
    },
    [scrollToContentStart]
  );

  const openViewer = (photoId: string) => {
    setLightboxIndex(filteredPhotoIndexById.get(photoId) ?? 0);
    setLightboxOpen(true);
  };

  const activeLightboxRuleId = useMemo(() => {
    if (
      activeFilter === "all" ||
      activeFilter === "favorites" ||
      activeFilter === "starred" ||
      activeFilter === "unselected" ||
      activeFilter === "selected"
    ) {
      return null;
    }
    return selectionRules.some((rule) => rule.id === activeFilter) ? activeFilter : null;
  }, [activeFilter, selectionRules]);

  const handleLightboxNavigate = useCallback(
    (nextIndex: number) => {
      setLightboxIndex(() => {
        if (filteredPhotos.length === 0) return 0;
        return Math.max(0, Math.min(nextIndex, filteredPhotos.length - 1));
      });
    },
    [filteredPhotos.length]
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    if (filteredPhotos.length === 0) {
      setLightboxOpen(false);
      setLightboxIndex(0);
      return;
    }
    setLightboxIndex((prev) => Math.min(prev, filteredPhotos.length - 1));
  }, [filteredPhotos.length, lightboxOpen]);

  const updateFavoriteMutation = useMutation({
    mutationFn: async ({ photoId, nextIsFavorite }: { photoId: string; nextIsFavorite: boolean }) => {
      if (!resolvedGalleryId || !viewerId) return;
      const { error: deleteError } = await supabase
        .from("client_selections")
        .delete()
        .eq("gallery_id", resolvedGalleryId)
        .eq("client_id", viewerId)
        .eq("asset_id", photoId)
        .eq("selection_part", "favorites");
      if (deleteError) throw deleteError;

      if (!nextIsFavorite) return;

      const insertPayload = {
        gallery_id: resolvedGalleryId,
        asset_id: photoId,
        selection_part: "favorites",
        client_id: viewerId,
      };
      const { error: insertError } = await supabase.from("client_selections").insert(insertPayload);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gallery_client_preview_client_selections", resolvedGalleryId, viewerId],
      });
      queryClient.invalidateQueries({ queryKey: ["client_selections", resolvedGalleryId] });
    },
  });

  const updateRuleSelectionMutation = useMutation({
    mutationFn: async ({
      photoId,
      selectionPartKey,
      nextIsSelected,
    }: {
      photoId: string;
      selectionPartKey: string;
      nextIsSelected: boolean;
    }) => {
      if (!resolvedGalleryId || !viewerId) return;
      if (!selectionPartKey) return;

      const { error: deleteError } = await supabase
        .from("client_selections")
        .delete()
        .eq("gallery_id", resolvedGalleryId)
        .eq("client_id", viewerId)
        .eq("asset_id", photoId)
        .eq("selection_part", selectionPartKey);
      if (deleteError) throw deleteError;

      if (!nextIsSelected) return;

      const { error: insertError } = await supabase.from("client_selections").insert({
        gallery_id: resolvedGalleryId,
        asset_id: photoId,
        selection_part: selectionPartKey,
        client_id: viewerId,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["gallery_client_preview_client_selections", resolvedGalleryId, viewerId],
      });
      queryClient.invalidateQueries({ queryKey: ["client_selections", resolvedGalleryId] });
    },
  });

  const lockSelectionsMutation = useMutation({
    mutationFn: async ({ note }: { note: string }) => {
      if (!resolvedGalleryId) return;
      if (!viewerId) throw new Error("Missing viewer session");
      const now = new Date().toISOString();
      const resolvedNote = note.trim();

      const { error } = await supabase
        .from("gallery_selection_states")
        .upsert(
          {
            gallery_id: resolvedGalleryId,
            is_locked: true,
            note: resolvedNote ? resolvedNote : null,
            locked_at: now,
            locked_by: viewerId,
            unlocked_at: null,
            unlocked_by: null,
            updated_at: now,
          },
          { onConflict: "gallery_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionStateQueryKey });
      queryClient.invalidateQueries({ queryKey: ["gallery", resolvedGalleryId] });
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.success(t("sessionDetail.gallery.selectionLock.toast.locked"), { duration: 2500 });

      if (!isInternalUserView && resolvedGalleryId) {
        void supabase.functions
          .invoke("send-gallery-selection-submitted-email", {
            body: { galleryId: resolvedGalleryId },
          })
          .then(({ error }) => {
            if (error) {
              console.warn(
                "GalleryClientPreview: Failed to send selection submitted email",
                error,
              );
            }
          })
          .catch((error: unknown) => {
            console.warn(
              "GalleryClientPreview: Failed to send selection submitted email",
              error,
            );
          });
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: selectionStateQueryKey });
      queryClient.invalidateQueries({ queryKey: ["gallery", resolvedGalleryId] });
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.error(t("sessionDetail.gallery.toast.errorDesc"), { duration: 2500 });
    },
  });

  const unlockSelectionsMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedGalleryId) return;
      if (!viewerId) throw new Error("Missing viewer session");
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("gallery_selection_states")
        .upsert(
          {
            gallery_id: resolvedGalleryId,
            is_locked: false,
            unlocked_at: now,
            unlocked_by: viewerId,
            updated_at: now,
          },
          { onConflict: "gallery_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionStateQueryKey });
      queryClient.invalidateQueries({ queryKey: ["gallery", resolvedGalleryId] });
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.success(t("sessionDetail.gallery.selectionLock.toast.unlocked"), { duration: 2500 });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: selectionStateQueryKey });
      queryClient.invalidateQueries({ queryKey: ["gallery", resolvedGalleryId] });
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.error(t("sessionDetail.gallery.toast.errorDesc"), { duration: 2500 });
    },
  });

  const handleExportSelections = useCallback(() => {
    setExportSheetOpen(true);
  }, []);

  const handleToggleFavorite = useCallback(
    (photoId: string) => {
      if (!favoritesEnabled) return;
      if (isSelectionsLocked) {
        i18nToast.error(t("sessionDetail.gallery.clientPreview.toast.selectionsLocked"), {
          duration: 3000,
        });
        return;
      }
      favoritesTouchedRef.current = true;
      const wasFavorite = favoritePhotoIds.has(photoId);
      const nextIsFavorite = !wasFavorite;

      setFavoritePhotoIds((prev) => {
        const next = new Set(prev);
        if (nextIsFavorite) next.add(photoId);
        else next.delete(photoId);
        return next;
      });

      updateFavoriteMutation.mutate(
        { photoId, nextIsFavorite },
        {
          onSuccess: () => {
            i18nToast.success(
              wasFavorite
                ? t("sessionDetail.gallery.clientPreview.toast.favoritesRemoved")
                : t("sessionDetail.gallery.clientPreview.toast.favoritesAdded"),
              { duration: 2000 }
            );
          },
          onError: () => {
            setFavoritePhotoIds((prev) => {
              const next = new Set(prev);
              if (wasFavorite) next.add(photoId);
              else next.delete(photoId);
              return next;
            });
            i18nToast.error(t("sessionDetail.gallery.toast.errorDesc"), { duration: 2500 });
          },
        }
      );
    },
    [favoritePhotoIds, favoritesEnabled, i18nToast, isSelectionsLocked, t, updateFavoriteMutation]
  );

  const handleAssetImageError = useCallback(
    (photoId: string) => {
      setBrokenPhotoIds((prev) => {
        if (prev.has(photoId)) return prev;
        const next = new Set(prev);
        next.add(photoId);
        return next;
      });

      if (!resolvedGalleryId) return;
      const now = Date.now();
      if (now - lastSignedUrlRefreshAtRef.current < 1500) return;
      lastSignedUrlRefreshAtRef.current = now;

      queryClient.invalidateQueries({ queryKey: ["gallery_client_preview_photos", resolvedGalleryId] });
    },
    [queryClient, resolvedGalleryId]
  );

  const resolveLightboxOriginalUrl = useCallback(async (photo: { id: string; originalPath?: string | null }) => {
    const storagePath = typeof photo.originalPath === "string" ? photo.originalPath : "";
    if (!storagePath) return null;

    const now = Date.now();
    const cached = originalSignedUrlCacheRef.current.get(photo.id);
    if (cached && cached.expiresAt > now) return cached.url;

    const { data: urlData, error } = await supabase.storage
      .from(GALLERY_ASSETS_BUCKET)
      .createSignedUrl(storagePath, GALLERY_ASSET_SIGNED_URL_TTL_SECONDS);
    if (error || !urlData?.signedUrl) return null;

    originalSignedUrlCacheRef.current.set(photo.id, {
      url: urlData.signedUrl,
      expiresAt: now + GALLERY_ASSET_SIGNED_URL_TTL_SECONDS * 1000 - 15_000,
    });
    return urlData.signedUrl;
  }, []);

  const handleBulkDownloadClick = useCallback(() => {
    i18nToast.info(t("sessionDetail.gallery.clientPreview.toast.bulkDownloadSoon"), {
      duration: 2500,
    });
  }, [i18nToast, t]);

  const handleExit = useCallback(() => {
    if (routeGalleryId) {
      navigate(`/galleries/${routeGalleryId}`);
      return;
    }
    navigate(-1);
  }, [navigate, routeGalleryId]);

  const handleOpenConfirmation = () => {
    setPhotographerNote((prev) => {
      if (prev.trim().length > 0) return prev;
      return typeof selectionState?.note === "string" ? selectionState.note : "";
    });
    setIsConfirmationModalOpen(true);
  };

  const handleConfirmSelections = () => {
    setIsConfirmationModalOpen(false);
    lockSelectionsMutation.mutate({ note: photographerNote });
  };


  const toggleRuleSelect = useCallback(
    (photoId: string, ruleId: string) => {
      if (isSelectionsLocked) {
        i18nToast.error(t("sessionDetail.gallery.clientPreview.toast.selectionsLocked"), {
          duration: 3000,
        });
        return;
      }

      const selectionPartKey = selectionPartKeyByRuleId.get(ruleId) ?? "";
      if (!selectionPartKey) return;

      selectionsTouchedRef.current = true;
      const current = photoSelectionsById[photoId] ?? [];
      const wasSelected = current.includes(ruleId);
      const nextIsSelected = !wasSelected;

      setPhotoSelectionsById((prev) => {
        const currentRuleIds = prev[photoId] ?? [];
        if (currentRuleIds.includes(ruleId)) {
          const next = currentRuleIds.filter((id) => id !== ruleId);
          if (next.length === 0) {
            const { [photoId]: _removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [photoId]: next };
        }
        return { ...prev, [photoId]: [...currentRuleIds, ruleId] };
      });

      updateRuleSelectionMutation.mutate(
        { photoId, selectionPartKey, nextIsSelected },
        {
          onError: () => {
            setPhotoSelectionsById((prev) => {
              const currentRuleIds = prev[photoId] ?? [];
              const hasRule = currentRuleIds.includes(ruleId);
              if (nextIsSelected) {
                if (!hasRule) return prev;
                const next = currentRuleIds.filter((id) => id !== ruleId);
                if (next.length === 0) {
                  const { [photoId]: _removed, ...rest } = prev;
                  return rest;
                }
                return { ...prev, [photoId]: next };
              }
              if (hasRule) return prev;
              return { ...prev, [photoId]: [...currentRuleIds, ruleId] };
            });
            i18nToast.error(t("sessionDetail.gallery.toast.errorDesc"), { duration: 2500 });
          },
        }
      );
    },
    [i18nToast, isSelectionsLocked, photoSelectionsById, selectionPartKeyByRuleId, t, updateRuleSelectionMutation]
  );

  const getGridClass = () => {
    switch (gridSize) {
      case "large":
        return "grid items-start grid-cols-1 md:grid-cols-2 gap-4";
      case "small":
        return "grid items-start grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4";
      default:
        return "grid items-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
    }
  };

  const renderEmptyState = () => {
    const resetToAll = () => {
      if (isMobile) {
        handleMobileTabChange("gallery");
        return;
      }
      setActiveFilter("all");
    };

    let content = {
      icon: SearchX,
      title: t("sessionDetail.gallery.clientPreview.empty.noPhotos.title"),
      desc: t("sessionDetail.gallery.clientPreview.empty.noPhotos.description"),
      actionLabel: t("sessionDetail.gallery.clientPreview.empty.noPhotos.action"),
      action: resetToAll,
      color: "text-gray-400",
    };

    if (activeFilter === "favorites") {
      content = {
        icon: Heart,
        title: t("sessionDetail.gallery.clientPreview.empty.favorites.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.favorites.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.favorites.action"),
        action: resetToAll,
        color: "text-red-400",
      };
    } else if (activeFilter === "starred") {
      content = {
        icon: Star,
        title: t("sessionDetail.gallery.clientPreview.empty.starred.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.starred.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.starred.action"),
        action: resetToAll,
        color: "text-amber-400",
      };
    } else if (activeFilter === "unselected") {
      content = {
        icon: CheckCircle2,
        title: t("sessionDetail.gallery.clientPreview.empty.unselected.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.unselected.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.unselected.action"),
        action: resetToAll,
        color: "text-green-500",
      };
    } else if (activeFilter === "selected") {
      content = {
        icon: CheckCircle2,
        title: t("sessionDetail.gallery.clientPreview.empty.selected.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.selected.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.selected.action"),
        action: resetToAll,
        color: "text-brand-500",
      };
    } else if (activeFilter !== "all") {
      const rule = selectionRules.find((rule) => rule.id === activeFilter);
      if (rule) {
        content = {
          icon: Sparkles,
          title: t("sessionDetail.gallery.clientPreview.empty.rule.title", { rule: rule.title }),
          desc: t("sessionDetail.gallery.clientPreview.empty.rule.description", { rule: rule.title }),
          actionLabel: t("sessionDetail.gallery.clientPreview.empty.rule.action"),
          action: resetToAll,
          color: "text-indigo-400",
        };
      }
    }

    return (
      <div className="flex flex-col items-center justify-center pt-20 pb-24 px-4 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <content.icon size={40} className={content.color} strokeWidth={1.5} />
        </div>
        <h3 className="text-3xl font-serif font-bold text-gray-900 mb-4">
          {content.title}
        </h3>
        <p className="text-gray-500 max-w-md mx-auto mb-10 leading-relaxed text-lg font-light">
          {content.desc}
        </p>
        <button
          type="button"
          onClick={content.action}
          className="group flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-full font-bold text-sm uppercase tracking-widest hover:bg-black transition-all shadow-lg hover:shadow-xl hover:scale-105"
        >
          {content.actionLabel}
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  };

  const renderSkeletonGrid = (keyPrefix: string) => (
    <div className={getGridClass()} aria-hidden="true" data-testid="gallery-client-preview-skeleton-grid">
      {Array.from({ length: SECTION_SKELETON_COUNT }).map((_, index) => (
        <div key={`${keyPrefix}-${index}`}>
          <Skeleton className="w-full aspect-[3/4] rounded-sm" />
        </div>
      ))}
    </div>
  );


  const renderPhotoGrid = (photos: ClientPreviewPhoto[]) => (
    <div className={getGridClass()} data-testid="gallery-client-preview-photo-grid">
      {photos.map((photo) => {
        const isMenuOpen = activeMenuId === photo.id;
        const selectionIds = photo.selections;
        const hasSelections = selectionIds.length > 0;
        const resolvedSelectionIds = selectionIds.filter((selectionId) => selectionRuleTitleById.has(selectionId));
        const visibleSelectionIds = resolvedSelectionIds.slice(0, 2);
        const remainingSelectionCount = Math.max(0, resolvedSelectionIds.length - visibleSelectionIds.length);

        return (
          <div key={photo.id} className="group relative z-0" style={{ zIndex: isMenuOpen ? 50 : 0 }}>
            <div
              onClick={() => openViewer(photo.id)}
              className="overflow-hidden rounded-sm bg-gray-100 relative cursor-pointer"
            >
                {photo.url && !brokenPhotoIds.has(photo.id) ? (
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    width={photo.width && photo.width > 0 ? photo.width : 3}
                    height={photo.height && photo.height > 0 ? photo.height : 4}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover transition-transform duration-500 md:group-hover:scale-105"
                    onError={() => handleAssetImageError(photo.id)}
                  />
                ) : (
                  <div className="w-full aspect-[3/4] bg-gray-200 flex items-center justify-center text-gray-500">
                    <ImageIcon size={32} />
                </div>
              )}

              <GalleryWatermarkOverlay watermark={watermark} variant="thumbnail" className="z-[15]" />

              <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-2 max-w-[70%]">
                {selectionRules.length > 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      disabled={isSelectionsLocked}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelectionsLocked) return;
                        setSheetPhotoId((prev) => (prev === photo.id ? null : photo.id));
                      }}
                      aria-label={
                        hasSelections
                          ? t("sessionDetail.gallery.clientPreview.labels.selected")
                          : t("sessionDetail.gallery.clientPreview.labels.add")
                      }
                      className={`md:hidden w-11 h-11 rounded-full flex items-center justify-center shadow-md backdrop-blur-md transition-all duration-200 active:scale-95
                        ${isSelectionsLocked
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                          : hasSelections
                            ? "bg-brand-500 text-white"
                            : "bg-white/90 text-gray-900"}
                      `}
                    >
                      {isSelectionsLocked ? (
                        <Lock size={16} />
                      ) : (
                        hasSelections ? <Check size={16} strokeWidth={3} /> : <ListPlus size={18} />
                      )}
                    </button>

                    <Popover open={isMenuOpen} onOpenChange={(open) => setActiveMenuId(open ? photo.id : null)}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={isSelectionsLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelectionsLocked) return;
                            setActiveMenuId(isMenuOpen ? null : photo.id);
                          }}
                          className={`hidden md:flex h-9 px-3 rounded-full items-center justify-center gap-2 shadow-sm backdrop-blur-md transition-all duration-200 border
                          ${isSelectionsLocked
                              ? "bg-gray-700/50 text-white/50 border-transparent cursor-not-allowed"
                              : hasSelections
                                ? "bg-brand-600 text-white border-brand-500 hover:bg-brand-700 hover:scale-105"
                                : "bg-white/90 text-gray-700 border-white/50 hover:bg-white hover:text-gray-900 hover:scale-105"}
                        `}
                        >
                          {isSelectionsLocked ? (
                            <>
                              <Lock size={14} className="opacity-70" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">{t("sessionDetail.gallery.clientPreview.status.confirmed")}</span>
                            </>
                          ) : (
                            <>
                              {hasSelections ? <Check size={14} strokeWidth={3} /> : <ListPlus size={16} />}
                              <span className="text-[11px] font-bold uppercase tracking-wider">
                                {hasSelections
                                  ? t("sessionDetail.gallery.clientPreview.labels.selected")
                                  : t("sessionDetail.gallery.clientPreview.labels.add")}
                              </span>
                              <ChevronDown size={14} className="opacity-70" aria-hidden="true" />
                            </>
                          )}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={10}
                        className="!w-80 rounded-xl border border-gray-100 bg-white p-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {t("sessionDetail.gallery.clientPreview.labels.addToLists")}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(null)}
                            className="text-gray-400 hover:text-gray-600 bg-gray-50 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label={t("sessionDetail.gallery.clientPreview.actions.closeMenu")}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                          {selectionRules.map((rule) => {
                            const isSelected = selectionIds.includes(rule.id);
                            const isFull = rule.maxCount ? rule.currentCount >= rule.maxCount : false;
                            const isDisabled = !isSelected && isFull;
                            const ruleStatus = getRuleStatus(rule, t);
                            const serviceName = rule.serviceName?.trim() ?? "";
                            const showRange = rule.minCount > 0 && rule.maxCount != null && rule.maxCount !== rule.minCount;
                            const desktopDenominator = showRange ? `${rule.minCount}-${rule.maxCount}` : `${rule.maxCount ?? rule.maxCount}`;

                            return (
                              <button
                                key={rule.id}
                                type="button"
                                onClick={() => {
                                  if (!isDisabled) toggleRuleSelect(photo.id, rule.id);
                                }}
                                disabled={isDisabled}
                                className={`relative w-full flex items-start justify-between gap-3 px-4 py-3 rounded-xl text-sm transition-all border text-left group
                                    ${isSelected
                                    ? "bg-sky-50 border-sky-200 text-sky-900"
                                    : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                  }
                                    ${isDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}
                                  `}
                              >
                                <span
                                  className={`absolute top-2 right-3 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${rule.required
                                    ? "bg-brand-50 text-brand-600 border border-brand-100"
                                    : "bg-gray-100 text-gray-500 border border-gray-200"
                                    }`}
                                >
                                  {rule.required
                                    ? t("sessionDetail.gallery.clientPreview.labels.mandatory")
                                    : t("sessionDetail.gallery.clientPreview.labels.optional")}
                                </span>

                                <div className="min-w-0 flex-1 flex flex-col gap-0.5 pt-6 pr-16">
                                  <div className={`text-sm font-semibold text-left truncate ${isSelected ? "text-brand-900" : "text-gray-900"}`}>
                                    {rule.title}
                                  </div>
                                  {serviceName ? (
                                    <div className="text-[10px] text-gray-400 text-left truncate">
                                      {serviceName}
                                    </div>
                                  ) : null}
                                  <div className={`text-[11px] font-medium text-left ${isFull && !isSelected ? "text-orange-500" : "text-gray-500"}`}>
                                    {rule.currentCount} / {desktopDenominator}
                                    {isFull && !isSelected ? (
                                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider opacity-80 text-orange-600">
                                        {t("sessionDetail.gallery.clientPreview.labels.limitFull")}
                                      </span>
                                    ) : null}
                                    <span className="mx-1.5 opacity-30">•</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ruleStatus.statusColor}`}>
                                      {ruleStatus.statusLabel}
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0 pt-6">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                                        ${isSelected
                                        ? "bg-sky-500 text-white shadow-sm shadow-sky-200"
                                        : "bg-gray-100 text-gray-300 group-hover:bg-white group-hover:border group-hover:border-gray-200"
                                      }
                                      `}
                                  >
                                    {isSelected ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : null}

                {visibleSelectionIds.length > 0 ? (
                  <div className="flex flex-col gap-1.5 items-start" data-testid={`gallery-preview-selection-chips-${photo.id}`}>
                    {visibleSelectionIds.map((selectionId) => (
                      <div
                        key={selectionId}
                        className="bg-black/80 backdrop-blur-md text-white text-[11px] md:text-sm font-semibold px-2.5 py-1.5 rounded-md shadow-md border border-white/10 max-w-full truncate animate-in slide-in-from-left-2 duration-300"
                      >
                        {selectionRuleTitleById.get(selectionId)}
                      </div>
                    ))}
                    {remainingSelectionCount > 0 ? (
                      <div className="bg-black/80 backdrop-blur-md text-white text-[11px] md:text-sm font-semibold px-2.5 py-1.5 rounded-md shadow-md border border-white/10 animate-in slide-in-from-left-2 duration-300">
                        +{remainingSelectionCount}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="absolute top-2 right-2 flex items-center gap-2 z-20 pointer-events-none">
                {photo.isStarred ? (
                  <div className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-md animate-in zoom-in duration-300 pointer-events-auto">
                    <Star size={14} fill="currentColor" />
                  </div>
                ) : null}

                  {favoritesEnabled ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(photo.id);
                      }}
                      className={`w-11 h-11 md:w-8 md:h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-200 pointer-events-auto active:scale-95
                        ${photo.isFavorite
                          ? "bg-red-500 text-white scale-100"
                          : "bg-black/40 text-white md:hover:bg-white md:hover:text-red-500 backdrop-blur-sm"
                        }`}
                      title={
                        photo.isFavorite
                          ? t("sessionDetail.gallery.clientPreview.actions.removeFromFavorites")
                          : t("sessionDetail.gallery.clientPreview.actions.addToFavorites")
                    }
                    aria-label={
                      photo.isFavorite
                        ? t("sessionDetail.gallery.clientPreview.actions.removeFromFavorites")
                        : t("sessionDetail.gallery.clientPreview.actions.addToFavorites")
                    }
                  >
                    <span className="scale-110 md:scale-100">
                      <Heart size={14} fill={photo.isFavorite ? "currentColor" : "none"} />
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

              {!isMenuOpen ? (
                <div
                  onClick={() => openViewer(photo.id)}
                  className="absolute inset-0 bg-black/20 opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4 pointer-events-none z-10"
                >
                  <div className="flex flex-col items-center gap-2 text-white transform translate-y-4 md:group-hover:translate-y-0 transition-transform duration-300">
                    <Maximize2 size={32} strokeWidth={1.5} className="drop-shadow-lg" />
                    <span className="text-[10px] uppercase tracking-widest font-medium drop-shadow-md">
                      {t("sessionDetail.gallery.clientPreview.actions.inspect")}
                    </span>
                  </div>
                </div>
              ) : null}
          </div>
        );
      })}
    </div>
  );

  const renderSelectionSheet = () => {
    if (!sheetPhotoId) return null;
    const photo = resolvedPhotos.find((candidate) => candidate.id === sheetPhotoId);
    if (!photo) return null;

    const closeSheet = () => setSheetPhotoId(null);

    return (
      <MobilePhotoSelectionSheet
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeSheet();
        }}
        photo={{ id: photo.id, url: photo.url, filename: photo.filename }}
        rules={selectionRules.map((rule) => ({
          id: rule.id,
          title: rule.title,
          serviceName: rule.serviceName,
          currentCount: rule.currentCount,
          maxCount: rule.maxCount,
          minCount: rule.minCount,
          required: rule.required,
        }))}
        selectedRuleIds={photo.selections}
        onToggleRule={(ruleId) => toggleRuleSelect(photo.id, ruleId)}
        photoImageBroken={brokenPhotoIds.has(photo.id)}
        onPhotoImageError={() => handleAssetImageError(photo.id)}
        zIndexClassName="z-[200]"
      />
    );
  };

  const renderMobileTasksScreen = () => {
    return (
      <div className="min-h-screen bg-gray-50 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
        <p className="mb-6 text-sm text-gray-500">
          {t("sessionDetail.gallery.clientPreview.selections.subtitle")}
        </p>
        {/* COMPLETE / SENT SECTION - MOVED TO TOP */}
        <div className="mb-4 space-y-3">
          {isSelectionsLocked ? (
            isInternalUserView ? (
              <SelectionLockBanner
                status="locked"
                note={selectionState?.note ?? null}
                onExport={handleExportSelections}
                exportDisabled={exportDisabled}
                onUnlockForClient={() => unlockSelectionsMutation.mutate()}
                unlockDisabled={unlockSelectionsMutation.isPending}
                className="animate-in zoom-in duration-300"
              />
            ) : (
              <ClientSelectionLockedBanner
                note={selectionState?.note ?? null}
                className="animate-in zoom-in duration-300"
              />
            )
          ) : (
            <>
              {showClientReopenedBanner ? (
                <ClientSelectionReopenedBanner
                  note={selectionState?.note ?? null}
                  className="animate-in zoom-in duration-300"
                />
              ) : null}
              {selectionRules.length > 0 ? (
                <button
                  type="button"
                  disabled={!areAllMandatoryComplete}
                  onClick={handleOpenConfirmation}
                  className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest shadow-lg transition-all
                    ${areAllMandatoryComplete
                    ? "bg-gray-900 text-white hover:bg-black hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }
                  `}
                >
                  {showClientReopenedBanner
                    ? t("sessionDetail.gallery.clientPreview.actions.resendSelection")
                    : t("sessionDetail.gallery.clientPreview.actions.completeSelection")}
                  {areAllMandatoryComplete ? <ArrowRight size={16} /> : <Lock size={14} />}
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleMobileTabChange("gallery")}
            className="w-full bg-white p-5 rounded-2xl border border-gray-200 flex items-center gap-4 shadow-sm active:scale-[0.99] transition-transform"
          >
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <LayoutGrid size={20} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-bold text-gray-900 truncate">
                {t("sessionDetail.gallery.clientPreview.selections.allPhotos")}
              </h3>
              <p className="text-xs text-gray-500">{totalPhotoCount}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 shrink-0" />
          </button>

          {unselectedCount > 0 ? (
            <button
              type="button"
              data-testid="gallery-client-preview-unselected-shortcut"
              onClick={() => {
                setActiveFilter("unselected");
                setMobileTab("gallery");
                scrollToContentStart();
              }}
              className="w-full bg-white p-5 rounded-2xl border border-gray-200 flex items-center gap-4 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
                <CircleDashed size={20} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <h3 className="font-bold text-gray-900 truncate">
                  {t("sessionDetail.gallery.clientPreview.filters.unselected")}
                </h3>
                <p className="text-xs text-gray-500">{unselectedCount}</p>
              </div>
              <ArrowRight size={16} className="text-gray-300 shrink-0" />
            </button>
          ) : null}





          <div className="pt-2">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
              {t("sessionDetail.gallery.clientPreview.selections.tasksLabel")}
            </div>
          </div>

          {selectionRules.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
              {t("sessionDetail.gallery.clientPreview.selections.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {selectionRules.map((rule) => {
                const isActive = activeFilter === rule.id;
                const status = getRuleStatus(rule, t);
                const serviceName = rule.serviceName?.trim() ?? "";
                const showRange = rule.minCount > 0 && rule.maxCount != null && rule.maxCount !== rule.minCount;
                const denominator = showRange ? `${rule.minCount}-${rule.maxCount}` : `${rule.maxCount ?? rule.maxCount}`;

                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => handleMobileTaskSelect(rule.id)}
                    className={`w-full bg-white p-4 rounded-2xl border transition-all text-left shadow-sm active:scale-[0.99] group ${isActive ? "border-gray-900 ring-1 ring-gray-900" : status.borderColor
                      }`}
                  >
                    {/* Chip Line */}
                    <div className="mb-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${rule.required
                        ? "bg-brand-50 text-brand-600 border border-brand-100"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}>
                        {rule.required
                          ? t("sessionDetail.gallery.clientPreview.labels.mandatory")
                          : t("sessionDetail.gallery.clientPreview.labels.optional")}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-gray-900 text-sm truncate leading-snug">
                            {rule.title}
                          </h4>
                        </div>
                        {serviceName ? (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate mb-1">
                            {serviceName}
                          </div>
                        ) : null}
                        <p className={`text-[11px] font-bold transition-colors ${status.statusColor}`}>
                          {status.statusLabel}
                        </p>
                      </div>

                      <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center transition-colors ${status.isComplete ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" : "bg-gray-50 text-gray-300"
                        }`}>
                        {status.isComplete ? <Check size={16} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-500 tabular-nums">
                        <span className="text-lg font-bold text-gray-900 mr-0.5">{rule.currentCount}</span>
                        <span className="opacity-60">/ {denominator}</span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${isActive ? "bg-brand-500" : status.progressColor}`}
                        style={{ width: `${status.progress * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

    );
  };

  const starredCount = useMemo(() => resolvedPhotos.filter((photo) => photo.isStarred).length, [resolvedPhotos]);
  const totalPhotoCount = useMemo(() => resolvedPhotos.length, [resolvedPhotos]);
  const totalSelectedCount = useMemo(
    () => resolvedPhotos.filter((photo) => photo.selections.length > 0).length,
    [resolvedPhotos]
  );
  const unselectedCount = useMemo(
    () => resolvedPhotos.filter((photo) => photo.selections.length === 0).length,
    [resolvedPhotos]
  );

  // Status Logic for Navbar
  const { areAllMandatoryComplete, hasIncompleteMandatory } = useMemo(() => {
    // If no rules, nothing to complete
    if (selectionRules.length === 0) {
      return { areAllMandatoryComplete: false, hasIncompleteMandatory: false };
    }

    const mandatoryRules = selectionRules.filter((r) => r.required);

    // If we have mandatory rules, check them
    if (mandatoryRules.length > 0) {
      const allComplete = mandatoryRules.every((rule) => getRuleStatus(rule, t).isComplete);
      const anyIncomplete = mandatoryRules.some((rule) => !getRuleStatus(rule, t).isComplete);
      return {
        areAllMandatoryComplete: allComplete,
        hasIncompleteMandatory: anyIncomplete
      };
    }

    // No mandatory rules -> "Complete" isn't really a state we track for pulsing checkmark 
    // unless we want to track "all optional filled" but usually mandatory is the gate.
    // We'll return false to fall back to standard behavior (Red Dot if selections exist).
    return { areAllMandatoryComplete: false, hasIncompleteMandatory: false };
  }, [selectionRules, t]);

  const isLoading = galleryLoading || setsLoading || photosLoading;
  const heroTitle = gallery?.title || t("sessionDetail.gallery.clientPreview.hero.untitled");
  const heroMode: HeroMode = isSelectionGallery ? "selection" : "delivery";
  const showHero = !isMobile || (mobileTab === "gallery" && activeFilter === "all");

  const navTitle = useMemo(() => {
    if (!isMobile) return heroTitle;
    if (mobileTab === "tasks") return t("sessionDetail.gallery.clientPreview.selections.title");
    if (mobileTab === "favorites") return t("sessionDetail.gallery.clientPreview.filters.favorites");
    if (mobileTab === "starred") return t("sessionDetail.gallery.clientPreview.filters.starred");
    if (activeLightboxRuleId) {
      return selectionRules.find((rule) => rule.id === activeLightboxRuleId)?.title || heroTitle;
    }
    if (activeFilter === "favorites") return t("sessionDetail.gallery.clientPreview.filters.favorites");
    if (activeFilter === "starred") return t("sessionDetail.gallery.clientPreview.filters.starred");
    if (activeFilter === "unselected") return t("sessionDetail.gallery.clientPreview.filters.unselected");
    if (activeFilter === "selected") return t("sessionDetail.gallery.clientPreview.filters.selected");
    return heroTitle;
  }, [activeFilter, activeLightboxRuleId, heroTitle, isMobile, mobileTab, selectionRules, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={36} />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen font-sans text-gray-900 relative">
      {/* --- HERO SECTION --- */}
      {showHero ? (
        <div className={`relative ${isMobile ? "h-[100dvh]" : "h-screen"} w-full overflow-hidden bg-gray-900`}>
          <div className="absolute inset-0">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={t("sessionDetail.gallery.clientPreview.hero.coverAlt")}
                loading="eager"
                className="w-full h-full object-cover opacity-80"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600">
                <ImageIcon size={64} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30" />
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 animate-in fade-in duration-1000 slide-in-from-bottom-10">
            <div
              className={`
              flex items-center gap-2.5 px-5 py-2 rounded-full backdrop-blur-md border shadow-lg mb-8 transition-all
              ${heroMode === "selection"
                  ? "bg-amber-900/30 border-amber-200/30 text-amber-100"
                  : "bg-white/10 border-white/20 text-white"
                }
            `}
              data-testid="gallery-client-preview-hero-badge"
            >
              {heroMode === "selection" ? (
                <ListChecks size={14} className="text-amber-200" />
              ) : (
                <Sparkles size={14} className="text-slate-100" />
              )}
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] leading-none">
                {t(`sessionDetail.gallery.clientPreview.hero.badge.${heroMode}.title`)}
              </span>
            </div>

            <h1 className="font-playfair text-5xl md:text-7xl lg:text-9xl mb-4 tracking-tight drop-shadow-2xl">
              {heroTitle}
            </h1>

            {formattedEventDate ? (
              <div
                className="text-[11px] md:text-sm tracking-[0.25em] uppercase font-medium text-white/80 mb-4"
                data-testid="gallery-client-preview-event-date"
              >
                {formattedEventDate}
              </div>
            ) : null}

            <p className="text-white/80 font-light text-sm md:text-base max-w-lg mx-auto tracking-wide">
              {t(`sessionDetail.gallery.clientPreview.hero.badge.${heroMode}.description`)}
            </p>

            {isMobile ? (
              <button
                type="button"
                onClick={scrollToGallery}
                aria-label={t("sessionDetail.gallery.clientPreview.hero.scrollCta")}
                className="hero-scroll-indicator absolute inset-x-0 mx-auto bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] w-14 h-14 rounded-full border border-white/40 bg-white/20 backdrop-blur-md shadow-lg shadow-black/20 flex items-center justify-center text-white hover:bg-white/30 hover:border-white/50 transition-colors duration-300 cursor-pointer"
              >
                <ArrowDown size={24} className="hero-scroll-indicator-arrow translate-y-px" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToGallery}
                className="group flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.2em] hover:text-white/80 transition-colors cursor-pointer mt-10"
              >
                <span>{t("sessionDetail.gallery.clientPreview.hero.scrollCta")}</span>
                <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center group-hover:bg-white/10 transition-all mt-2">
                  <ArrowDown size={14} className="animate-bounce" />
                </div>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* --- STICKY NAVIGATION --- */}
      <nav
        ref={navRef}
        className={`sticky top-0 z-50 transition-all duration-500 border-b flex flex-col ${scrolled
          ? "bg-white/95 backdrop-blur-md border-gray-100 shadow-sm"
          : "bg-white border-transparent"
          }`}
      >
        {/* ROW 1: Branding, Sets & Main Actions */}
        <div
          className={`w-full px-4 md:px-12 flex items-center justify-between transition-all duration-300 ${scrolled ? "h-16 md:h-20" : "h-16 md:h-32"
            }`}
        >
          {/* Left: Branding & Sets */}
          <div className={`flex items-center min-w-0 ${hasMultipleSets ? "gap-12" : "gap-4"}`}>
            <div
              className={`font-playfair font-bold tracking-tight text-gray-900 transition-all duration-300 truncate ${scrolled ? "text-lg md:text-xl" : "text-lg md:text-3xl"
                }`}
              title={navTitle}
            >
              {navTitle}
            </div>

            {hasMultipleSets ? (
              <div className="hidden md:flex items-center gap-8 overflow-x-auto no-scrollbar">
                {orderedSets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => scrollToSet(set.id)}
                    className={`font-playfair text-sm md:text-base font-semibold tracking-tight transition-colors whitespace-nowrap ${activeCategoryId === set.id
                      ? "text-gray-900 border-b-2 border-black pb-1"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                    aria-current={activeCategoryId === set.id ? "page" : undefined}
                  >
                    {set.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4 md:gap-6 shrink-0">
            {/* Desktop Complete Button */}
            {!isMobile && selectionRules.length > 0 ? (
              isSelectionsLocked ? (
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                  <CheckCircle2 size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {t("sessionDetail.gallery.clientPreview.status.confirmed")}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!areAllMandatoryComplete}
                  onClick={handleOpenConfirmation}
                  className={`hidden md:flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all
                     ${areAllMandatoryComplete
                      ? "bg-gray-900 text-white hover:bg-black shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }
                   `}
                >
                  {showClientReopenedBanner
                    ? t("sessionDetail.gallery.clientPreview.actions.resendSelection")
                    : t("sessionDetail.gallery.clientPreview.actions.completeSelection")}
                  {areAllMandatoryComplete ? <ArrowRight size={14} /> : <Lock size={12} />}
                </button>
              )
            ) : null}

            {isMobile && mobileTab === "gallery" && activeFilter !== "all" ? (
              <button
                type="button"
                data-touch-target="compact"
                onClick={() => {
                  setActiveFilter("all");
                  scrollToContentStart();
                }}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold"
              >
                {tCommon("buttons.clear")}
                <X size={14} className="text-gray-500" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleExit}
              className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label={t("sessionDetail.gallery.clientPreview.actions.close")}
            >
              <X size={20} />
            </button>

            {/* Grid Size Controls */}
            <button
              type="button"
              onClick={handleBulkDownloadClick}
              className="hidden lg:flex items-center justify-center bg-gray-100 text-gray-700 rounded-lg p-2 hover:bg-gray-200 transition-colors"
              aria-label={t("sessionDetail.gallery.clientPreview.actions.downloadAll")}
              title={t("sessionDetail.gallery.clientPreview.actions.downloadAll")}
            >
              <Download size={16} aria-hidden="true" />
            </button>
            <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-1 mr-2">
              <button
                type="button"
                onClick={() => setGridSize("large")}
                className={`p-1.5 rounded-md transition-all ${gridSize === "large"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
                aria-label={t("sessionDetail.gallery.clientPreview.actions.gridLarge")}
              >
                <Rows size={16} />
              </button>
              <button
                type="button"
                onClick={() => setGridSize("medium")}
                className={`p-1.5 rounded-md transition-all ${gridSize === "medium"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
                aria-label={t("sessionDetail.gallery.clientPreview.actions.gridMedium")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setGridSize("small")}
                className={`p-1.5 rounded-md transition-all ${gridSize === "small"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
                  }`}
                aria-label={t("sessionDetail.gallery.clientPreview.actions.gridSmall")}
              >
                <Grid3x3 size={16} />
              </button>
            </div>

          </div>
        </div>

        {/* ROW 2: Sets (Mobile Only) */}
        {hasMultipleSets && (!isMobile || (mobileTab === "gallery" && activeFilter === "all")) ? (
          <div className="md:hidden w-full overflow-x-auto no-scrollbar border-t border-gray-100 bg-white">
            <div className="flex items-center px-4 min-w-max h-12 gap-8">
              {orderedSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => scrollToSet(set.id)}
                  className={`font-playfair text-sm font-semibold tracking-tight transition-all h-full border-b-2 ${activeCategoryId === set.id ? "text-gray-900 border-black" : "text-gray-500 border-transparent"
                    }`}
                  aria-current={activeCategoryId === set.id ? "page" : undefined}
                >
                  {set.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ROW 3: Tasks + Filters */}
        {!isMobile && (isSelectionGallery || hasFavorites) ? (
          <div className="w-full border-t border-gray-100 bg-white overflow-x-auto no-scrollbar px-4 py-4 md:px-12 md:py-2">
            <div className="flex items-start gap-3 min-w-max">
              {isSelectionGallery
                ? selectionRules.map((rule) => {
                    const isActive = activeFilter === rule.id;
                    const status = getRuleStatus(rule, t);
                    const serviceName = rule.serviceName?.trim() ?? "";
                    const showRange =
                      rule.minCount > 0 && rule.maxCount != null && rule.maxCount !== rule.minCount;
                    const desktopDenominator =
                      rule.maxCount != null
                        ? showRange
                          ? `${rule.minCount}-${rule.maxCount}`
                          : `${rule.maxCount}`
                        : rule.minCount > 0
                          ? `${rule.minCount}+`
                          : "0";

                    return (
                      <button
                        key={rule.id}
                        type="button"
                        data-touch-target="compact"
                        onClick={() => setActiveFilter(isActive ? "all" : rule.id)}
                        className={`group relative flex items-center gap-3 min-w-[240px] shrink-0 rounded-full border bg-white px-4 py-2 transition-all text-left hover:shadow-sm ${isActive
                          ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-200"
                          : status.borderColor
                          }`}
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border ${status.isComplete ? "bg-emerald-500 border-emerald-500 text-white" : "bg-gray-50 border-gray-200 text-gray-300"}`}
                        >
                          {status.isComplete ? (
                            <Check size={16} strokeWidth={3} />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-gray-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-semibold text-gray-900 leading-snug truncate">
                            <span className="truncate">{rule.title}</span>
                            {rule.required ? <span className="text-red-500">*</span> : null}
                          </div>
                          {serviceName ? (
                            <p className="text-xs text-gray-500 truncate">{serviceName}</p>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-base font-bold text-gray-900 tabular-nums leading-none">
                              {rule.currentCount}
                            </span>
                            <span className="text-xs font-semibold text-gray-500 tabular-nums">
                              / {desktopDenominator}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                : (
                    <>
                      <button
                        type="button"
                        data-touch-target="compact"
                        onClick={() => {
                          setActiveFilter("all");
                          scrollToContentStart();
                        }}
                        className={`group relative inline-flex items-center gap-2 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all hover:shadow-sm ${activeFilter === "all"
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        aria-current={activeFilter === "all" ? "page" : undefined}
                      >
                        {t("sessionDetail.gallery.clientPreview.filters.all")}
                      </button>

                      <button
                        type="button"
                        data-touch-target="compact"
                        disabled={!favoritesEnabled}
                        onClick={() => {
                          setActiveFilter("favorites");
                          scrollToContentStart();
                        }}
                        className={`group relative inline-flex items-center gap-2 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${activeFilter === "favorites"
                          ? "border-red-500 bg-red-500 text-white shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        aria-current={activeFilter === "favorites" ? "page" : undefined}
                      >
                        <Heart
                          size={16}
                          fill={activeFilter === "favorites" ? "currentColor" : "none"}
                          className={activeFilter === "favorites" ? "" : "text-red-500"}
                          aria-hidden="true"
                        />
                        <span>{t("sessionDetail.gallery.clientPreview.filters.favorites")}</span>
                        {favoritePhotoIds.size > 0 ? (
                          <span
                            className={`ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums ${activeFilter === "favorites" ? "bg-white/20 text-white" : "bg-red-50 text-red-600"}`}
                          >
                            {favoritePhotoIds.size}
                          </span>
                        ) : null}
                      </button>
                    </>
                  )}
            </div>
          </div>
        ) : null}
      </nav>

      {isMobile && mobileTab === "tasks" ? (
        renderMobileTasksScreen()
      ) : (
        <>
          {/* --- GALLERY SECTION --- */}
          <div ref={galleryRef} className="bg-white min-h-screen pt-4 md:pt-6 px-4 md:px-8 pb-32 md:pb-12">
            <div className="w-full">
              {heroMode === "selection" && (isSelectionsLocked || showClientReopenedBanner) ? (
                <div className="mb-6">
                  {isSelectionsLocked ? (
                    isInternalUserView ? (
                      <SelectionLockBanner
                        status="locked"
                        note={selectionState?.note ?? null}
                        onExport={handleExportSelections}
                        exportDisabled={exportDisabled}
                        onUnlockForClient={() => unlockSelectionsMutation.mutate()}
                        unlockDisabled={unlockSelectionsMutation.isPending}
                      />
                    ) : (
                      <ClientSelectionLockedBanner note={selectionState?.note ?? null} />
                    )
                  ) : (
                    <ClientSelectionReopenedBanner note={selectionState?.note ?? null} />
                  )}
                </div>
              ) : null}
              {hasMultipleSets ? (
                filteredPhotos.length === 0 && (activeFilter === "favorites" || activeFilter === "starred") ? (
                  renderEmptyState()
                ) : (
                  <div className="space-y-16">
                    {orderedSets.map((set) => {
                      const setPhotos = filteredPhotosBySetId[set.id] ?? [];
                      const visibleSetCount = visibleCountBySetId[set.id] ?? 0;
                      const visibleSetPhotos = setPhotos.slice(0, visibleSetCount);
                      const hasPhotos = setPhotos.length > 0;
                      const showSkeleton = hasPhotos && visibleSetCount === 0;
                      const showLoader = hasPhotos && visibleSetCount > 0 && visibleSetCount < setPhotos.length;

                      return (
                        <section
                          key={set.id}
                          id={`${SET_SECTION_ID_PREFIX}${set.id}`}
                          data-set-id={set.id}
                          className="scroll-mt-24"
                        >
                          <div
                            className="sticky z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-white/95 backdrop-blur border-b border-gray-100"
                            style={{ top: navHeight }}
                          >
                            <h2 className="font-playfair text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">
                              {set.name}
                            </h2>
                            {set.description ? (
                              <p className="mt-1 text-sm text-gray-500 max-w-2xl">{set.description}</p>
                            ) : null}
                          </div>

                          <div className="pt-6">
                            {!hasPhotos ? (
                              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
                                {t("sessionDetail.gallery.clientPreview.sections.empty")}
                              </div>
                            ) : showSkeleton ? (
                              renderSkeletonGrid(`set-${set.id}`)
                            ) : (
                              renderPhotoGrid(visibleSetPhotos)
                            )}
                          </div>

                          <div
                            id={`${SET_SENTINEL_ID_PREFIX}${set.id}`}
                            data-set-id={set.id}
                            className={showLoader ? "py-12 flex items-center justify-center w-full" : "hidden"}
                          >
                            <Loader2 className="animate-spin text-gray-300" size={32} />
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )
              ) : visiblePhotos.length === 0 ? (
                renderEmptyState()
              ) : (
                <>
                  {renderPhotoGrid(visiblePhotos)}
                  {visibleCount < filteredPhotos.length ? (
                    <div ref={observerTarget} className="py-12 flex items-center justify-center w-full">
                      <Loader2 className="animate-spin text-gray-300" size={32} />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-gray-100 text-center pt-12 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4">
          {branding?.logoUrl || branding?.businessName ? (
            <div className="flex flex-col items-center gap-2 text-center">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={
                    branding.businessName ? "" : t("sessionDetail.gallery.publicAccess.brandingLogoAlt")
                  }
                  className="max-h-12 w-auto max-w-[220px] object-contain"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              {branding.businessName ? (
                <p className="break-words font-playfair text-sm font-semibold leading-tight text-gray-900 md:text-base">
                  {branding.businessName}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xl font-bold font-serif text-gray-900">
              {t("sessionDetail.gallery.clientPreview.footer.brand")}
            </div>
          )}

          <p className="text-gray-400 text-xs uppercase tracking-widest">
            {t("sessionDetail.gallery.clientPreview.footer.copyright")}
          </p>
        </div>
      </footer>

      {!isMobile && (
        <FloatingActionBar
          selectedCount={0}
          onClearSelection={() => { }}
          onSelectAll={() => { }}
          onDelete={() => { }}
          onStar={() => { }}
          mode="client"
          totalRuleSelectedCount={isSelectionGallery ? totalSelectedCount : 0}
          unselectedCount={isSelectionGallery ? unselectedCount : 0}
          favoritesCount={favoritePhotoIds.size}
          starredCount={isSelectionGallery ? starredCount : 0}
          activeFilter={activeFilter}
          onFilter={(filter) => {
            setActiveFilter(filter);
            scrollToContentStart();
          }}
        />
      )}

      {
        isMobile && (isSelectionGallery || hasFavorites) ? (
          <nav
            aria-label={t("sessionDetail.gallery.clientPreview.bottomNav.ariaLabel")}
            className={`mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] transition-transform duration-300 ease-out ${showBottomNav ? "translate-y-0" : "translate-y-full"
              }`}
          >
            <div className="flex items-center justify-around">
              <button
                type="button"
                onClick={() => handleMobileTabChange("gallery")}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${mobileTab === "gallery" ? "text-brand-600 bg-brand-50" : "text-gray-400"
                  }`}
                aria-current={mobileTab === "gallery" ? "page" : undefined}
              >
                <LayoutGrid size={22} strokeWidth={mobileTab === "gallery" ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[10px] font-bold mt-0.5">
                  {t("sessionDetail.gallery.clientPreview.bottomNav.gallery")}
                </span>
              </button>

              {isSelectionGallery ? (
                <button
                  type="button"
                  onClick={() => handleMobileTabChange("tasks")}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${mobileTab === "tasks" ? "text-brand-600 bg-brand-50" : "text-gray-400"
                    }`}
                  aria-current={mobileTab === "tasks" ? "page" : undefined}
                >
                  <div className="relative flex items-center justify-center w-6 h-6">
                    {areAllMandatoryComplete ? (
                      <>
                        {/* Outward Pulse (Slowed Down) */}
                        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20 [animation-duration:3s]" />

                        {/* Fixed Icon: Green BG, White Tick */}
                        <div className="relative z-10 bg-emerald-500 text-white rounded-full p-[3px] shadow-sm">
                          <Check size={14} strokeWidth={4} />
                        </div>
                      </>
                    ) : (
                      <>
                        <ListChecks size={22} strokeWidth={mobileTab === "tasks" ? 2.5 : 2} aria-hidden="true" />
                        {hasIncompleteMandatory ? (
                          <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center p-[2px] border-2 border-white shadow-sm font-bold text-[10px]">
                            !
                          </div>
                        ) : totalSelectedCount > 0 ? (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
                        ) : null}
                      </>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold mt-0.5 ${areAllMandatoryComplete ? "text-emerald-600" : ""}`}>
                    {t("sessionDetail.gallery.clientPreview.bottomNav.selections")}
                  </span>
                </button>
              ) : null}

                <button
                  type="button"
                  disabled={!favoritesEnabled}
                  onClick={() => handleMobileTabChange("favorites")}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${mobileTab === "favorites" ? "text-red-500 bg-red-50" : "text-gray-400"
                    } ${favoritesEnabled ? "" : "opacity-50 cursor-not-allowed"}`}
                  aria-current={mobileTab === "favorites" ? "page" : undefined}
                >
                <div className="relative">
                  <Heart
                    size={22}
                    fill={mobileTab === "favorites" ? "currentColor" : "none"}
                    strokeWidth={mobileTab === "favorites" ? 2.5 : 2}
                    aria-hidden="true"
                  />
                  {favoritePhotoIds.size > 0 ? (
                    <div className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white shadow-sm transition-colors ${mobileTab === "favorites" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                      {favoritePhotoIds.size}
                    </div>
                  ) : null}
                </div>
                <span className="text-[10px] font-bold mt-0.5">
                  {t("sessionDetail.gallery.clientPreview.filters.favorites")}
                  </span>
                </button>

                {isSelectionGallery && starredCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleMobileTabChange("starred")}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${mobileTab === "starred" ? "text-amber-500 bg-amber-50" : "text-gray-400"
                      }`}
                    aria-current={mobileTab === "starred" ? "page" : undefined}
                  >
                    <div className="relative">
                      <Star
                        size={22}
                        fill={mobileTab === "starred" ? "currentColor" : "none"}
                        strokeWidth={mobileTab === "starred" ? 2.5 : 2}
                        aria-hidden="true"
                      />
                      <div
                        className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white shadow-sm transition-colors ${mobileTab === "starred" ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600"
                          }`}
                      >
                        {starredCount}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold mt-0.5">
                      {t("sessionDetail.gallery.clientPreview.bottomNav.starred")}
                    </span>
                  </button>
                ) : null}
              </div>
            </nav>
          ) : null
        }

      <SelectionExportSheet
        open={exportSheetOpen}
        onOpenChange={setExportSheetOpen}
        photos={resolvedPhotos}
        rules={selectionRules}
      />

      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photos={filteredPhotos}
        currentIndex={lightboxIndex}
        onNavigate={handleLightboxNavigate}
        rules={selectionRules}
        onToggleRule={toggleRuleSelect}
        onToggleStar={handleToggleFavorite}
        mode="client"
        activeRuleId={activeLightboxRuleId}
        favoritesEnabled={favoritesEnabled}
        onImageError={handleAssetImageError}
        enableOriginalSwap={isFinalGallery}
        resolveOriginalUrl={isFinalGallery ? resolveLightboxOriginalUrl : undefined}
        watermark={watermark}
        isSelectionsLocked={isSelectionsLocked}
      />

      {renderSelectionSheet()}

      <Dialog open={isConfirmationModalOpen} onOpenChange={setIsConfirmationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sessionDetail.gallery.clientPreview.confirmation.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4 flex gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900 text-sm mb-1">
                  {t("sessionDetail.gallery.clientPreview.confirmation.bannerTitle")}
                </h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  {t("sessionDetail.gallery.clientPreview.confirmation.bannerDesc")}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t("sessionDetail.gallery.clientPreview.confirmation.noteLabel")}
              </label>
              <textarea
                value={photographerNote}
                onChange={(e) => setPhotographerNote(e.target.value)}
                placeholder={t("sessionDetail.gallery.clientPreview.confirmation.notePlaceholder")}
                className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none resize-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3 sm:justify-between p-6 pt-2 bg-gray-50/50">
            <DialogClose asChild>
              <button
                type="button"
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {t("sessionDetail.gallery.clientPreview.confirmation.cancel")}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleConfirmSelections}
              className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <SendHorizontal size={16} />
              {t("sessionDetail.gallery.clientPreview.confirmation.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
