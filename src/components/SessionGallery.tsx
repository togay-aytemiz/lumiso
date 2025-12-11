import { useMemo, useState } from "react";
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
import {
  Plus,
  Image,
  Loader2,
  Link as LinkIcon,
  Check,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { cn } from "@/lib/utils";

interface SessionGalleryProps {
  sessionId: string;
  className?: string;
  defaultEventDate?: string;
  sessionLeadName?: string;
}

type GalleryType = "proof" | "retouch" | "final" | "other";
type GalleryStatus = "draft" | "published" | "archived";

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

const typeVariant: Record<GalleryType, "default" | "secondary" | "outline"> = {
  proof: "default",
  retouch: "secondary",
  final: "outline",
  other: "outline",
};

const normalizeDate = (value?: string) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const dateOnly = value.split("T")[0] ?? value;
  return dateOnly;
};

export default function SessionGallery({
  sessionId,
  className,
  defaultEventDate,
  sessionLeadName,
}: SessionGalleryProps) {
  const { t } = useTranslation("pages");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<GalleryType>("proof");
  const [formEventDate, setFormEventDate] = useState(() => normalizeDate(defaultEventDate));

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
    "group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

      const branding: Record<string, unknown> = { eventDate: formEventDate };

      const defaultSetName = t("sessionDetail.gallery.sets.defaultName", { defaultValue: "Highlights" });
      const { data, error } = await supabase
        .from("galleries")
        .insert({
          session_id: sessionId,
          title: formTitle.trim(),
          type: formType,
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
      setFormType("proof");
      setFormEventDate(normalizeDate(defaultEventDate));
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }

    if (!hasGalleries) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-muted-foreground/30 bg-background px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
            <Image className="h-7 w-7 text-muted-foreground/80" />
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
      <div className="space-y-2 rounded-lg border border-border/70 bg-white/80">
        {galleries.map((gallery) => (
          <div
            key={gallery.id}
            className="grid gap-2 p-3 sm:grid-cols-[1fr,140px,140px,120px] sm:items-center border-b last:border-b-0 border-border/50"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{gallery.title}</p>
                <Badge variant={typeVariant[gallery.type]}>
                  {getTypeLabel(gallery)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("sessionDetail.gallery.labels.updated")}{" "}
                {new Date(gallery.updated_at || gallery.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {t(`sessionDetail.gallery.statuses.${gallery.status}`)}
              </Badge>
              {gallery.status === "published" && (
                <div className="flex items-center gap-1 text-xs text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  {t("sessionDetail.gallery.labels.published")}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LinkIcon className="h-4 w-4" />
              {t("sessionDetail.gallery.labels.shareSoon")}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate(`/galleries/${gallery.id}`)}
              >
                <AlertCircle className="h-4 w-4" />
                {t("sessionDetail.gallery.actions.manage", { defaultValue: "Manage" })}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleCreate = () => {
    createMutation.mutate();
  };

  const helperText = t("sessionDetail.gallery.helper");

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
        <SheetContent className="flex h-full w-full flex-col sm:max-w-lg">
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
                        "border-emerald-100 bg-white/80 hover:border-emerald-200",
                        isSelected && "border-emerald-500 bg-emerald-50 shadow-sm"
                      )}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border text-emerald-600 transition-colors",
                          isSelected ? "border-emerald-200 bg-white" : "border-emerald-100 bg-emerald-50"
                        )}
                      >
                        <option.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col items-start space-y-1 text-left">
                        <span className="font-semibold text-foreground">{option.label}</span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
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
              disabled={createMutation.isPending || !formTitle.trim()}
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
