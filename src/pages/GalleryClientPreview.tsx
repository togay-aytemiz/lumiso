import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deserializeSelectionTemplate, type SelectionTemplateRuleForm } from "@/components/SelectionTemplateSection";
import { Lightbox } from "@/components/galleries/Lightbox";
import { GALLERY_ASSETS_BUCKET, getStorageBasename, isSupabaseStorageObjectMissingError } from "@/lib/galleryAssets";
import { useI18nToast } from "@/lib/toastHelpers";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Grid3x3,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  ListPlus,
  Loader2,
  Maximize2,
  Rows,
  SearchX,
  Sparkles,
  Star,
  X,
} from "lucide-react";

type GridSize = "small" | "medium" | "large";
type FilterType = "all" | "favorites" | "starred" | "unselected" | "selected" | string;
type HeroMode = "selection" | "delivery";

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
  status: "processing" | "ready" | "failed";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ClientPreviewPhotoBase = {
  id: string;
  url: string;
  filename: string;
  setId: string | null;
  isStarred: boolean;
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

const ITEMS_PER_PAGE = 15;
const GALLERY_ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60;

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

export default function GalleryClientPreview() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const i18nToast = useI18nToast();
  const navigate = useNavigate();

  const galleryRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const [gridSize, setGridSize] = useState<GridSize>("small");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [activeSetId, setActiveSetId] = useState<string>("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [sheetPhotoId, setSheetPhotoId] = useState<string | null>(null);

  const [favoritePhotoIds, setFavoritePhotoIds] = useState<Set<string>>(() => new Set());
  const [photoSelectionsById, setPhotoSelectionsById] = useState<Record<string, string[]>>({});

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ["gallery", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<GalleryDetailRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("galleries")
        .select("id,title,type,branding")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as GalleryDetailRow;
    },
  });

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
      return (data as GallerySetRow[]) ?? [];
    },
  });

  const { data: photosBase, isLoading: photosLoading } = useQuery({
    queryKey: ["gallery_client_preview_photos", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ClientPreviewPhotoBase[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("gallery_assets")
        .select("id,storage_path_web,status,metadata,created_at")
        .eq("gallery_id", id)
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
          .eq("gallery_id", id)
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

        return {
          id: row.id,
          url,
          filename,
          setId,
          isStarred,
        };
      });
    },
  });

  const brandingData = useMemo(() => (gallery?.branding || {}) as Record<string, unknown>, [gallery?.branding]);
  const selectionSettings = useMemo(() => (brandingData.selectionSettings || {}) as Record<string, unknown>, [brandingData]);
  const favoritesEnabled = selectionSettings.allowFavorites !== false;
  const eventDate = typeof brandingData.eventDate === "string" ? brandingData.eventDate : "";

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
    const groups = parseSelectionTemplateGroups(brandingData);
    const rules: ClientPreviewRuleBase[] = [];

    groups.forEach((group, groupIndex) => {
      if (group.disabled) return;
      group.rules.forEach((rule, ruleIndex) => {
        const part = typeof rule.part === "string" ? rule.part.trim() : "";
        const normalizedKey = normalizeSelectionPartKey(part);
        const minCount = Math.max(0, parseCountValue(rule.min) ?? 0);
        const rawMax = parseCountValue(rule.max);
        const maxCount = rawMax != null ? Math.max(rawMax, minCount) : null;
        const ruleId = `${group.key}-${groupIndex}-${normalizedKey || ruleIndex}`;
        const required = rule.required !== false;

        rules.push({
          id: ruleId,
          title: part || t("sessionDetail.gallery.selectionTemplate.customLabel"),
          serviceName: group.serviceName ?? null,
          minCount,
          maxCount,
          required,
        });
      });
    });

    return rules;
  }, [brandingData, parseSelectionTemplateGroups, t]);

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

  const defaultSetName = t("sessionDetail.gallery.sets.defaultName");
  const resolvedSets = useMemo<GallerySetRow[]>(() => {
    if (sets && sets.length > 0) return sets;
    return [
      {
        id: "default-placeholder",
        name: defaultSetName,
        description: null,
        order_index: 1,
      },
    ];
  }, [defaultSetName, sets]);
  const showSetTabs = resolvedSets.length > 1;

  useEffect(() => {
    if (!resolvedSets.length) return;
    if (!activeSetId) {
      setActiveSetId(resolvedSets[0].id);
      return;
    }
    if (!resolvedSets.some((set) => set.id === activeSetId)) {
      setActiveSetId(resolvedSets[0].id);
    }
  }, [activeSetId, resolvedSets]);

  const resolvedPhotos = useMemo<ClientPreviewPhoto[]>(() => {
    const fallbackSetId = resolvedSets[0]?.id ?? null;
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
  }, [favoritePhotoIds, favoritesEnabled, photoSelectionsById, photosBase, resolvedSets]);

  const activeSetLabel = useMemo(() => {
    const active = activeSetId ? resolvedSets.find((set) => set.id === activeSetId) ?? null : null;
    return (active ?? resolvedSets[0] ?? null)?.name ?? defaultSetName;
  }, [activeSetId, defaultSetName, resolvedSets]);

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

  // Scroll to top on mount
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      // noop (jsdom)
    }
  }, []);

  // Reset visible count when filter or set changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeFilter, activeSetId]);

  // Sticky Nav Logic
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Infinite Scroll Logic
  const filteredPhotos = useMemo(() => {
    const setPhotos = activeSetId ? resolvedPhotos.filter((photo) => photo.setId === activeSetId) : resolvedPhotos;

    switch (activeFilter) {
      case "all":
        return setPhotos;
      case "favorites":
        return setPhotos.filter((photo) => photo.isFavorite);
      case "starred":
        return setPhotos.filter((photo) => photo.isStarred);
      case "unselected":
        return setPhotos.filter((photo) => photo.selections.length === 0);
      case "selected":
        return setPhotos.filter((photo) => photo.selections.length > 0);
      default:
        return setPhotos.filter((photo) => photo.selections.includes(activeFilter));
    }
  }, [resolvedPhotos, activeSetId, activeFilter]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < filteredPhotos.length) {
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredPhotos.length));
          }, 100);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [filteredPhotos.length, visibleCount]);

  // Click Outside to Close Menus
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeMenuId]);

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);

  const scrollToGallery = () => {
    try {
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    } catch {
      // noop (jsdom)
    }
  };

  const openViewer = (index: number) => {
    setLightboxIndex(index);
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

  const toggleFavorite = useCallback(
    (photoId: string) => {
      if (!favoritesEnabled) return;
      setFavoritePhotoIds((prev) => {
        const next = new Set(prev);
        if (next.has(photoId)) next.delete(photoId);
        else next.add(photoId);
        return next;
      });
    },
    [favoritesEnabled]
  );

  const handleToggleFavorite = useCallback(
    (photoId: string) => {
      if (!favoritesEnabled) return;
      const wasFavorite = favoritePhotoIds.has(photoId);
      toggleFavorite(photoId);
      i18nToast.success(
        wasFavorite
          ? t("sessionDetail.gallery.clientPreview.toast.favoritesRemoved")
          : t("sessionDetail.gallery.clientPreview.toast.favoritesAdded"),
        { duration: 2000 }
      );
    },
    [favoritePhotoIds, favoritesEnabled, i18nToast, t, toggleFavorite]
  );

  const handleExit = useCallback(() => {
    if (id) {
      navigate(`/galleries/${id}`);
      return;
    }
    navigate(-1);
  }, [id, navigate]);

  const toggleRuleSelect = useCallback((photoId: string, ruleId: string) => {
    setPhotoSelectionsById((prev) => {
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

  const getGridClass = () => {
    switch (gridSize) {
      case "large":
        return "columns-1 md:columns-2 gap-4 space-y-4";
      case "small":
        return "columns-2 md:columns-4 lg:columns-5 gap-4 space-y-4";
      default:
        return "columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4";
    }
  };

  const renderEmptyState = () => {
    let content = {
      icon: SearchX,
      title: t("sessionDetail.gallery.clientPreview.empty.noPhotos.title"),
      desc: t("sessionDetail.gallery.clientPreview.empty.noPhotos.description"),
      actionLabel: t("sessionDetail.gallery.clientPreview.empty.noPhotos.action"),
      action: () => setActiveFilter("all"),
      color: "text-gray-400",
    };

    if (activeFilter === "favorites") {
      content = {
        icon: Heart,
        title: t("sessionDetail.gallery.clientPreview.empty.favorites.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.favorites.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.favorites.action"),
        action: () => setActiveFilter("all"),
        color: "text-red-400",
      };
    } else if (activeFilter === "starred") {
      content = {
        icon: Star,
        title: t("sessionDetail.gallery.clientPreview.empty.starred.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.starred.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.starred.action"),
        action: () => setActiveFilter("all"),
        color: "text-amber-400",
      };
    } else if (activeFilter === "unselected") {
      content = {
        icon: CheckCircle2,
        title: t("sessionDetail.gallery.clientPreview.empty.unselected.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.unselected.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.unselected.action"),
        action: () => setActiveFilter("all"),
        color: "text-green-500",
      };
    } else if (activeFilter === "selected") {
      content = {
        icon: CheckCircle2,
        title: t("sessionDetail.gallery.clientPreview.empty.selected.title"),
        desc: t("sessionDetail.gallery.clientPreview.empty.selected.description"),
        actionLabel: t("sessionDetail.gallery.clientPreview.empty.selected.action"),
        action: () => setActiveFilter("all"),
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
          action: () => setActiveFilter("all"),
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

  const renderSelectionSheet = () => {
    if (!sheetPhotoId) return null;
    const photo = resolvedPhotos.find((candidate) => candidate.id === sheetPhotoId);
    if (!photo) return null;

    const closeSheet = () => setSheetPhotoId(null);

    return (
      <div className="fixed inset-0 z-[200] flex flex-col justify-end md:hidden">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSheet} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-preview-selection-sheet-title"
          className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

          <div className="flex items-start gap-4 mb-6 border-b border-gray-100 pb-6">
            {photo.url ? (
              <img
                src={photo.url}
                className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                alt={photo.filename}
                loading="lazy"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                <ImageIcon size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h3 id="client-preview-selection-sheet-title" className="font-bold text-lg text-gray-900">
                {t("sessionDetail.gallery.clientPreview.labels.addToLists")}
              </h3>
              <p className="text-sm text-gray-500">{t("sessionDetail.gallery.lightbox.sidebar.client.description")}</p>
            </div>
          </div>

	          <div className="space-y-3">
	            {selectionRules.map((rule) => {
	              const selectionIds = photo.selections;
	              const isSelected = selectionIds.includes(rule.id);
	              const isFull = rule.maxCount ? rule.currentCount >= rule.maxCount : false;
	              const isDisabled = !isSelected && isFull;
                const serviceName = rule.serviceName?.trim() ?? "";

	              return (
	                <button
	                  key={rule.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) toggleRuleSelect(photo.id, rule.id);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left
                    ${isSelected ? "bg-brand-50 border-brand-200 shadow-sm" : "bg-white border-gray-100 active:bg-gray-50"}
                    ${isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-400"}
                      `}
                    >
                      {isSelected ? <Check size={18} strokeWidth={3} /> : <ListPlus size={18} />}
	                    </div>
	                    <div className="min-w-0">
                        {serviceName ? (
                          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate">
                            {serviceName}
                          </div>
                        ) : null}
	                      <div className={`font-bold text-sm truncate ${isSelected ? "text-brand-900" : "text-gray-900"}`}>
	                        {rule.title}
	                      </div>
	                      <div className="text-xs text-gray-500">
	                        {rule.currentCount} / {rule.maxCount || "∞"}
                      </div>
                    </div>
                  </div>

                  {isDisabled && !isSelected ? (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded">
                      {t("sessionDetail.gallery.clientPreview.labels.limitFull")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={closeSheet}
            className="w-full mt-6 bg-gray-900 text-white py-4 rounded-xl font-bold text-sm"
          >
            {tCommon("buttons.close")}
          </button>
        </div>
      </div>
    );
  };

  const currentSetStarredCount = useMemo(() => {
    if (!activeSetId) return 0;
    return resolvedPhotos.filter((photo) => photo.setId === activeSetId && photo.isStarred).length;
  }, [activeSetId, resolvedPhotos]);

  const currentSetPhotoCount = useMemo(() => {
    if (!activeSetId) return resolvedPhotos.length;
    return resolvedPhotos.filter((photo) => photo.setId === activeSetId).length;
  }, [activeSetId, resolvedPhotos]);

  const totalSelectedInSet = useMemo(() => {
    if (!activeSetId) return 0;
    return resolvedPhotos.filter((photo) => photo.setId === activeSetId && photo.selections.length > 0).length;
  }, [activeSetId, resolvedPhotos]);

  const isLoading = galleryLoading || setsLoading || photosLoading;
  const heroTitle = gallery?.title || t("sessionDetail.gallery.clientPreview.hero.untitled");
  const heroMode: HeroMode = gallery?.type === "final" ? "delivery" : "selection";

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
      <div className="relative h-screen w-full overflow-hidden bg-gray-900">
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
              ${
                heroMode === "selection"
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
        </div>
      </div>

      {/* --- STICKY NAVIGATION --- */}
      <nav
        className={`sticky top-0 z-50 transition-all duration-500 border-b flex flex-col ${
          scrolled
            ? "bg-white/95 backdrop-blur-md border-gray-100 shadow-sm"
            : "bg-white border-transparent"
        }`}
	      >
	        {/* ROW 1: Branding, Sets & Main Actions */}
	        <div
	          className={`w-full px-4 md:px-12 flex items-center justify-between transition-all duration-300 ${
	            scrolled ? "h-16 md:h-20" : "h-16 md:h-32"
	          }`}
	        >
          {/* Left: Branding & Sets */}
          <div className={`flex items-center min-w-0 ${showSetTabs ? "gap-12" : "gap-4"}`}>
		            <div
		              className={`font-playfair font-bold tracking-tight text-gray-900 transition-all duration-300 truncate ${
		                scrolled ? "text-lg md:text-xl" : "text-lg md:text-3xl"
		              }`}
		              title={heroTitle}
		            >
	              {heroTitle}
	            </div>

              {showSetTabs ? (
	              <div className="hidden md:flex items-center gap-8 overflow-x-auto no-scrollbar">
	                {resolvedSets.map((set) => (
	                  <button
	                    key={set.id}
	                    type="button"
                    onClick={() => setActiveSetId(set.id)}
                    className={`text-sm font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                      activeSetId === set.id
                        ? "text-gray-900 border-b-2 border-black pb-1"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {set.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4 md:gap-6 shrink-0">
            <button
              type="button"
              onClick={handleExit}
              className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label={t("sessionDetail.gallery.clientPreview.actions.close")}
            >
              <X size={20} />
            </button>

            {/* Grid Size Controls */}
            <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-1 mr-2">
              <button
                type="button"
                onClick={() => setGridSize("large")}
                className={`p-1.5 rounded-md transition-all ${
                  gridSize === "large"
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
                className={`p-1.5 rounded-md transition-all ${
                  gridSize === "medium"
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
                className={`p-1.5 rounded-md transition-all ${
                  gridSize === "small"
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
          {showSetTabs ? (
	          <div className="md:hidden w-full overflow-x-auto no-scrollbar border-t border-gray-100 bg-white">
	            <div className="flex items-center px-4 min-w-max h-12 gap-8">
	              {resolvedSets.map((set) => (
	                <button
	                  key={set.id}
	                  type="button"
	                  onClick={() => setActiveSetId(set.id)}
	                  className={`text-sm font-bold uppercase tracking-widest transition-all h-full border-b-2 ${
	                    activeSetId === set.id ? "text-gray-900 border-black" : "text-gray-400 border-transparent"
	                  }`}
	                >
	                  {set.name}
	                </button>
	              ))}
	            </div>
	          </div>
          ) : null}

	        {/* ROW 3: Tasks */}
	        {selectionRules.length > 0 ? (
	          <div className="w-full border-t border-gray-100 bg-white overflow-x-auto no-scrollbar px-4 py-4 md:px-12">
	            <div className="flex items-stretch gap-4 min-w-max">
	              <button
	                type="button"
	                data-touch-target="compact"
	                onClick={() => setActiveFilter("all")}
	                className={`w-[220px] shrink-0 rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition-colors ${
	                  activeFilter === "all"
	                    ? "border-gray-900"
	                    : "border-gray-200 hover:border-gray-300"
	                }`}
	              >
	                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 truncate">
	                  {activeSetLabel}
	                </p>
	                <div className="mt-4 flex items-center gap-3">
	                  <LayoutGrid size={18} className="text-gray-900" aria-hidden="true" />
	                  <span className="text-sm font-bold text-gray-900">
	                    {t("sessionDetail.gallery.clientPreview.filters.all")}
	                  </span>
	                </div>
	                <div className="mt-4 text-xs font-semibold text-gray-400">
	                  {currentSetPhotoCount}
	                </div>
	              </button>

		              {selectionRules.map((rule) => {
		                const isActive = activeFilter === rule.id;
		                const isComplete = rule.currentCount >= rule.minCount;
		                const targetCount = rule.maxCount ?? Math.max(1, rule.minCount);
		                const progress = targetCount > 0 ? Math.min(1, rule.currentCount / targetCount) : 0;
                    const serviceName = rule.serviceName?.trim() ?? "";

		                return (
		                  <button
		                    key={rule.id}
	                    type="button"
	                    data-touch-target="compact"
	                    onClick={() => setActiveFilter(isActive ? "all" : rule.id)}
	                    className={`w-[240px] shrink-0 rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition-colors ${
	                      isActive
	                        ? "border-gray-900"
	                        : isComplete
	                          ? "border-emerald-200 hover:border-emerald-300"
	                          : "border-gray-200 hover:border-gray-300"
	                    }`}
	                  >
                        {serviceName ? (
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate">
                            {serviceName}
                          </p>
                        ) : null}

		                    <div className={`flex items-start justify-between gap-3 ${serviceName ? "mt-2" : ""}`}>
		                      <p className="text-sm font-bold text-gray-900 truncate">{rule.title}</p>
		                      <p className="text-xs font-bold text-gray-500 shrink-0">
		                        {rule.currentCount}/{rule.maxCount ?? rule.minCount}
		                      </p>
		                    </div>

	                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
	                      <span className="truncate">
	                        {t("sessionDetail.gallery.clientPreview.tasks.selectedCount", { count: rule.currentCount })}
	                      </span>
	                      {isComplete ? (
	                        <span className="text-emerald-600 font-semibold">
	                          <CheckCircle2 size={14} className="inline-block align-[-2px]" aria-hidden="true" />{" "}
	                        </span>
	                      ) : null}
	                    </div>

	                    <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
	                      <div className="h-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
	                    </div>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        ) : null}

	        {/* ROW 4: Filters */}
	        <div className="w-full border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm overflow-x-auto no-scrollbar py-3 px-4 md:px-12 flex items-center justify-between gap-6">
	          <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                {t("sessionDetail.gallery.clientPreview.filters.label")}
              </span>
	            <div className="flex items-center gap-2">
	              <button
	                type="button"
	                data-touch-target="compact"
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    activeFilter === "all"
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  {t("sessionDetail.gallery.clientPreview.filters.all")}
                </button>

	              <button
	                type="button"
	                data-touch-target="compact"
	                onClick={() => setActiveFilter("starred")}
	                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all border ${
	                  activeFilter === "starred"
	                    ? "bg-amber-100 text-amber-700 border-amber-200 shadow-sm"
	                    : "bg-white border-transparent text-gray-500 hover:text-amber-600 hover:bg-amber-50"
	                }`}
	              >
	                <Star
	                  size={12}
	                  fill="currentColor"
	                  className={activeFilter === "starred" ? "text-amber-700" : "text-amber-400"}
	                />
	                <span className="md:hidden">{t("sessionDetail.gallery.clientPreview.filters.starredShort")}</span>
	                <span className="hidden md:inline">{t("sessionDetail.gallery.clientPreview.filters.starred")}</span>
	                {currentSetStarredCount > 0 ? (
	                  <span className="ml-0.5 opacity-60">({currentSetStarredCount})</span>
	                ) : null}
	              </button>

                {favoritesEnabled ? (
                  <>
                    <div className="w-px h-4 bg-gray-300 mx-1" />
                    <button
                      type="button"
                      data-touch-target="compact"
                      onClick={() => setActiveFilter("favorites")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                        activeFilter === "favorites"
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : "text-gray-500 hover:text-red-500"
                      }`}
                    >
                      <Heart size={12} fill={activeFilter === "favorites" ? "currentColor" : "none"} />
                      {t("sessionDetail.gallery.clientPreview.filters.favorites")}
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  data-touch-target="compact"
                  onClick={() => setActiveFilter("unselected")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    activeFilter === "unselected"
                      ? "bg-gray-200 text-gray-900"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <CircleDashed size={12} />
                  {t("sessionDetail.gallery.clientPreview.filters.unselected")}
                </button>
              </div>
            </div>
          </div>
      </nav>

	      {/* --- GALLERY SECTION --- */}
	      <div ref={galleryRef} className="bg-white min-h-screen py-12 px-4 md:px-8 pb-32 md:pb-12">
        <div className="w-full">
          {visiblePhotos.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <div className={getGridClass()}>
                {visiblePhotos.map((photo, index) => {
                  const isMenuOpen = activeMenuId === photo.id;
                  const selectionIds = photo.selections;
                  const hasSelections = selectionIds.length > 0;
                  const resolvedSelectionIds = selectionIds.filter((selectionId) => selectionRuleTitleById.has(selectionId));
                  const visibleSelectionIds = resolvedSelectionIds.slice(0, 2);
                  const remainingSelectionCount = Math.max(0, resolvedSelectionIds.length - visibleSelectionIds.length);

                  return (
                    <div
                      key={photo.id}
                      className="break-inside-avoid group relative mb-4 z-0"
                      style={{ zIndex: isMenuOpen ? 50 : 0 }}
                    >
                      <div
                        onClick={() => openViewer(index)}
                        className="overflow-hidden rounded-sm bg-gray-100 relative cursor-pointer"
                      >
                        {photo.url ? (
                          <img
                            src={photo.url}
                            alt={photo.filename}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] bg-gray-200 flex items-center justify-center text-gray-500">
                            <ImageIcon size={32} />
                          </div>
                        )}

	                        <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-2 max-w-[70%]">
	                          {selectionRules.length > 0 ? (
	                            <div className="relative">
	                              <button
	                                type="button"
	                                onClick={(e) => {
	                                  e.stopPropagation();
	                                  setSheetPhotoId((prev) => (prev === photo.id ? null : photo.id));
	                                }}
	                                aria-label={
	                                  hasSelections
	                                    ? t("sessionDetail.gallery.clientPreview.labels.selected")
	                                    : t("sessionDetail.gallery.clientPreview.labels.add")
	                                }
	                                className={`md:hidden w-11 h-11 rounded-full flex items-center justify-center shadow-md backdrop-blur-md transition-all duration-200 active:scale-95
	                                  ${hasSelections ? "bg-brand-500 text-white" : "bg-white/90 text-gray-900"}
	                                `}
	                              >
	                                {hasSelections ? <Check size={16} strokeWidth={3} /> : <ListPlus size={18} />}
	                              </button>

	                              <button
	                                type="button"
	                                onClick={(e) => {
	                                  e.stopPropagation();
	                                  setActiveMenuId(isMenuOpen ? null : photo.id);
	                                }}
	                                className={`hidden md:flex h-8 px-3 rounded-full items-center gap-2 shadow-sm transition-all duration-200 backdrop-blur-md border border-white/20
	                                  ${
	                                    isMenuOpen
	                                      ? "bg-white text-gray-900 shadow-xl"
	                                      : "bg-black/40 text-white hover:bg-white hover:text-gray-900"
	                                  }
	                                  ${hasSelections ? "bg-brand-500 text-white !border-brand-400" : ""}
	                                `}
	                              >
	                                {hasSelections ? <Check size={14} strokeWidth={3} /> : <ListPlus size={14} />}
	                                <span className="text-[10px] font-bold uppercase tracking-wide">
	                                  {hasSelections
	                                    ? t("sessionDetail.gallery.clientPreview.labels.selected")
	                                    : t("sessionDetail.gallery.clientPreview.labels.add")}
	                                </span>
	                              </button>

                              {isMenuOpen ? (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="hidden md:block absolute left-0 top-10 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-[100] animate-in fade-in zoom-in-95 duration-150 origin-top-left cursor-default"
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

                                      return (
                                        <button
                                          key={rule.id}
                                          type="button"
                                          onClick={() => {
                                            if (!isDisabled) toggleRuleSelect(photo.id, rule.id);
                                          }}
                                          disabled={isDisabled}
                                          className={`w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all border text-left group
                                            ${
                                              isSelected
                                                ? "bg-sky-50 border-sky-200 text-sky-900"
                                                : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                            }
                                            ${isDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}
                                          `}
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <span
                                              className={`font-semibold ${
                                                isSelected ? "text-sky-700" : "text-gray-700"
                                              }`}
                                            >
                                              {rule.title}
                                            </span>
                                            <span className={`text-[10px] ${isSelected ? "text-sky-500" : "text-gray-400"}`}>
                                              {rule.currentCount} / {rule.maxCount || "∞"}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-3">
                                            {isDisabled ? (
                                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                                                {t("sessionDetail.gallery.clientPreview.labels.limitFull")}
                                              </span>
                                            ) : null}
                                            {isSelected ? (
                                              <span className="text-[9px] font-bold text-sky-600 uppercase tracking-wide">
                                                {t("sessionDetail.gallery.clientPreview.labels.added")}
                                              </span>
                                            ) : null}

                                            <div
                                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                                                ${
                                                  isSelected
                                                    ? "bg-sky-500 text-white shadow-sm shadow-sky-200"
                                                    : "bg-gray-100 text-gray-300 group-hover:bg-white group-hover:border group-hover:border-gray-200"
                                                }
                                              `}
                                            >
                                              {isSelected ? (
                                                <Check size={14} strokeWidth={3} />
                                              ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
	                            </div>
	                          ) : null}

	                          {visibleSelectionIds.length > 0 ? (
	                            <div
	                              className="flex flex-col gap-1.5 items-start"
	                              data-testid={`gallery-preview-selection-chips-${photo.id}`}
	                            >
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
		                                ${
		                                  photo.isFavorite
		                                    ? "bg-red-500 text-white scale-100"
		                                    : "bg-black/40 text-white hover:bg-white hover:text-red-500 backdrop-blur-sm"
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
                          onClick={() => openViewer(index)}
                          className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4 pointer-events-none z-10"
                        >
                          <div className="flex flex-col items-center gap-2 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
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

              {visibleCount < filteredPhotos.length ? (
                <div ref={observerTarget} className="py-12 flex items-center justify-center w-full">
                  <Loader2 className="animate-spin text-gray-300" size={32} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* --- FOOTER --- */}
	      <footer className="bg-white py-12 border-t border-gray-100 text-center">
	        <div className="flex items-center justify-center gap-2 text-xl font-bold font-serif mb-4 text-gray-900">
	          {t("sessionDetail.gallery.clientPreview.footer.brand")}
	        </div>
	        <p className="text-gray-400 text-xs uppercase tracking-widest">
	          {t("sessionDetail.gallery.clientPreview.footer.copyright")}
	        </p>
	      </footer>

	      {totalSelectedInSet > 0 && activeFilter !== "selected" ? (
	        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-6 duration-500">
	          <button
	            type="button"
	            onClick={() => setActiveFilter("selected")}
	            className="bg-gray-900 text-white pl-4 pr-6 py-3 rounded-full shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform"
	          >
	            <div className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-sm font-bold">
	              {totalSelectedInSet}
	            </div>
	            <div className="text-left">
	              <div className="text-[10px] opacity-70 uppercase tracking-wider font-medium">
	                {t("sessionDetail.gallery.clientPreview.floatingSelections.kicker")}
	              </div>
	              <div className="text-xs font-bold uppercase tracking-wider">
	                {t("sessionDetail.gallery.clientPreview.floatingSelections.title")}
	              </div>
	            </div>
	            <ArrowRight size={16} className="ml-2" />
	          </button>
	        </div>
	      ) : null}

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
	      />

      {renderSelectionSheet()}
    </div>
  );
}
