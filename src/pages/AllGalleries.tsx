import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, tr } from "date-fns/locale";
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
  type AdvancedTableColumn,
} from "@/components/data-table";
import GlobalSearch from "@/components/GlobalSearch";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StorageWidget } from "@/components/ui/storage-widget";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { KpiCard } from "@/components/ui/kpi-card";
import { getKpiIconPreset } from "@/components/ui/kpi-presets";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { GalleryStatusChip, type GalleryStatus } from "@/components/galleries/GalleryStatusChip";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { countSelectionsByParts, countUniqueSelectedAssets, normalizeSelectionPartKey } from "@/lib/gallerySelections";
import { SelectionExportSheet, type SelectionExportPhoto, type SelectionExportRule } from "@/components/galleries/SelectionExportSheet";
import { FAVORITES_FILTER_ID } from "@/components/galleries/SelectionDashboard";
import { GALLERY_ASSETS_BUCKET } from "@/lib/galleryAssets";
import { deleteGalleryWithAssets } from "@/lib/galleryDeletion";
import { useI18nToast } from "@/lib/toastHelpers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ORG_GALLERY_STORAGE_LIMIT_BYTES } from "@/lib/storageLimits";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Images,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

interface GalleryRow {
  id: string;
  title: string;
  status: GalleryStatus;
  type: string;
  branding: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  session_id: string | null;
  project_id: string | null;
  previous_status: string | null;
  selection_state?:
  | {
    is_locked: boolean;
    locked_at: string | null;
    note: string | null;
    updated_at: string;
  }
  | null
  | undefined;
  gallery_assets?: { id: string }[];
}

interface SessionRow {
  id: string;
  session_name: string | null;
  session_date: string;
  project?: { id: string; name: string } | null;
  lead?: { id: string; name: string; email: string | null; phone: string | null } | null;
}

interface ProjectRow {
  id: string;
  name: string;
}

interface SelectionRow {
  gallery_id: string;
  asset_id: string | null;
  selection_part: string | null;
}

interface AssetRow {
  id: string;
  storage_path_web: string | null;
  metadata: Record<string, unknown> | null;
}

interface DownloadEventRow {
  gallery_id: string;
  downloaded_at: string;
}

interface GalleryListItem {
  id: string;
  title: string;
  status: GalleryStatus;
  type: string;
  updatedAt: string;
  eventDate: string | null;
  expiresAt: string | null;
  session: SessionRow | null;
  project: ProjectRow | null;
  selectionNote: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  selectionCount: number;
  requiredCount: number;
  sizeBytes?: number | null;
  downloadedAt: string | null;
  coverUrl: string;
  exportPhotos: SelectionExportPhoto[];
  exportRules: SelectionExportRule[];
  previousStatus: GalleryStatus | null;
  totalAssetCount: number;
}

type GalleryTypeFilter = "all" | "selection" | "final";
type StatusFilter = "active" | "pending" | "approved" | "archived";
type GalleryFilterOptions = {
  typeFilter: GalleryTypeFilter;
  statusFilter: StatusFilter;
  searchTerm: string;
};

type GalleryQueryResult = GalleryRow & {
  sessions?: SessionRow | SessionRow[] | null;
  projects?: ProjectRow | ProjectRow[] | null;
  gallery_selection_states?: GalleryRow["selection_state"] | GalleryRow["selection_state"][];
};

const COVER_SIGNED_URL_TTL_SECONDS = 60 * 60;
const isSelectionGalleryType = (value: string) => value === "proof";
const isFinalGalleryType = (value: string) => value === "final";

const normalizeSelectionRules = (branding?: Record<string, unknown> | null) => {
  const template = branding?.["selectionTemplate"];
  if (!Array.isArray(template)) return [] as SelectionExportRule[];

  return template
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;
      const id = typeof rule["id"] === "string" ? rule["id"] : null;
      const title = typeof rule["part"] === "string" ? rule["part"] : null;
      if (!id || !title) return null;
      return { id, title } satisfies SelectionExportRule;
    })
    .filter(Boolean) as SelectionExportRule[];
};

const getSelectionPartKeys = (branding?: Record<string, unknown> | null) => {
  const template = branding?.["selectionTemplate"];
  if (!Array.isArray(template)) return [] as string[];

  const keys = template
    .map((rule) => {
      if (!rule || typeof rule !== "object") return null;
      const id = typeof rule["id"] === "string" ? rule["id"].trim() : "";
      const part = typeof rule["part"] === "string" ? rule["part"].trim() : "";
      const candidate = id || part;
      if (!candidate) return null;
      return normalizeSelectionPartKey(candidate);
    })
    .filter(Boolean) as string[];

  return Array.from(new Set(keys));
};

const deriveRequiredCount = (branding?: Record<string, unknown> | null) => {
  const template = branding?.["selectionTemplate"];
  if (!Array.isArray(template)) return 0;

  return template.reduce((total, rule) => {
    if (!rule || typeof rule !== "object") return total;
    const minimum = Number(rule["min"]);
    const required = rule["required"] === true || rule["required"] === "true";
    if (Number.isFinite(minimum) && minimum > 0) {
      return total + (required ? minimum : minimum);
    }
    const maximum = Number(rule["max"]);
    if (Number.isFinite(maximum) && maximum > 0) {
      return total + maximum;
    }
    return total;
  }, 0);
};

const getEventDate = (branding?: Record<string, unknown> | null, fallback?: string | null) => {
  const eventDate = branding?.["eventDate"];
  if (typeof eventDate === "string" && eventDate.trim()) return eventDate;
  return fallback ?? null;
};

const resolveSelectionState = (raw: GalleryQueryResult["gallery_selection_states"]) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

const resolveSession = (raw: GalleryQueryResult["sessions"]) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

const resolveProject = (raw: GalleryQueryResult["projects"]) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

const useGalleryList = () => {
  return useQuery({
    queryKey: ["galleries", "list"],
    queryFn: async (): Promise<GalleryListItem[]> => {
      const { data, error } = await supabase
        .from("galleries")
        .select(
          "id,title,status,type,branding,updated_at,created_at,published_at,expires_at,session_id,project_id,previous_status,gallery_selection_states(is_locked,locked_at,note,updated_at),sessions(id,session_name,session_date,project:projects(id,name),lead:leads(id,name,email,phone)),projects(id,name),gallery_assets(id)"
        )
        .order("updated_at", { ascending: true });

      if (error) throw error;

      const galleries = (data ?? []) as GalleryQueryResult[];
      const sessionIds = Array.from(
        new Set(
          galleries
            .map((gallery) => (typeof gallery.session_id === "string" ? gallery.session_id : null))
            .filter(Boolean) as string[]
        )
      );
      const projectIds = Array.from(
        new Set(
          galleries
            .map((gallery) => (typeof gallery.project_id === "string" ? gallery.project_id : null))
            .filter(Boolean) as string[]
        )
      );
      const galleryIds = galleries.map((gallery) => gallery.id);

      const [sessionResponse, projectResponse, selectionResponse, downloadResponse] = await Promise.all([
        sessionIds.length
          ? supabase
            .from("sessions")
            .select("id,session_name,session_date,project:projects(id,name),lead:leads(id,name,email,phone)")
            .in("id", sessionIds)
          : Promise.resolve({ data: [] as SessionRow[] }),
        projectIds.length
          ? supabase.from("projects").select("id,name").in("id", projectIds)
          : Promise.resolve({ data: [] as ProjectRow[] }),
        galleryIds.length
          ? supabase
            .from("client_selections")
            .select("gallery_id,asset_id,selection_part")
            .in("gallery_id", galleryIds)
          : Promise.resolve({ data: [] as SelectionRow[] }),
        galleryIds.length
          ? supabase
            .from("gallery_download_events")
            .select("gallery_id,downloaded_at")
            .in("gallery_id", galleryIds)
          : Promise.resolve({ data: [] as DownloadEventRow[] }),
      ]);

      const sessionMap = new Map((sessionResponse.data ?? []).map((entry) => [entry.id, entry]));
      const projectMap = new Map((projectResponse.data ?? []).map((entry) => [entry.id, entry]));

      const selectionRows = (selectionResponse.data ?? []).filter(
        (entry): entry is SelectionRow => Boolean(entry) && typeof entry.gallery_id === "string"
      );

      const downloadRows = (downloadResponse.data ?? []).filter(
        (entry): entry is DownloadEventRow =>
          Boolean(entry) && typeof entry.gallery_id === "string" && typeof entry.downloaded_at === "string"
      );

      const downloadsByGallery = new Map<string, string>();
      downloadRows.forEach((entry) => {
        const existing = downloadsByGallery.get(entry.gallery_id);
        if (!existing) {
          downloadsByGallery.set(entry.gallery_id, entry.downloaded_at);
          return;
        }
        const existingTime = new Date(existing).getTime();
        const nextTime = new Date(entry.downloaded_at).getTime();
        if (Number.isNaN(existingTime) || nextTime > existingTime) {
          downloadsByGallery.set(entry.gallery_id, entry.downloaded_at);
        }
      });

      const selectionsByGallery = new Map<string, SelectionRow[]>();
      const selectedAssetIds = new Set<string>();

      selectionRows.forEach((entry) => {
        const list = selectionsByGallery.get(entry.gallery_id) ?? [];
        list.push(entry);
        selectionsByGallery.set(entry.gallery_id, list);
        if (entry.asset_id) selectedAssetIds.add(entry.asset_id);
      });

      const coverAssetIds = new Set<string>();
      galleries.forEach((gallery) => {
        const coverAssetId = gallery.branding?.["coverAssetId"];
        if (typeof coverAssetId === "string" && coverAssetId) {
          coverAssetIds.add(coverAssetId);
        }
      });

      const assetIds = Array.from(new Set([...Array.from(selectedAssetIds), ...Array.from(coverAssetIds)]));
      const assetResponse =
        assetIds.length > 0
          ? await supabase
            .from("gallery_assets")
            .select("id,storage_path_web,metadata")
            .in("id", assetIds)
          : { data: [] as AssetRow[] };

      const assetMap = new Map((assetResponse.data ?? []).map((asset) => [asset.id, asset]));

      const signedCoverUrls = new Map<string, string>();
      if (coverAssetIds.size > 0) {
        const coverAssets = Array.from(coverAssetIds)
          .map((id) => assetMap.get(id))
          .filter((asset): asset is AssetRow => Boolean(asset && asset.storage_path_web));

        const urlResults = await Promise.all(
          coverAssets.map(async (asset) => {
            const { data: urlData, error: urlError } = await supabase.storage
              .from(GALLERY_ASSETS_BUCKET)
              .createSignedUrl(asset.storage_path_web as string, COVER_SIGNED_URL_TTL_SECONDS);

            if (urlError) return { id: asset.id, url: "" };
            return { id: asset.id, url: urlData?.signedUrl ?? "" };
          })
        );

        urlResults.forEach(({ id, url }) => {
          if (id) signedCoverUrls.set(id, url);
        });
      }

      const galleryRows: GalleryListItem[] = galleries.map((gallery) => {
        const session = resolveSession(gallery.sessions) ?? (gallery.session_id ? sessionMap.get(gallery.session_id) ?? null : null);
        const projectFromSession = session?.project ?? null;
        const project =
          resolveProject(gallery.projects) ?? projectFromSession ?? (gallery.project_id ? projectMap.get(gallery.project_id) ?? null : null);
        const selectionState = resolveSelectionState(gallery.gallery_selection_states);
        const selections = selectionsByGallery.get(gallery.id) ?? [];

        const exportPhotos = (() => {
          const byAsset = new Map<string, SelectionExportPhoto>();
          selections.forEach((entry) => {
            if (!entry.asset_id) return;
            const existing = byAsset.get(entry.asset_id) ?? {
              id: entry.asset_id,
              filename:
                (assetMap.get(entry.asset_id)?.metadata?.["original_filename"] as string | undefined) ||
                (assetMap.get(entry.asset_id)?.metadata?.["name"] as string | undefined) ||
                entry.asset_id,
              selections: [],
              isFavorite: false,
            };

            if (entry.selection_part) {
              existing.selections = Array.from(new Set([...existing.selections, String(entry.selection_part)]));
            }
            if (String(entry.selection_part).toLowerCase() === FAVORITES_FILTER_ID) {
              existing.isFavorite = true;
            }
            byAsset.set(entry.asset_id, existing);
          });
          return Array.from(byAsset.values());
        })();

        const requiredCount = deriveRequiredCount(gallery.branding);
        const selectionPartKeys = getSelectionPartKeys(gallery.branding);
        const partSelectionCount = countSelectionsByParts(selections, selectionPartKeys, {
          favoritesSelectionPartKey: FAVORITES_FILTER_ID,
        });
        const selectionCount =
          selectionPartKeys.length > 0 && (partSelectionCount.hasMatches || selections.length === 0)
            ? partSelectionCount.count
            : countUniqueSelectedAssets(selections, { favoritesSelectionPartKey: FAVORITES_FILTER_ID });
        const coverAssetId = gallery.branding?.["coverAssetId"];

        return {
          id: gallery.id,
          title: gallery.title,
          status: gallery.status,
          type: gallery.type,
          updatedAt: gallery.updated_at,
          eventDate: getEventDate(gallery.branding, session?.session_date ?? null),
          expiresAt: gallery.expires_at ?? null,
          session,
          project,
          selectionNote: selectionState?.note ?? null,
          isLocked: selectionState?.is_locked ?? false,
          lockedAt: selectionState?.locked_at ?? null,
          selectionCount,
          requiredCount,
          coverUrl: typeof coverAssetId === "string" ? signedCoverUrls.get(coverAssetId) ?? "" : "",
          exportPhotos,
          exportRules: normalizeSelectionRules(gallery.branding),
          downloadedAt: downloadsByGallery.get(gallery.id) ?? null,
          previousStatus: (gallery.previous_status as GalleryStatus) ?? null,
          totalAssetCount: gallery.gallery_assets?.length ?? 0,
        };
      });

      return galleryRows;
    },
    staleTime: 60_000,
  });
};

export const filterGalleriesByView = (
  galleries: GalleryListItem[],
  { typeFilter, statusFilter, searchTerm }: GalleryFilterOptions
) => {
  const matchesType = (gallery: GalleryListItem) => {
    if (typeFilter === "selection") return isSelectionGalleryType(gallery.type);
    if (typeFilter === "final") return isFinalGalleryType(gallery.type);
    return true;
  };

  const matchesStatus = (gallery: GalleryListItem) => {
    switch (statusFilter) {
      case "archived":
        return gallery.status === "archived";
      case "approved":
        return (
          typeFilter === "selection" &&
          gallery.status !== "archived" &&
          (gallery.isLocked || gallery.status === "approved")
        );
      case "pending":
        return (
          typeFilter === "selection" &&
          gallery.status !== "archived" &&
          gallery.status === "published" &&
          !gallery.isLocked
        );
      case "active":
      default:
        return gallery.status !== "archived";
    }
  };

  const matchesSearch = (gallery: GalleryListItem) => {
    if (!searchTerm.trim()) return true;
    const needle = searchTerm.toLowerCase();
    return (
      gallery.title.toLowerCase().includes(needle) ||
      (gallery.session?.session_name?.toLowerCase().includes(needle) ?? false) ||
      (gallery.project?.name?.toLowerCase().includes(needle) ?? false) ||
      (gallery.session?.lead?.name?.toLowerCase().includes(needle) ?? false)
    );
  };

  return galleries.filter((gallery) => matchesType(gallery) && matchesStatus(gallery) && matchesSearch(gallery));
};

const formatRelativeTime = (value: string | null, locale: Locale) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale });
};

const formatTimeRemaining = (value: string | null, locale: Locale) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { locale });
};

export default function AllGalleries() {
  const { t, i18n } = useTranslation("pages");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const i18nToast = useI18nToast();
  const { activeOrganization, loading: organizationLoading } = useOrganization();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "en").startsWith("tr") ? tr : enUS;
  const numberFormatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);

  const [typeFilter, setTypeFilter] = useState<GalleryTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "updatedAt",
    direction: "asc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [exportGalleryId, setExportGalleryId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<GalleryListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GalleryListItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data: galleries = [], isLoading } = useGalleryList();

  const storageAnchorGalleryId = useMemo(() => galleries[0]?.id ?? null, [galleries]);

  const { data: orgGalleryBytes, isLoading: orgGalleryBytesLoading } = useQuery({
    queryKey: ["galleries", "org_gallery_bytes", storageAnchorGalleryId],
    enabled: Boolean(storageAnchorGalleryId),
    staleTime: 60_000,
    queryFn: async (): Promise<number | null> => {
      if (!storageAnchorGalleryId) return 0;
      try {
        const { data, error } = await supabase.rpc("get_gallery_storage_usage", { gallery_uuid: storageAnchorGalleryId });
        if (error) {
          console.warn("AllGalleries: Failed to fetch organization storage usage", { galleryId: storageAnchorGalleryId, error });
          return null;
        }
        const row = Array.isArray(data) ? data[0] : null;
        const bytes = row?.org_bytes;
        return typeof bytes === "number" && Number.isFinite(bytes) ? bytes : null;
      } catch (error) {
        console.warn("AllGalleries: Failed to fetch organization storage usage", { galleryId: storageAnchorGalleryId, error });
        return null;
      }
    },
  });

  const orgUsedBytes = !isLoading && galleries.length === 0 ? 0 : orgGalleryBytes;
  const orgLimitBytes = activeOrganization?.gallery_storage_limit_bytes ?? ORG_GALLERY_STORAGE_LIMIT_BYTES;

  const galleryIdsForSize = useMemo(
    () => Array.from(new Set(galleries.map((gallery) => gallery.id))).sort(),
    [galleries]
  );

  const { data: gallerySizeBytesById, isLoading: isGallerySizeLoading } = useQuery({
    queryKey: ["galleries", "size_bytes", galleryIdsForSize],
    enabled: galleryIdsForSize.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number | null>> => {
      const results: Record<string, number | null> = {};

      const fetchGalleryBytes = async (galleryId: string) => {
        try {
          const { data, error } = await supabase.rpc("get_gallery_storage_usage", { gallery_uuid: galleryId });
          if (error) {
            console.warn("AllGalleries: Failed to fetch gallery storage usage", { galleryId, error });
            return null;
          }
          const row = Array.isArray(data) ? data[0] : null;
          const bytes = row?.gallery_bytes;
          return typeof bytes === "number" && Number.isFinite(bytes) ? bytes : null;
        } catch (error) {
          console.warn("AllGalleries: Failed to fetch gallery storage usage", { galleryId, error });
          return null;
        }
      };

      const chunkSize = 12;
      for (let index = 0; index < galleryIdsForSize.length; index += chunkSize) {
        const chunk = galleryIdsForSize.slice(index, index + chunkSize);
        const chunkResults = await Promise.all(chunk.map(async (galleryId) => [galleryId, await fetchGalleryBytes(galleryId)] as const));
        chunkResults.forEach(([galleryId, bytes]) => {
          results[galleryId] = bytes;
        });
      }

      return results;
    },
  });

  const galleriesWithSize = useMemo(
    () =>
      galleries.map((gallery) => {
        const sizeBytes = gallerySizeBytesById?.[gallery.id];
        if (sizeBytes === undefined) return gallery;
        return { ...gallery, sizeBytes };
      }),
    [galleries, gallerySizeBytesById]
  );

  const stats = useMemo(() => {
    const base = {
      waitingForClient: 0,
      actionNeeded: 0,
      selectionGalleries: 0,
      finalGalleries: 0,
      archived: 0,
    };

    galleries.forEach((gallery) => {
      if (gallery.status === "archived") {
        base.archived += 1;
        return;
      }

      const isSelection = isSelectionGalleryType(gallery.type);
      const isFinal = isFinalGalleryType(gallery.type);

      if (isSelection) {
        base.selectionGalleries += 1;
        // Status KPIs only for selection workflow
        if (gallery.isLocked || gallery.status === "approved") {
          base.actionNeeded += 1;
        } else if (gallery.status === "published") {
          base.waitingForClient += 1;
        }
      } else if (isFinal) {
        base.finalGalleries += 1;
      }
    });
    return base;
  }, [galleries]);

  const typeOptions = useMemo(
    () => [
      { label: t("galleries.filters.type.all"), value: "all" },
      { label: t("galleries.filters.type.selection"), value: "selection" },
      { label: t("galleries.filters.type.final"), value: "final" },
    ],
    [t]
  );

  const statusOptions = useMemo(() => {
    if (typeFilter === "selection") {
      return [
        { label: t("galleries.segments.active"), value: "active" },
        { label: t("galleries.segments.pending"), value: "pending" },
        { label: t("galleries.segments.approved"), value: "approved" },
        { label: t("galleries.segments.archived"), value: "archived" },
      ];
    }
    return [
      { label: t("galleries.segments.active"), value: "active" },
      { label: t("galleries.segments.archived"), value: "archived" },
    ];
  }, [t, typeFilter]);

  const handleTypeChange = (value: string) => {
    const nextType = value as GalleryTypeFilter;
    setTypeFilter(nextType);
    setStatusFilter("active");
  };

  const filtered = useMemo(() => {
    const filteredRows = filterGalleriesByView(galleriesWithSize, {
      typeFilter,
      statusFilter,
      searchTerm,
    });

    const sorted = [...filteredRows].sort((a, b) => {
      const approvedRank = (row: GalleryListItem) => (row.isLocked || row.status === "approved" ? 0 : 1);
      if (statusFilter === "active") {
        const rankDifference = approvedRank(a) - approvedRank(b);
        if (rankDifference !== 0) return rankDifference;
      }

      const direction = sortState.direction === "asc" ? 1 : -1;
      switch (sortState.columnId) {
        case "title":
          return a.title.localeCompare(b.title) * direction;
        case "client": {
          const aName = a.session?.lead?.name ?? "";
          const bName = b.session?.lead?.name ?? "";
          return aName.localeCompare(bName) * direction;
        }
        case "sizeBytes": {
          const aSize = typeof a.sizeBytes === "number" && Number.isFinite(a.sizeBytes) ? a.sizeBytes : null;
          const bSize = typeof b.sizeBytes === "number" && Number.isFinite(b.sizeBytes) ? b.sizeBytes : null;
          if (aSize === null && bSize === null) return 0;
          if (aSize === null) return 1;
          if (bSize === null) return -1;
          return (aSize - bSize) * direction;
        }
        case "updatedAt":
        default: {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          return (aTime - bTime) * direction;
        }
      }
    });

    return sorted;
  }, [galleriesWithSize, sortState, searchTerm, statusFilter, typeFilter]);

  const archiveGalleryMutation = useMutation({
    mutationFn: async (target: GalleryListItem) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("galleries")
        .update({ status: "archived", previous_status: target.status, updated_at: now })
        .eq("id", target.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setArchiveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.success(t("galleries.toast.archiveSuccess"));
    },
    onError: () => {
      i18nToast.error(t("galleries.toast.archiveError"));
    },
  });

  const unarchiveGalleryMutation = useMutation({
    mutationFn: async (target: GalleryListItem) => {
      const now = new Date().toISOString();
      const newStatus = target.previousStatus || "published";
      const { error } = await supabase
        .from("galleries")
        .update({ status: newStatus, previous_status: null, updated_at: now })
        .eq("id", target.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.success(t("galleries.toast.unarchiveSuccess"));
    },
    onError: () => {
      i18nToast.error(t("galleries.toast.unarchiveError"));
    },
  });

  const deleteGalleryMutation = useMutation({
    mutationFn: async (target: GalleryListItem) => {
      await deleteGalleryWithAssets({
        galleryId: target.id,
        sessionId: target.session?.id ?? null,
        organizationId: activeOrganization?.id ?? null,
      });
    },
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      i18nToast.success(t("galleries.toast.deleteSuccess"));
    },
    onError: () => {
      i18nToast.error(t("galleries.toast.deleteError"));
    },
  });

  const columns = useMemo<AdvancedTableColumn<GalleryListItem>[]>(() => {
    const renderSelectionProgress = (row: GalleryListItem) => {
      const required = row.requiredCount > 0 ? row.requiredCount : Math.max(row.selectionCount, 1);
      const percent = Math.min(100, Math.round((row.selectionCount / required) * 100));
      return (
        <div className="min-w-[180px]">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
            <span className="text-foreground font-semibold">
              {t("galleries.table.selected", { count: row.selectionCount })}
            </span>
            <div className="flex items-center gap-2">
              <span>{t("galleries.table.required", { count: required })}</span>
              <span className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1">
                <Images className="h-3 w-3" />
                <span className="text-foreground">{row.totalAssetCount}</span>
              </div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full", percent >= 100 ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      );
    };

    const renderSizeValue = (row: GalleryListItem) =>
      isGallerySizeLoading && row.sizeBytes === undefined ? (
        <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" aria-hidden />
      ) : (
        <span className="tabular-nums">{formatBytes(row.sizeBytes, i18n.language)}</span>
      );

    const renderSizeAndTime = (row: GalleryListItem) => {
      const timeRemaining = formatTimeRemaining(row.expiresAt, locale);
      return (
        <div className="flex flex-col gap-0.5 text-sm">
          <div className="text-foreground">{renderSizeValue(row)}</div>
          {timeRemaining ? (
            <span className="text-xs text-muted-foreground">
              {t("galleries.table.timeRemaining", { value: timeRemaining })}
            </span>
          ) : null}
        </div>
      );
    };

    const renderLastAction = (value: string) => {
      const relative = formatRelativeTime(value, locale);
      return (
        <div className="flex flex-col text-sm">
          <div className="flex items-center gap-1 text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {formatDate(value)}
          </div>
          {relative && <span className="text-[11px] text-muted-foreground pl-5">{relative}</span>}
        </div>
      );
    };

    const galleryColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "gallery",
      label: t("galleries.table.gallery"),
      sortable: true,
      sortId: "title",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl border border-border overflow-hidden bg-muted/40 shadow-sm">
            {row.coverUrl ? (
              <img src={row.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <Images className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.title}</span>
            <span className="text-xs text-muted-foreground">
              {row.eventDate ? formatDate(row.eventDate) : t("galleries.table.noEvent")}
            </span>
          </div>
        </div>
      ),
    };

    const clientColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "client",
      label: t("galleries.table.client"),
      sortable: true,
      sortId: "client",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className={cn(
              "text-left text-sm font-semibold text-primary hover:underline",
              !row.session?.lead?.id && "cursor-not-allowed text-muted-foreground hover:no-underline"
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (!row.session?.lead?.id) return;
              navigate(`/leads/${row.session.lead.id}`);
            }}
            disabled={!row.session?.lead?.id}
          >
            {row.session?.lead?.name ?? t("galleries.table.noClient")}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {row.session?.lead?.email || row.session?.lead?.phone || ""}
          </span>
        </div>
      ),
    };

    const linksColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "links",
      label: t("galleries.table.links"),
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="surface" size="sm" className="btn-surface-accent h-9">
              {t("galleries.table.quickAccess")}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("galleries.table.linkTypes.session")}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate(`/sessions/${row.session?.id ?? ""}`)} disabled={!row.session}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {row.session?.session_name || t("galleries.table.noSession")}
            </DropdownMenuItem>
            <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("galleries.table.linkTypes.project")}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate(`/projects/${row.project?.id ?? ""}`)} disabled={!row.project}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {row.project?.name || t("galleries.table.noProject")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(`/galleries/${row.id}`)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("galleries.table.openGallery")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    };

    const statusColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "status",
      label: t("galleries.table.status"),
      render: (row) => {
        const showDownloadStatus =
          isFinalGalleryType(row.type) && row.status !== "archived" && Boolean(row.downloadedAt);

        return (
          <div className="flex flex-col gap-1">
            {showDownloadStatus ? (
              <Badge
                variant="outline"
                className="w-fit border-emerald-200/70 bg-emerald-50/80 text-xs font-semibold text-emerald-700"
              >
                {t("galleries.table.downloadedStatus")}
              </Badge>
            ) : (
              <GalleryStatusChip
                status={isSelectionGalleryType(row.type) && row.isLocked ? "approved" : row.status}
                size="sm"
              />
            )}
          </div>
        );
      },
    };

    const notesColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "notes",
      label: t("galleries.table.customerNotes"),
      render: (row) => {
        if (!row.selectionNote) return null;

        return (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[200px] text-xs text-muted-foreground line-clamp-3 cursor-help leading-normal">
                  {row.selectionNote}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="max-w-[300px] p-3 text-xs leading-relaxed"
              >
                {row.selectionNote}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    };

    const progressColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "progress",
      label: t("galleries.table.progress"),
      render: (row) => renderSelectionProgress(row),
    };

    const approvalColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "approval",
      label: t("galleries.table.approval"),
      sortable: true,
      sortId: "updatedAt",
      render: (row) => {
        const relative = formatRelativeTime(row.lockedAt, locale);
        return (
          <div className="flex flex-col text-sm">
            <div className="flex items-center gap-1 text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {row.lockedAt ? formatDate(row.lockedAt) : t("galleries.table.noApproval")}
            </div>
            {relative && <span className="text-[11px] text-muted-foreground pl-5">{relative}</span>}
          </div>
        );
      },
    };

    const sizeAndTimeColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "sizeAndTime",
      label: t("galleries.table.sizeAndTime"),
      sortable: true,
      sortId: "sizeBytes",
      render: (row) => renderSizeAndTime(row),
    };

    const summaryColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "summary",
      label: t("galleries.table.summaryColumn"),
      render: (row) => {
        if (isSelectionGalleryType(row.type)) {
          return renderSelectionProgress(row);
        }
        if (isFinalGalleryType(row.type)) {
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Images className="h-3.5 w-3.5" />
              {t("galleries.table.photoCount", { count: row.totalAssetCount })}
            </div>
          );
        }
        return null;
      },
    };

    const lastActionColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "lastAction",
      label: t("galleries.table.lastAction"),
      sortable: true,
      sortId: "updatedAt",
      render: (row) => {
        const actionDate =
          isFinalGalleryType(row.type) && row.downloadedAt ? row.downloadedAt : row.updatedAt;
        return renderLastAction(actionDate);
      },
    };

    const photoCountColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "photoCount",
      label: t("galleries.table.photoCountHeader"),
      sortable: true,
      sortId: "totalAssetCount",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <Images className="h-4 w-4 text-muted-foreground" />
          {row.totalAssetCount}
        </div>
      ),
    };

    const actionsColumn: AdvancedTableColumn<GalleryListItem> = {
      id: "actions",
      label: t("galleries.table.actions"),
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setExportGalleryId(row.id)}>
            <Download className="h-4 w-4" />
            <span className="sr-only">{t("galleries.table.export")}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t("sessionDetail.gallery.actions.more")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("galleries.table.actions")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {row.status !== "archived" ? (
                <DropdownMenuItem
                  onSelect={() => {
                    setArchiveTarget(row);
                  }}
                  className="cursor-pointer gap-2"
                >
                  <Archive className="h-4 w-4" />
                  {t("sessionDetail.gallery.actions.archive")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => {
                    unarchiveGalleryMutation.mutate(row);
                  }}
                  className="cursor-pointer gap-2"
                >
                  <Archive className="h-4 w-4" />
                  {t("sessionDetail.gallery.actions.restore")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  setDeleteTarget(row);
                  setDeleteConfirmText("");
                }}
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t("sessionDetail.gallery.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    };

    const baseColumns = [galleryColumn, clientColumn, linksColumn, statusColumn, notesColumn];

    if (typeFilter === "selection") {
      return [...baseColumns, progressColumn, approvalColumn, sizeAndTimeColumn, actionsColumn];
    }

    if (typeFilter === "final") {
      // Notes column not shown for final delivery
      const finalColumns = [galleryColumn, clientColumn, linksColumn, statusColumn];
      return [...finalColumns, lastActionColumn, photoCountColumn, sizeAndTimeColumn, actionsColumn];
    }

    return [...baseColumns, summaryColumn, lastActionColumn, sizeAndTimeColumn, actionsColumn];
  }, [i18n.language, isGallerySizeLoading, locale, navigate, t, typeFilter]);

  const galleryCountLabel = useMemo(
    () => numberFormatter.format(filtered.length),
    [filtered.length, numberFormatter]
  );

  const tableTitle = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-foreground">{t("galleries.tableTitle")}</span>
        <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
          {galleryCountLabel}
        </Badge>
      </div>
    ),
    [galleryCountLabel, t]
  );

  const expectedGalleryNameForDelete = useMemo(
    () => deleteTarget?.title?.trim() ?? "",
    [deleteTarget?.title]
  );

  const canConfirmGalleryDelete =
    expectedGalleryNameForDelete.length > 0 &&
    deleteConfirmText.trim() === expectedGalleryNameForDelete;

  const statusControls = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("galleries.filters.statusLabel")}
        </span>
        <SegmentedControl
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          options={statusOptions}
          size="sm"
          className="w-fit"
        />
      </div>
    ),
    [statusFilter, statusOptions, t]
  );

  const emptyState = useMemo(() => {
    const isSearching = searchTerm.trim().length > 0;

    if (isSearching) {
      return (
        <EmptyState
          icon={Images}
          iconVariant="pill"
          iconColor="indigo"
          title={t("galleries.emptyState.search.title")}
          description={t("galleries.emptyState.search.description")}
        />
      );
    }

    if (galleries.length === 0) {
      return (
        <EmptyState
          icon={Images}
          iconVariant="pill"
          iconColor="indigo"
          title={t("galleries.emptyState.none.title")}
          description={t("galleries.emptyState.none.description")}
        />
      );
    }

    return (
      <EmptyState
        icon={Images}
        iconVariant="pill"
        iconColor="indigo"
        title={t(`galleries.emptyState.segments.${statusFilter}.title`)}
        description={t(`galleries.emptyState.segments.${statusFilter}.description`)}
      />
    );
  }, [galleries.length, searchTerm, statusFilter, t]);

  const exportTarget = useMemo(() => filtered.find((gallery) => gallery.id === exportGalleryId) ?? null, [exportGalleryId, filtered]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t("galleries.title")}>
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StorageWidget
            usedBytes={orgUsedBytes}
            totalBytes={orgLimitBytes}
            isLoading={isLoading || orgGalleryBytesLoading || organizationLoading}
          />
          {([
            {
              id: "waiting",
              label: t("galleries.stats.waitingForClient"),
              value: stats.waitingForClient,
              icon: Clock,
              preset: getKpiIconPreset("sky"),
              onClick: () => {
                setTypeFilter("selection");
                setStatusFilter("pending");
              },
            },
            {
              id: "action",
              label: t("galleries.stats.actionNeeded"),
              value: stats.actionNeeded,
              icon: AlertTriangle,
              preset: getKpiIconPreset("amber"),
              onClick: () => {
                setTypeFilter("selection");
                setStatusFilter("approved");
              },
            },
            {
              id: "selection",
              label: t("galleries.stats.selectionType"),
              value: stats.selectionGalleries,
              icon: Images,
              preset: getKpiIconPreset("indigo"),
              onClick: () => {
                setTypeFilter("selection");
                setStatusFilter("active");
              },
            },
            {
              id: "final",
              label: t("galleries.stats.finalType"),
              value: stats.finalGalleries,
              icon: CheckCircle2,
              preset: getKpiIconPreset("emerald"),
              onClick: () => {
                setTypeFilter("final");
                setStatusFilter("active");
              },
            },
            {
              id: "archived",
              label: t("galleries.stats.archived"),
              value: stats.archived,
              icon: Archive,
              preset: getKpiIconPreset("slate"),
              onClick: () => {
                setTypeFilter("all");
                setStatusFilter("archived");
              },
            },
          ] as const).map((card) => (
            <KpiCard
              key={card.id}
              className="h-full"
              density="compact"
              icon={card.icon}
              title={card.label}
              value={numberFormatter.format(card.value)}
              onClick={card.onClick}
              showClickArrow
              {...card.preset}
            />
          ))}
        </section>

        <div className="flex flex-col gap-3">
          <SegmentedControl
            value={typeFilter}
            onValueChange={handleTypeChange}
            options={typeOptions}
            className="w-fit"
          />
        </div>

        <AdvancedDataTable
          data={filtered}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          title={tableTitle}
          actions={statusControls}
          searchPosition="end"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("galleries.search")}
          sortState={sortState}
          onSortChange={setSortState}
          onRowClick={(row) => navigate(`/galleries/${row.id}`)}
          className="rounded-2xl border border-border/60 bg-white shadow-sm"
          emptyState={emptyState}
        />

        <SelectionExportSheet
          open={Boolean(exportTarget)}
          onOpenChange={(open) => setExportGalleryId(open ? exportGalleryId : null)}
          photos={exportTarget?.exportPhotos ?? []}
          rules={exportTarget?.exportRules ?? []}
        />

        <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("galleries.confirmations.archive.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("galleries.confirmations.archive.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={archiveGalleryMutation.isPending}>
                {t("buttons.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => archiveTarget && archiveGalleryMutation.mutate(archiveTarget)}
                disabled={!archiveTarget || archiveGalleryMutation.isPending}
              >
                {archiveGalleryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("galleries.confirmations.archive.confirming")}
                  </>
                ) : (
                  t("galleries.confirmations.archive.confirm")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
              setDeleteConfirmText("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("sessionDetail.gallery.delete.title", { defaultValue: "Delete gallery" })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("sessionDetail.gallery.delete.description", {
                  defaultValue:
                    "This action cannot be undone. The gallery and all media will be permanently deleted.",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="gallery-delete-confirm">
                {t("sessionDetail.gallery.delete.confirmLabel", { defaultValue: "Type the gallery name to delete" })}
              </Label>
              <Input
                id="gallery-delete-confirm"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder={expectedGalleryNameForDelete}
                autoFocus
                disabled={deleteGalleryMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {t("sessionDetail.gallery.delete.confirmHint", {
                  defaultValue: `Gallery name: ${expectedGalleryNameForDelete}`,
                  name: expectedGalleryNameForDelete,
                })}
              </p>
            </div>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={deleteGalleryMutation.isPending}>
                {t("buttons.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && deleteGalleryMutation.mutate(deleteTarget)}
                disabled={!canConfirmGalleryDelete || deleteGalleryMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteGalleryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("sessionDetail.gallery.delete.deleting", { defaultValue: "Deleting..." })}
                  </>
                ) : (
                  t("sessionDetail.gallery.delete.confirmButton", { defaultValue: "Delete gallery" })
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
