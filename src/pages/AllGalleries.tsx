import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, tr } from "date-fns/locale";
import {
  AdvancedDataTable,
  type AdvancedDataTableSortState,
  type AdvancedTableColumn,
} from "@/components/data-table";
import GlobalSearch from "@/components/GlobalSearch";
import { PageHeader, PageHeaderSearch } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import { GalleryStatusChip, type GalleryStatus } from "@/components/galleries/GalleryStatusChip";
import { cn, formatDate } from "@/lib/utils";
import { countUniqueSelectedAssets } from "@/lib/gallerySelections";
import { SelectionExportSheet, type SelectionExportPhoto, type SelectionExportRule } from "@/components/galleries/SelectionExportSheet";
import { FAVORITES_FILTER_ID } from "@/components/galleries/SelectionDashboard";
import { GALLERY_ASSETS_BUCKET } from "@/lib/galleryAssets";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Images,
  Layers,
  MessageSquare,
  MoreHorizontal,
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
  session_id: string | null;
  project_id: string | null;
  selection_state?:
    | {
        is_locked: boolean;
        locked_at: string | null;
        note: string | null;
        updated_at: string;
      }
    | null
    | undefined;
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

interface GalleryListItem {
  id: string;
  title: string;
  status: GalleryStatus;
  type: string;
  updatedAt: string;
  eventDate: string | null;
  session: SessionRow | null;
  project: ProjectRow | null;
  selectionNote: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  selectionCount: number;
  requiredCount: number;
  coverUrl: string;
  exportPhotos: SelectionExportPhoto[];
  exportRules: SelectionExportRule[];
}

type SegmentFilter = "active" | "action" | "approved" | "archived";

type GalleryQueryResult = GalleryRow & {
  sessions?: SessionRow | SessionRow[] | null;
  projects?: ProjectRow | ProjectRow[] | null;
  gallery_selection_states?: GalleryRow["selection_state"] | GalleryRow["selection_state"][];
};

const COVER_SIGNED_URL_TTL_SECONDS = 60 * 60;

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
          "id,title,status,type,branding,updated_at,created_at,published_at,session_id,project_id,gallery_selection_states(is_locked,locked_at,note,updated_at),sessions(id,session_name,session_date,project:projects(id,name),lead:leads(id,name,email,phone)),projects(id,name)"
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

      const [sessionResponse, projectResponse, selectionResponse] = await Promise.all([
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
      ]);

      const sessionMap = new Map((sessionResponse.data ?? []).map((entry) => [entry.id, entry]));
      const projectMap = new Map((projectResponse.data ?? []).map((entry) => [entry.id, entry]));

      const selectionRows = (selectionResponse.data ?? []).filter(
        (entry): entry is SelectionRow => Boolean(entry) && typeof entry.gallery_id === "string"
      );

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
        const selectionCount = countUniqueSelectedAssets(selections, { favoritesSelectionPartKey: FAVORITES_FILTER_ID });
        const coverAssetId = gallery.branding?.["coverAssetId"];

        return {
          id: gallery.id,
          title: gallery.title,
          status: gallery.status,
          type: gallery.type,
          updatedAt: gallery.updated_at,
          eventDate: getEventDate(gallery.branding, session?.session_date ?? null),
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
        };
      });

      return galleryRows;
    },
    staleTime: 60_000,
  });
};

const formatRelativeTime = (value: string | null, locale: Locale) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale });
};

export default function AllGalleries() {
  const { t, i18n } = useTranslation("pages");
  const navigate = useNavigate();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "en").startsWith("tr") ? tr : enUS;
  const numberFormatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);

  const [segment, setSegment] = useState<SegmentFilter>("active");
  const [sortState, setSortState] = useState<AdvancedDataTableSortState>({
    columnId: "updatedAt",
    direction: "asc",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [exportGalleryId, setExportGalleryId] = useState<string | null>(null);

  const { data: galleries = [], isLoading } = useGalleryList();

  const stats = useMemo(() => {
    const base = { active: 0, actionNeeded: 0, approved: 0, archived: 0 };
    galleries.forEach((gallery) => {
      if (gallery.status === "archived") {
        base.archived += 1;
        return;
      }
      if (gallery.isLocked || gallery.status === "approved") {
        base.approved += 1;
        base.active += 1;
        return;
      }
      if (gallery.status === "published") {
        base.actionNeeded += 1;
        base.active += 1;
        return;
      }
      base.active += 1;
    });
    return base;
  }, [galleries]);

  const filtered = useMemo(() => {
    const matchesSegment = (gallery: GalleryListItem) => {
      switch (segment) {
        case "archived":
          return gallery.status === "archived";
        case "approved":
          return gallery.isLocked || gallery.status === "approved";
        case "action":
          return gallery.status === "published" && !gallery.isLocked;
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

    const filteredRows = galleries.filter((gallery) => matchesSegment(gallery) && matchesSearch(gallery));

    const sorted = [...filteredRows].sort((a, b) => {
      const approvedRank = (row: GalleryListItem) => (row.isLocked || row.status === "approved" ? 0 : 1);
      if (segment === "active") {
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
        case "updatedAt":
        default: {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          return (aTime - bTime) * direction;
        }
      }
    });

    return sorted;
  }, [galleries, segment, sortState, searchTerm]);

  const columns = useMemo<AdvancedTableColumn<GalleryListItem>[]>(
    () => [
      {
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
      },
      {
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
      },
      {
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
      },
      {
        id: "status",
        label: t("galleries.table.status"),
        render: (row) => (
          <div className="flex flex-col gap-1">
            <GalleryStatusChip status={row.status} size="sm" />
            {row.selectionNote && (
              <Badge variant="outline" className="flex items-center gap-1 w-fit text-xs">
                <MessageSquare className="h-3 w-3" />
                {row.selectionNote}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "progress",
        label: t("galleries.table.progress"),
        render: (row) => {
          const required = row.requiredCount > 0 ? row.requiredCount : Math.max(row.selectionCount, 1);
          const percent = Math.min(100, Math.round((row.selectionCount / required) * 100));
          return (
            <div className="min-w-[180px]">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                <span className="text-foreground font-semibold">{t("galleries.table.selected", { count: row.selectionCount })}</span>
                <span>
                  {t("galleries.table.required", { count: required })}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", percent >= 100 ? "bg-emerald-500" : "bg-amber-500")}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
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
      },
      {
        id: "actions",
        label: t("galleries.table.actions"),
        align: "right",
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setExportGalleryId(row.id)}>
              <Download className="h-4 w-4" />
              <span className="sr-only">{t("galleries.table.export")}</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(`/galleries/${row.id}`)}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{t("galleries.table.view")}</span>
            </Button>
          </div>
        ),
      },
    ],
    [locale, navigate, t]
  );

  const summaryText = useMemo(() => {
    return t("galleries.table.summary", { count: filtered.length });
  }, [filtered.length, t]);

  const exportTarget = useMemo(() => filtered.find((gallery) => gallery.id === exportGalleryId) ?? null, [exportGalleryId, filtered]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t("galleries.title")}>
        <PageHeaderSearch>
          <GlobalSearch variant="header" />
        </PageHeaderSearch>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([
            { id: "action", label: t("galleries.stats.actionNeeded"), value: stats.actionNeeded, icon: AlertTriangle, preset: getKpiIconPreset("amber") },
            { id: "approved", label: t("galleries.stats.approved"), value: stats.approved, icon: CheckCircle2, preset: getKpiIconPreset("emerald") },
            { id: "active", label: t("galleries.stats.active"), value: stats.active, icon: Layers, preset: getKpiIconPreset("indigo") },
            { id: "archived", label: t("galleries.stats.archived"), value: stats.archived, icon: Archive, preset: getKpiIconPreset("slate") },
          ] as const).map((card) => (
            <KpiCard
              key={card.id}
              className="h-full"
              density="compact"
              icon={card.icon}
              title={card.label}
              value={numberFormatter.format(card.value)}
              {...card.preset}
            />
          ))}
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedControl
            value={segment}
            onValueChange={(value) => setSegment(value as SegmentFilter)}
            options={[
              { label: t("galleries.segments.active"), value: "active" },
              { label: t("galleries.segments.action"), value: "action" },
              { label: t("galleries.segments.approved"), value: "approved" },
              { label: t("galleries.segments.archived"), value: "archived" },
            ]}
          />
        </div>

        <AdvancedDataTable
          data={filtered}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          summary={{ text: summaryText }}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("galleries.search")}
          sortState={sortState}
          onSortChange={setSortState}
          onRowClick={(row) => navigate(`/galleries/${row.id}`)}
          className="rounded-2xl border border-border/60 bg-white shadow-sm"
          emptyState={
            <div className="py-12 text-center text-muted-foreground">{t("galleries.empty")}</div>
          }
        />

        <SelectionExportSheet
          open={Boolean(exportTarget)}
          onOpenChange={(open) => setExportGalleryId(open ? exportGalleryId : null)}
          photos={exportTarget?.exportPhotos ?? []}
          rules={exportTarget?.exportRules ?? []}
        />
      </div>
    </div>
  );
}
