import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import GalleryClientPreview from "@/pages/GalleryClientPreview";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";

const ACCESS_STORAGE_PREFIX = "gallery-access:";

const normalizePin = (value: string) => value.replaceAll(/\s+/g, "").toUpperCase();

export default function GalleryPublic() {
  const { publicId = "" } = useParams<{ publicId: string }>();
  const { t } = useTranslation("pages");
  const normalizedPublicId = useMemo(() => publicId.trim().toUpperCase(), [publicId]);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedGalleryId, setResolvedGalleryId] = useState<string | null>(null);

  const accessStorageKey = useMemo(() => `${ACCESS_STORAGE_PREFIX}${normalizedPublicId}`, [normalizedPublicId]);

  useEffect(() => {
    if (!normalizedPublicId) return;
    const stored = sessionStorage.getItem(accessStorageKey);
    if (stored) {
      setResolvedGalleryId(stored);
    }
  }, [accessStorageKey, normalizedPublicId]);

  useEffect(() => {
    let cancelled = false;

    const ensureAnonymousSession = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          throw signInError;
        }
      }

      if (!cancelled) {
        setAuthReady(true);
      }
    };

    ensureAnonymousSession().catch((error: unknown) => {
      if (cancelled) return;
      setAuthError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => normalizePin(pinInput).length === 6 && authReady && !submitting, [
    authReady,
    pinInput,
    submitting,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!normalizedPublicId) return;
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase.functions.invoke("gallery-access", {
        body: { publicId: normalizedPublicId, pin: normalizePin(pinInput) },
      });

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 401) {
          setSubmitError(
            t("sessionDetail.gallery.publicAccess.errors.invalidPin", { defaultValue: "Şifre hatalı" })
          );
        } else if (status === 404) {
          setSubmitError(
            t("sessionDetail.gallery.publicAccess.errors.notFound", { defaultValue: "Galeri bulunamadı" })
          );
        } else {
          setSubmitError(
            t("sessionDetail.gallery.publicAccess.errors.generic", { defaultValue: "Bir sorun oluştu. Lütfen tekrar deneyin." })
          );
        }
        return;
      }

      const galleryId = (data as { galleryId?: string } | null)?.galleryId ?? "";
      if (!galleryId) {
        setSubmitError(
          t("sessionDetail.gallery.publicAccess.errors.generic", { defaultValue: "Bir sorun oluştu. Lütfen tekrar deneyin." })
        );
        return;
      }

      sessionStorage.setItem(accessStorageKey, galleryId);
      setResolvedGalleryId(galleryId);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("sessionDetail.gallery.publicAccess.errors.generic", { defaultValue: "Bir sorun oluştu. Lütfen tekrar deneyin." })
      );
    } finally {
      setSubmitting(false);
    }
  }, [accessStorageKey, canSubmit, normalizedPublicId, pinInput, t]);

  if (resolvedGalleryId) {
    return <GalleryClientPreview galleryId={resolvedGalleryId} />;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">
              {t("sessionDetail.gallery.publicAccess.errors.authFailedTitle", { defaultValue: "Giriş başlatılamadı" })}
            </p>
            <p>{authError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-7 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold text-foreground mb-2">
              {t("sessionDetail.gallery.publicAccess.title", { defaultValue: "Galeri Şifre Korumalı" })}
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {t("sessionDetail.gallery.publicAccess.description", {
                defaultValue: "Bu galeriye erişmek için fotoğrafçınızın paylaştığı şifreyi girin.",
              })}
            </p>

            <div className="w-full space-y-2 text-left">
              <Label htmlFor="gallery-pin">
                {t("sessionDetail.gallery.publicAccess.pinLabel", { defaultValue: "Giriş Şifresi" })}
              </Label>
              <Input
                id="gallery-pin"
                value={pinInput}
                onChange={(event) => {
                  setSubmitError(null);
                  setPinInput(event.target.value);
                }}
                placeholder={t("sessionDetail.gallery.publicAccess.pinPlaceholder", { defaultValue: "6 karakter" })}
                disabled={!authReady || submitting}
                autoComplete="one-time-code"
                inputMode="text"
                autoCapitalize="characters"
                className="text-center tracking-[0.35em] font-mono"
              />
              {submitError ? (
                <p className="text-sm text-destructive">{submitError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {t("sessionDetail.gallery.publicAccess.pinHint", {
                    defaultValue: "Şifre büyük/küçük harf duyarlı değildir.",
                  })}
                </p>
              )}
            </div>

            <Button
              type="button"
              className="mt-6 w-full"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("sessionDetail.gallery.publicAccess.submitting", { defaultValue: "Kontrol ediliyor…" })}
                </>
              ) : (
                t("sessionDetail.gallery.publicAccess.submit", { defaultValue: "Devam et" })
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
