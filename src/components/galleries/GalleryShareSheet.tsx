import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Link2,
  Loader2,
  Lock,
  Mail,
  MessageCircleHeart,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type GalleryShareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: (channel: "whatsapp" | "email") => void;
  title: string;
  clientName: string;
  eventLabel?: string;
  coverUrl?: string;
  publicId: string | null;
  pin: string;
  pinLoading?: boolean;
  generatingPublicId?: boolean;
};

export function GalleryShareSheet({
  open,
  onOpenChange,
  onShare,
  title,
  clientName,
  eventLabel,
  coverUrl,
  publicId,
  pin,
  pinLoading,
  generatingPublicId,
}: GalleryShareSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const copyLinkTimeoutRef = useRef<number | null>(null);
  const copyPinTimeoutRef = useRef<number | null>(null);

  const sectionLabelClassName = "block text-xs font-bold text-muted-foreground uppercase tracking-wide";

  const publicUrl = useMemo(() => {
    const normalized = publicId?.trim();
    if (!normalized) return "";
    const origin = window.location.origin;
    if (!origin) return "";
    try {
      return new URL(`/g/${normalized}`, origin).toString();
    } catch {
      return `${origin.replace(/\/+$/, "")}/g/${normalized}`;
    }
  }, [publicId]);

  const normalizedPin = pin.trim();
  const resolvedClientName = useMemo(() => clientName.trim() || t("sessionDetail.unknownClient"), [clientName, t]);

  const messageUrlValue = useMemo(() => {
    if (publicUrl) return publicUrl;
    if (generatingPublicId) return t("sessionDetail.gallery.shareSheet.generatingLink");
    return t("sessionDetail.gallery.shareSheet.publicLinkPlaceholder");
  }, [generatingPublicId, publicUrl, t]);

  const messagePinValue = useMemo(() => {
    if (normalizedPin) return normalizedPin;
    if (pinLoading) return "••••••";
    return t("sessionDetail.gallery.shareSheet.pinPlaceholder");
  }, [normalizedPin, pinLoading, t]);

  const defaultMessage = useMemo(() => {
    return t("sessionDetail.gallery.shareSheet.messageTemplate", {
      clientName: resolvedClientName,
      url: messageUrlValue,
      pin: messagePinValue,
    });
  }, [messagePinValue, messageUrlValue, resolvedClientName, t]);

  useEffect(() => {
    if (!open) return;
    if (copyLinkTimeoutRef.current) {
      window.clearTimeout(copyLinkTimeoutRef.current);
      copyLinkTimeoutRef.current = null;
    }
    if (copyPinTimeoutRef.current) {
      window.clearTimeout(copyPinTimeoutRef.current);
      copyPinTimeoutRef.current = null;
    }
    setCopiedLink(false);
    setCopiedPin(false);
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyLinkTimeoutRef.current) {
        window.clearTimeout(copyLinkTimeoutRef.current);
      }
      if (copyPinTimeoutRef.current) {
        window.clearTimeout(copyPinTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      if (copyLinkTimeoutRef.current) {
        window.clearTimeout(copyLinkTimeoutRef.current);
      }
      copyLinkTimeoutRef.current = window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failures (non-secure contexts, permissions).
    }
  }, [publicUrl]);

  const handleCopyPin = useCallback(async () => {
    if (!normalizedPin || pinLoading) return;
    try {
      await navigator.clipboard.writeText(normalizedPin);
      setCopiedPin(true);
      if (copyPinTimeoutRef.current) {
        window.clearTimeout(copyPinTimeoutRef.current);
      }
      copyPinTimeoutRef.current = window.setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // Ignore clipboard failures (non-secure contexts, permissions).
    }
  }, [normalizedPin, pinLoading]);

  const handleOpenLink = useCallback(() => {
    if (!publicUrl) return;
    const win = window.open(publicUrl, "_blank", "noopener,noreferrer");
    win?.focus?.();
  }, [publicUrl]);

  const whatsappUrl = useMemo(() => `https://wa.me/?text=${encodeURIComponent(defaultMessage)}`, [defaultMessage]);

  const mailSubject = useMemo(
    () => t("sessionDetail.gallery.shareSheet.emailSubject", { title: title.trim() }),
    [t, title]
  );

  const mailUrl = useMemo(() => {
    const subject = encodeURIComponent(mailSubject);
    const body = encodeURIComponent(defaultMessage);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [defaultMessage, mailSubject]);

  const linkValue = messageUrlValue;

  const linkCopyDisabled = !publicUrl || Boolean(generatingPublicId);
  const pinCopyDisabled = !normalizedPin || Boolean(pinLoading);
  const quickActionsDisabled = linkCopyDisabled || pinCopyDisabled;

  const sideVariant = isMobile ? "bottom" : "right";
  const sheetContentClassName = cn(
    "flex min-h-0 flex-col overflow-hidden w-full",
    !isMobile && "sm:max-w-md",
    isMobile && cn("max-h-[85vh]", "h-[calc(100vh-12px)]", "rounded-t-xl")
  );
  const scrollContainerClassName = cn(
    "flex-1 overflow-y-auto pb-4 my-0 py-0",
    isMobile && "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sideVariant} className={sheetContentClassName}>
        <SheetHeader className="border-b pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold">
                {t("sessionDetail.gallery.shareSheet.title")}
              </SheetTitle>
              <SheetDescription className="mt-1">
                {t("sessionDetail.gallery.shareSheet.description")}
              </SheetDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              aria-label={tCommon("buttons.close")}
              className="h-8 w-8 p-0 rounded-full shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </SheetHeader>

        <div className={scrollContainerClassName}>
          <div className="space-y-6">
            <div>
              <label className={cn(sectionLabelClassName, "mb-3")}>
                {t("sessionDetail.gallery.shareSheet.previewLabel")}
              </label>
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                <div className="h-40 w-full relative bg-muted/30">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted/40 flex items-center justify-center text-muted-foreground">
                      <Globe className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded flex items-center gap-1.5 text-[10px] font-bold">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {t("sessionDetail.gallery.shareSheet.passwordBadge")}
                  </div>
                </div>
                <div className="p-4 bg-background">
                  <div className="font-bold text-foreground leading-tight text-lg">{title}</div>
                  {eventLabel ? (
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
                      {eventLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bg-brand-50/30 border border-brand-100 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-brand-100 text-brand-600">
                  <Link2 className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-foreground">
                    {t("sessionDetail.gallery.shareSheet.publicLinkLabel")}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t("sessionDetail.gallery.shareSheet.publicLinkDescription")}
                  </p>
                </div>
                {generatingPublicId ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" aria-hidden="true" />
                ) : null}
              </div>

              <div className="bg-background border border-brand-200 rounded-lg p-3 mb-3 shadow-sm">
                <div
                  className={cn(
                    "font-mono text-sm text-muted-foreground truncate select-all",
                    !publicUrl && "text-muted-foreground"
                  )}
                  aria-label={t("sessionDetail.gallery.shareSheet.publicLinkAria")}
                >
                  {linkValue}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenLink}
                  disabled={!publicUrl}
                  className="w-full justify-center rounded-lg border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-800 active:scale-95 transition-transform"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t("sessionDetail.gallery.shareSheet.openLink")}
                </Button>

                <Button
                  type="button"
                  variant="default"
                  onClick={handleCopyLink}
                  disabled={linkCopyDisabled}
                  className={cn(
                    "w-full justify-center rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-200 active:scale-95 transition-transform",
                    copiedLink && "pointer-events-none"
                  )}
                >
                  {copiedLink ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copiedLink ? t("sessionDetail.gallery.shareSheet.copied") : t("sessionDetail.gallery.shareSheet.copyLink")}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                    <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      {t("sessionDetail.gallery.shareSheet.passwordSectionTitle")}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {t("sessionDetail.gallery.shareSheet.passwordSectionDescription")}
                    </p>
                  </div>
                </div>

                <div className="bg-background border border-orange-200 rounded-lg p-1.5 flex items-center justify-between pl-4 shadow-sm">
                  <span className="font-mono text-lg font-bold text-foreground tracking-widest">
                    {pinLoading ? "••••••" : normalizedPin || t("sessionDetail.gallery.shareSheet.pinPlaceholder")}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyPin}
                    disabled={pinCopyDisabled}
                    className={cn(
                      "p-2.5 rounded-lg transition-colors",
                      pinCopyDisabled
                        ? "text-orange-300 cursor-not-allowed"
                        : "text-orange-600 hover:bg-orange-50"
                    )}
                    title={t("sessionDetail.gallery.shareSheet.copyPinTitle")}
                    aria-label={t("sessionDetail.gallery.shareSheet.copyPinTitle")}
                  >
                    {copiedPin ? <Check className="h-[18px] w-[18px]" aria-hidden="true" /> : <Copy className="h-[18px] w-[18px]" aria-hidden="true" />}
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-2 text-[10px] text-orange-700 bg-orange-100/50 p-2 rounded-lg">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {t("sessionDetail.gallery.shareSheet.pinHint")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 sm:pt-5">
          <div className="space-y-2">
            <label className={sectionLabelClassName}>{t("sessionDetail.gallery.shareSheet.quickActionsLabel")}</label>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="surface"
                disabled={quickActionsDisabled}
                onClick={() => {
                  if (quickActionsDisabled) return;
                  onShare?.("whatsapp");
                  const win = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                  win?.focus?.();
                }}
                className={cn(
                  "w-full justify-center",
                  quickActionsDisabled
                    ? "shadow-none"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white shadow-sm"
                )}
              >
                <MessageCircleHeart className="h-4 w-4" aria-hidden="true" />
                {t("sessionDetail.gallery.shareSheet.whatsapp")}
              </Button>

              <Button
                type="button"
                variant="surface"
                disabled={quickActionsDisabled}
                onClick={() => {
                  if (quickActionsDisabled) return;
                  onShare?.("email");
                  window.location.href = mailUrl;
                }}
                className="w-full justify-center"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t("sessionDetail.gallery.shareSheet.email")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
