import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import {
  SelectionTemplateSection,
  type SelectionTemplateRuleForm,
  createEmptyRule,
  deserializeSelectionTemplate,
  normalizeSelectionTemplate,
} from "@/components/SelectionTemplateSection";
import {
  Plus,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { cn } from "@/lib/utils";
import { GALLERY_ASSETS_BUCKET } from "@/lib/galleryAssets";

interface SessionGalleryProps {
  sessionId: string;
  className?: string;
  defaultEventDate?: string;
  sessionLeadName?: string;
}

type GalleryType = "proof" | "retouch" | "final" | "other";
type GalleryStatus = "draft" | "published" | "approved" | "archived";
type FormGalleryType = GalleryType | "";

interface GalleryRow {
  id: string;
  title: string;
  type: GalleryType;
  status: GalleryStatus;
  branding: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface ProjectServiceWithTemplate {
  id: string;
  billing_type: "included" | "extra";
  services: {
    id: string;
    name: string;
    service_type: "coverage" | "deliverable" | null;
    selection_template: unknown;
  } | null;
}

type SelectionTemplateGroupForm = {
  key: string;
  kind?: "service" | "manual";
  serviceId?: string | null;
  serviceName?: string | null;
  billingType?: "included" | "extra" | null;
  disabled?: boolean;
  rules: SelectionTemplateRuleForm[];
};

const normalizeDate = (value?: string) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const dateOnly = value.split("T")[0] ?? value;
  return dateOnly;
};

const formatCardDate = (value?: string | null) => {
  if (!value) return "";
  const dateOnly = value.split("T")[0] ?? value;
  const [year, month, day] = dateOnly.split("-");
  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("tr-TR").replaceAll(".", "/");
};

const formatCount = (value: number) => new Intl.NumberFormat("tr-TR").format(value);

const GALLERY_COVER_SIGNED_URL_TTL_SECONDS = 60 * 60;

export default function SessionGallery({
  sessionId,
  className,
  defaultEventDate,
  sessionLeadName,
}: SessionGalleryProps) {
  const { t, i18n } = useTranslation("pages");
  const { t: tForms } = useFormsTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<FormGalleryType>("");
  const [formEventDate, setFormEventDate] = useState(() => normalizeDate(defaultEventDate));
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [selectionGroups, setSelectionGroups] = useState<SelectionTemplateGroupForm[]>([]);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectHasServices, setProjectHasServices] = useState<boolean | null>(null);
  const selectionInitializedRef = useRef(false);
  const hasTypeSelected = formType !== "";
  const isTurkish = (i18n.resolvedLanguage ?? i18n.language ?? "").startsWith("tr");
  const upperLabel = (value: string) =>
    isTurkish ? value.toLocaleUpperCase("tr-TR") : value.toUpperCase();

  const typeOptions = useMemo(
    () =>
      [
        {
          value: "proof" as GalleryType,
          label: t("sessionDetail.gallery.types.proof"),
          description: t("sessionDetail.gallery.types.proofHint", {
            defaultValue: "Müşterinin seçim yapacağı prova galerisi",
          }),
          icon: CheckCircle2,
        },
        {
          value: "final" as GalleryType,
          label: t("sessionDetail.gallery.types.final"),
          description: t("sessionDetail.gallery.types.finalHint", {
            defaultValue: "Teslim için onaylanmış final seti",
          }),
          icon: Sparkles,
        },
      ] satisfies {
        value: GalleryType;
        label: string;
        description: string;
        icon: LucideIcon;
      }[],
    [t]
  );
  const typeCardBase =
    "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const seedRulesIfEmpty = useCallback(
    (rules: SelectionTemplateRuleForm[]) => (rules.length > 0 ? rules : [createEmptyRule()]),
    []
  );

  const createManualRule = useCallback((): SelectionTemplateRuleForm => {
    return {
      ...createEmptyRule(),
      part: t("sessionDetail.gallery.selectionTemplate.manualPartDefault", {
        defaultValue: "Genel",
      }),
    };
  }, [t]);

  const buildManualGroup = useCallback((): SelectionTemplateGroupForm => {
    return {
      key: "manual",
      kind: "manual",
      serviceId: null,
      serviceName: t("sessionDetail.gallery.selectionTemplate.manualGroupTitle", {
        defaultValue: "İlave kurallar",
      }),
      billingType: null,
      disabled: false,
      rules: [],
    };
  }, [t]);

  const loadSelectionTemplate = useCallback(async () => {
    setSelectionLoading(true);
    setSelectionError(null);
    try {
      const { data: sessionRow, error: sessionError } = await supabase
        .from("sessions")
        .select("project_id")
        .eq("id", sessionId)
        .single();
      if (sessionError) throw sessionError;
      const resolvedProjectId = sessionRow?.project_id ?? null;
      setProjectId(resolvedProjectId);
      if (!resolvedProjectId) {
        setProjectHasServices(null);
        setSelectionGroups([buildManualGroup()]);
        setSelectionEnabled(true);
        return;
      }

      const { data: projectServices, error: projectServicesError } = await supabase
        .from<ProjectServiceWithTemplate>("project_services")
        .select("id,billing_type,services(id,name,service_type,selection_template)")
        .eq("project_id", resolvedProjectId);

      if (projectServicesError) throw projectServicesError;

      const servicesList = projectServices ?? [];
      setProjectHasServices(servicesList.length > 0);

      const templateCandidates = servicesList
        .filter((entry) => entry.services?.service_type === "deliverable")
        .map((entry) => ({
          billing_type: entry.billing_type,
          service: entry.services,
          rules: deserializeSelectionTemplate(entry.services?.selection_template),
        }))
        .filter((entry) => entry.rules.length > 0);

      if (templateCandidates.length === 0) {
        setSelectionGroups([buildManualGroup()]);
        setSelectionEnabled(true);
        return;
      }

      setSelectionGroups(
        templateCandidates.map((entry, index) => ({
          key: entry.service?.id ?? `service-${index}`,
          kind: "service" as const,
          serviceId: entry.service?.id ?? null,
          serviceName: entry.service?.name ?? null,
          billingType: entry.billing_type ?? null,
          disabled: false,
          rules: seedRulesIfEmpty(entry.rules),
        })).concat(buildManualGroup())
      );
      setSelectionEnabled(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc");
      setSelectionEnabled(false);
      setSelectionError(message);
    } finally {
      setSelectionLoading(false);
    }
  }, [sessionId, t, seedRulesIfEmpty, buildManualGroup]);

  useEffect(() => {
    if (!createOpen) {
      selectionInitializedRef.current = false;
      setSelectionLoading(false);
      setSelectionError(null);
      setSelectionGroups([]);
      setSelectionEnabled(false);
      setProjectId(null);
      setProjectHasServices(null);
      return;
    }
    setFormType("");
    if (selectionInitializedRef.current) return;
    selectionInitializedRef.current = true;
    void loadSelectionTemplate();
  }, [createOpen, loadSelectionTemplate]);

  useEffect(() => {
    if (formType === "proof") {
      setSelectionEnabled(true);
    } else {
      setSelectionEnabled(false);
    }
  }, [formType]);

  type SelectionInfoTone = "muted" | "success" | "destructive" | "warning";
  const selectionInfo = useMemo<{ text: string | null; tone: SelectionInfoTone }>(() => {
    if (selectionLoading) {
      return {
        text: t("sessionDetail.gallery.selectionTemplate.loading", {
          defaultValue: "Seçim kuralları yükleniyor...",
        }),
        tone: "muted",
      };
    }
    if (selectionError) {
      return { text: selectionError, tone: "destructive" };
    }
    if (selectionGroups.length > 0 && selectionGroups.some((group) => group.serviceId)) {
      return { text: null, tone: "success" };
    }
    if (!projectId) {
      return {
        text: t("sessionDetail.gallery.selectionTemplate.noProject", {
          defaultValue: "Seans projeye bağlı değil. Seçim kurallarını burada oluşturabilirsin.",
        }),
        tone: "muted",
      };
    }
    if (projectHasServices === false) {
      return {
        text: t("sessionDetail.gallery.selectionTemplate.noServices", {
          defaultValue: "Projeye henüz hizmet eklenmemiş. Seçim kurallarını elle ekleyebilirsin.",
        }),
        tone: "muted",
      };
    }
    return {
      text: t("sessionDetail.gallery.selectionTemplate.noTemplate", {
        defaultValue: "Hizmetlerde seçim kuralı yok. Kuralları buradan tanımlayabilirsin.",
      }),
      tone: "warning",
    };
  }, [selectionLoading, selectionError, selectionGroups, projectId, projectHasServices, t]);

  const { data, isLoading } = useQuery({
    queryKey: ["galleries", sessionId],
    queryFn: async (): Promise<GalleryRow[]> => {
      const { data, error } = await supabase
        .from("galleries")
        .select("id,title,type,status,branding,created_at,updated_at,published_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formTitle.trim()) {
        throw new Error(t("sessionDetail.gallery.form.errors.titleRequired"));
      }
      if (!formType) {
        throw new Error(
          t("sessionDetail.gallery.form.errors.typeRequired", {
            defaultValue: "Tür seçmeniz gerekiyor",
          })
        );
      }

      const branding: Record<string, unknown> = { eventDate: formEventDate };
      if (formType === "proof" && selectionEnabled) {
        const normalizedGroups = selectionGroups
          .map((group) => ({
            ...group,
            rules: normalizeSelectionTemplate(group.rules) ?? [],
            disabled: Boolean(group.disabled),
          }))
          .filter(
            (group) =>
              group.disabled ||
              (Array.isArray(group.rules) && group.rules.length > 0)
          )
          .map((group) => ({
            serviceId: group.serviceId ?? null,
            serviceName: group.serviceName ?? null,
            billingType: group.billingType ?? null,
            rules: group.rules,
            disabled: group.disabled,
          }));

        if (normalizedGroups.length > 0) {
          branding.selectionTemplateGroups = normalizedGroups;
          branding.selectionTemplate = normalizedGroups.flatMap((group) => group.rules);
        }
      }

      const defaultSetName = t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Highlights" });
      const { data, error } = await supabase
        .from("galleries")
        .insert({
          session_id: sessionId,
          title: formTitle.trim(),
          type: formType as GalleryType,
          status: "draft",
          branding,
          published_at: null,
        })
        .select("id")
        .single();

      if (error) throw error;
      const galleryId = data?.id as string | undefined;
      if (!galleryId) return "";
      // create default set
      await supabase.from("gallery_sets").insert({
        gallery_id: galleryId,
        name: defaultSetName,
        order_index: 0,
      });
      return galleryId;
    },
    onSuccess: (newId) => {
      setCreateOpen(false);
      setFormTitle("");
      setFormType("");
      setFormEventDate(normalizeDate(defaultEventDate));
      setSelectionGroups([]);
      setSelectionEnabled(false);
      setSelectionError(null);
      setProjectId(null);
      setProjectHasServices(null);
      selectionInitializedRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["galleries", sessionId] });
      toast({
        title: t("sessionDetail.gallery.toast.createdTitle"),
        description: t("sessionDetail.gallery.toast.createdDesc"),
      });
      if (newId) {
        navigate(`/galleries/${newId}`);
      }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : t("sessionDetail.gallery.toast.errorDesc");
      toast({
        title: t("sessionDetail.gallery.toast.errorTitle"),
        description: message,
        variant: "destructive",
      });
    },
  });

  const galleries = data ?? [];
  const hasGalleries = galleries.length > 0;
  const galleryIds = useMemo(() => galleries.map((gallery) => gallery.id), [galleries]);

  const { data: galleryAssetCounts, isLoading: galleryAssetCountsLoading } = useQuery({
    queryKey: ["gallery_asset_counts", sessionId, galleryIds],
    enabled: galleryIds.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        galleryIds.map(async (galleryId) => {
          try {
            const { count, error } = await supabase
              .from("gallery_assets")
              .select("id", { count: "exact", head: true })
              .eq("gallery_id", galleryId);

            if (error) {
              console.warn("SessionGallery: Failed to fetch asset count", {
                galleryId,
                error,
              });
              return [galleryId, 0] as const;
            }

            return [galleryId, count ?? 0] as const;
          } catch (error) {
            console.warn("SessionGallery: Failed to fetch asset count", {
              galleryId,
              error,
            });
            return [galleryId, 0] as const;
          }
        })
      );

      return Object.fromEntries(entries) as Record<string, number>;
    },
    staleTime: 30_000,
  });

  const coverAssetIds = useMemo(() => {
    const ids = new Set<string>();
    galleries.forEach((gallery) => {
      const coverAssetId = gallery.branding?.["coverAssetId"];
      if (typeof coverAssetId === "string" && coverAssetId.length > 0) {
        ids.add(coverAssetId);
      }
    });
    return Array.from(ids).sort();
  }, [galleries]);

  const { data: galleryCoverUrls } = useQuery({
    queryKey: ["gallery_cover_urls", sessionId, coverAssetIds],
    enabled: coverAssetIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("gallery_assets")
        .select("id,gallery_id,storage_path_web")
        .in("id", coverAssetIds);

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        gallery_id: string;
        storage_path_web: string | null;
      }>;

      const signedUrls = await Promise.all(
        rows.map(async (row) => {
          if (!row.storage_path_web) return { id: row.id, signedUrl: "" };

          const { data: urlData, error: urlError } = await supabase.storage
            .from(GALLERY_ASSETS_BUCKET)
            .createSignedUrl(row.storage_path_web, GALLERY_COVER_SIGNED_URL_TTL_SECONDS);

          if (urlError) {
            console.warn("SessionGallery: Failed to create signed url for cover asset", {
              assetId: row.id,
              error: urlError,
            });
            return { id: row.id, signedUrl: "" };
          }

          return { id: row.id, signedUrl: urlData?.signedUrl ?? "" };
        })
      );

      const signedUrlByAssetId = new Map(signedUrls.map((entry) => [entry.id, entry.signedUrl]));
      const coverUrlByGalleryId: Record<string, string> = {};

      rows.forEach((row) => {
        const signedUrl = signedUrlByAssetId.get(row.id) ?? "";
        if (signedUrl) {
          coverUrlByGalleryId[row.gallery_id] = signedUrl;
        }
      });

      return coverUrlByGalleryId;
    },
    staleTime: 30_000,
  });

  const emptyDescriptionLines = t("sessionDetail.gallery.emptyState.description").split("\n");
  const getTypeLabel = (gallery: GalleryRow) => {
    if (gallery.type === "other") {
      const customTypeLabel =
        typeof gallery.branding?.["customType"] === "string"
          ? (gallery.branding["customType"] as string)
          : null;
      if (customTypeLabel) {
        return customTypeLabel;
      }
    }
    return t(`sessionDetail.gallery.types.${gallery.type}`);
  };

  const getCoverUrl = (gallery: GalleryRow) => {
    const coverUrl = galleryCoverUrls?.[gallery.id] ?? null;
    if (coverUrl) return coverUrl;

    const legacyCoverUrl = gallery.branding?.["coverUrl"];
    return typeof legacyCoverUrl === "string" ? legacyCoverUrl : "";
  };

  const getEventDate = (gallery: GalleryRow) => {
    const eventDate = gallery.branding?.["eventDate"];
    return typeof eventDate === "string" ? eventDate : gallery.created_at;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[340px] overflow-hidden rounded-3xl border border-border/60 bg-background"
            >
              <Skeleton className="h-[165px] w-full" />
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-3/4" />
                <div className="pt-4">
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!hasGalleries) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-muted-foreground/30 bg-background px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
            <ImageIcon className="h-7 w-7 text-muted-foreground/80" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              {t("sessionDetail.gallery.emptyState.title")}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {emptyDescriptionLines.map((line, index) => (
                <span key={index}>
                  {line}
                  {index < emptyDescriptionLines.length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 btn-surface-accent"
            variant="surface"
          >
            <Plus className="h-4 w-4" />
            {t("sessionDetail.gallery.actions.create")}
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {galleries.map((gallery) => {
          const statusLabel = upperLabel(
            t(`sessionDetail.gallery.statuses.${gallery.status}`)
          );

          const statusClasses =
            gallery.status === "published" || gallery.status === "approved"
              ? "border-emerald-100 bg-white/90 text-emerald-700"
              : gallery.status === "draft"
                ? "border-white/10 bg-zinc-900/85 text-white"
                : "border-border/40 bg-white/80 text-foreground";

          const typeLabel = upperLabel(getTypeLabel(gallery));
          const typeClasses =
            gallery.type === "proof"
              ? "bg-indigo-50 text-indigo-700"
              : gallery.type === "final"
                ? "bg-amber-50 text-amber-800"
                : gallery.type === "retouch"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-muted text-muted-foreground";

          const coverUrl = getCoverUrl(gallery);
          const photoCount = galleryAssetCounts?.[gallery.id] ?? 0;

          return (
            <button
              key={gallery.id}
              type="button"
              onClick={() => navigate(`/galleries/${gallery.id}`)}
              className="group flex h-[340px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="relative h-[165px] w-full overflow-hidden bg-muted/40">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] transform-gpu will-change-transform"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/30">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}

                <div className="absolute left-4 top-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-md",
                      statusClasses
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold tracking-wide",
                      typeClasses
                    )}
                  >
                    {typeLabel}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatCardDate(getEventDate(gallery))}
                  </span>
                </div>

                <h4 className="mt-2 min-h-[3.25rem] text-2xl font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-emerald-700">
                  {gallery.title}
                </h4>

                <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="text-sm font-semibold text-muted-foreground">
                    {galleryAssetCountsLoading ? "…" : formatCount(photoCount)} Fotoğraf
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const handleCreate = () => {
    createMutation.mutate();
  };

  const handleSelectionToggle = useCallback(
    (enabled: boolean) => {
      if (selectionLoading) return;
      if (enabled) {
        setSelectionEnabled(true);
        setSelectionGroups((prev) =>
          prev.length > 0
            ? prev.map((group) => {
                const seededRules =
                  group.rules.length > 0
                    ? group.rules
                    : group.kind === "service" && group.serviceId
                      ? [createEmptyRule()]
                      : [];
                return { ...group, rules: seededRules };
              })
            : [{ ...buildManualGroup() }]
        );
      } else {
        setSelectionEnabled(false);
      }
    },
    [selectionLoading, buildManualGroup]
  );

  const helperText = t("sessionDetail.gallery.helper");

  const handleAddManualRule = useCallback(
    (groupKey: string) => {
      setSelectionGroups((prev) =>
        prev.map((group) =>
          group.key === groupKey
            ? { ...group, rules: [...group.rules, createManualRule()], kind: "manual" }
            : group
        )
      );
    },
    [createManualRule]
  );

  const handleServiceNameChange = useCallback((groupKey: string, value: string) => {
    setSelectionGroups((prev) =>
      prev.map((group) => (group.key === groupKey ? { ...group, serviceName: value } : group))
    );
  }, []);

  const handleToggleGroupDisabled = useCallback((groupKey: string, disabled: boolean) => {
    setSelectionGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;
        const isService = group.kind === "service" && group.serviceId;
        const seededRules =
          !disabled && isService && group.rules.length === 0 ? [createEmptyRule()] : group.rules;
        return { ...group, disabled, rules: seededRules };
      })
    );
  }, []);

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              {t("sessionDetail.gallery.title")}
            </CardTitle>
            {helperText ? (
              <p className="text-xs text-muted-foreground">{helperText}</p>
            ) : null}
          </div>
          {hasGalleries && (
            <Button
              size="sm"
              variant="surface"
              className="gap-2 btn-surface-accent"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("sessionDetail.gallery.actions.create")}
            </Button>
          )}
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="flex h-full w-full flex-col sm:max-w-3xl">
          <SheetHeader className="border-b pb-3">
            <SheetTitle>{t("sessionDetail.gallery.form.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="gallery-title">{t("sessionDetail.gallery.form.titleLabel")}</Label>
              <Input
                id="gallery-title"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder={t("sessionDetail.gallery.form.titlePlaceholder", {
                  leadName:
                    sessionLeadName?.trim() ||
                    t("sessionDetail.gallery.form.leadNamePlaceholder", {
                  defaultValue: "lead adı",
                }),
              })}
            />
          </div>
            <div className="space-y-2">
              <Label>{t("sessionDetail.gallery.form.eventDateLabel")}</Label>
              <DateTimePicker
                mode="date"
                value={formEventDate}
                onChange={(value) => setFormEventDate(value)}
                buttonClassName="justify-start"
                fullWidth
                popoverModal
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sessionDetail.gallery.form.typeLabel")}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {typeOptions.map((option) => {
                  const isSelected = formType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormType(option.value)}
                      className={cn(
                        typeCardBase,
                        hasTypeSelected
                          ? "border border-emerald-200 bg-white/80"
                          : "border-dashed border-emerald-300/70 bg-white/60 hover:border-emerald-400",
                        isSelected && "border-emerald-500 bg-emerald-50 shadow-sm",
                        hasTypeSelected && !isSelected && "opacity-70 hover:opacity-100",
                        hasTypeSelected ? "py-2.5" : "py-3.5"
                      )}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border text-emerald-600 transition-colors",
                          isSelected ? "border-emerald-200 bg-white" : "border-emerald-100 bg-emerald-50"
                        )}
                      >
                        <option.icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col items-start space-y-0.5 text-left">
                        <span className="text-sm font-semibold text-foreground">{option.label}</span>
                        <span className="text-[11px] leading-snug text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {formType === "proof" && selectionGroups.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  {tForms("service.selection_template.title")}
                </Label>
                {(() => {
                  const serviceGroups = selectionGroups.filter((group) => group.serviceId);
                  const manualGroups = selectionGroups.filter(
                    (group) => group.kind === "manual" || !group.serviceId
                  );
                  const manualGroup = manualGroups[0];
                  const hasServiceTemplates = serviceGroups.length > 0;
                  const manualPillLabel = t(
                    "sessionDetail.gallery.selectionTemplate.manualPill",
                    { defaultValue: "Hizmetten bağımsız" }
                  );
                  const addGeneralRuleLabel = t(
                    "sessionDetail.gallery.selectionTemplate.addGeneralRule",
                    { defaultValue: "İlave kural ekle" }
                  );
                  const manualGroupTitle = manualGroup?.serviceName
                    || t("sessionDetail.gallery.selectionTemplate.manualGroupTitle", {
                      defaultValue: "İlave kurallar",
                    });

                  const renderManualGroup = (withToggle: boolean) => {
                    if (!manualGroup) return null;
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
                            onClick={() => handleAddManualRule(manualGroup.key)}
                            disabled={!selectionEnabled}
                          >
                            <Plus className="h-4 w-4" />
                            {addGeneralRuleLabel}
                          </Button>
                        </div>
                        {hasManualRules ? (
                          <SelectionTemplateSection
                            enabled={selectionEnabled}
                            onToggleRequest={withToggle ? handleSelectionToggle : undefined}
                            rules={manualGroup.rules}
                            onRulesChange={(rules) =>
                              setSelectionGroups((prev) =>
                                prev.map((item) =>
                                  item.key === manualGroup.key ? { ...item, rules, kind: "manual" } : item
                                )
                              )
                            }
                            tone="emerald"
                            showHeader={false}
                            showToggle={withToggle}
                            variant="unstyled"
                            showAddButton={false}
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {t("sessionDetail.gallery.selectionTemplate.manualAddPrompt", {
                              defaultValue: "Click to add an extra rule.",
                            })}
                          </p>
                        )}
                      </div>
                    );
                  };

                  if (!hasServiceTemplates) {
                    return (
                      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                        {selectionInfo.text ? (
                          <p
                            className={cn(
                              "rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed",
                              selectionInfo.tone === "destructive"
                                ? "border-destructive/40 text-destructive"
                                : selectionInfo.tone === "success"
                                  ? "border-emerald-200 text-emerald-700"
                                  : selectionInfo.tone === "warning"
                                    ? "border-amber-300/70 text-amber-800 bg-amber-50/80"
                                    : "border-border/70 text-muted-foreground"
                            )}
                          >
                            {selectionInfo.text}
                          </p>
                        ) : null}
                        {renderManualGroup(true)}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                      <div className="space-y-4">
                        {serviceGroups.map((group) => {
                          const defaultServiceLabel = t(
                            "sessionDetail.gallery.selectionTemplate.customLabel",
                            {
                              defaultValue: "Özel seçim kuralları",
                            }
                          );
                          const serviceNameValue = group.serviceName ?? defaultServiceLabel;
                          const isDisabled = Boolean(group.disabled);
                          return (
                            <div key={group.key} className="space-y-2 w-full">
                              <div className="space-y-2 rounded-lg border border-emerald-100 bg-white/80 p-3 w-full">
                                <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                                  <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                                    <Input
                                      value={serviceNameValue}
                                      onChange={(event) =>
                                        handleServiceNameChange(group.key, event.target.value)
                                      }
                                      className="h-8 text-sm"
                                      disabled={isDisabled}
                                      aria-label={t(
                                        "sessionDetail.gallery.selectionTemplate.serviceNameInput",
                                        { defaultValue: "Hizmet adı" }
                                      )}
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
                                          onClick={() =>
                                            setSelectionGroups((prev) =>
                                              prev.map((item) =>
                                                item.key === group.key
                                                  ? {
                                                      ...item,
                                                      rules: [...item.rules, createEmptyRule()],
                                                      kind: "service",
                                                    }
                                                  : item
                                              )
                                            )
                                          }
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
                                    enabled={selectionEnabled}
                                    onToggleRequest={undefined}
                                    rules={group.rules}
                                    onRulesChange={(rules) =>
                                      setSelectionGroups((prev) =>
                                        prev.map((item) =>
                                          item.key === group.key ? { ...item, rules, kind: "service" } : item
                                        )
                                      )
                                    }
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
                      {renderManualGroup(false)}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <SheetFooter className="mt-2 gap-2 border-t bg-background px-0 pt-4 [&>button]:w-full sm:[&>button]:flex-1">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              {t("sessionDetail.gallery.form.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formTitle.trim() || !formType}
            >
              {createMutation.isPending ? (
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
