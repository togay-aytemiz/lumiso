import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type GalleryShareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [customMessage, setCustomMessage] = useState("");
  const messageTouchedRef = useRef(false);
  const messageInitRef = useRef(false);
  const copyLinkTimeoutRef = useRef<number | null>(null);
  const copyPinTimeoutRef = useRef<number | null>(null);

  const sectionLabelClassName = "block text-xs font-bold text-muted-foreground uppercase tracking-wide";

  const publicUrl = useMemo(() => {
    const normalized = publicId?.trim();
    if (!normalized) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
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
    if (!open) {
      messageInitRef.current = false;
      return;
    }
    messageInitRef.current = true;
    if (copyLinkTimeoutRef.current) {
      window.clearTimeout(copyLinkTimeoutRef.current);
      copyLinkTimeoutRef.current = null;
    }
    if (copyPinTimeoutRef.current) {
      window.clearTimeout(copyPinTimeoutRef.current);
      copyPinTimeoutRef.current = null;
    }
    messageTouchedRef.current = false;
    setCopiedLink(false);
    setCopiedPin(false);
    setCustomMessage("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!messageInitRef.current) return;
    if (!defaultMessage) return;
    if (messageTouchedRef.current) return;
    setCustomMessage(defaultMessage);
  }, [defaultMessage, open]);

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

  const resetToDefaultMessage = useCallback(() => {
    messageTouchedRef.current = false;
    setCustomMessage(defaultMessage);
  }, [defaultMessage]);

  const whatsappUrl = useMemo(() => `https://wa.me/?text=${encodeURIComponent(customMessage)}`, [customMessage]);

  const mailSubject = useMemo(
    () => t("sessionDetail.gallery.shareSheet.emailSubject", { title: title.trim() }),
    [t, title]
  );

  const mailUrl = useMemo(() => {
    const subject = encodeURIComponent(mailSubject);
    const body = encodeURIComponent(customMessage);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [customMessage, mailSubject]);

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
    "flex-1 overflow-y-auto pb-6 my-0 py-0",
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
          <div className="space-y-8">
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

            <div>
              <label className={cn(sectionLabelClassName, "mb-3")}>
                {t("sessionDetail.gallery.shareSheet.publicLinkLabel")}
              </label>
              <div className="flex gap-2 h-12">
                <div className="flex-1 relative h-full">
                  <Input
                    type="text"
                    readOnly
                    value={linkValue}
                    onFocus={(event) => event.currentTarget.select()}
                    className={cn(
                      "w-full h-full pl-4 pr-10 bg-muted/30 border-border rounded-xl text-sm text-foreground focus-visible:ring-brand-500",
                      linkCopyDisabled && "text-muted-foreground"
                    )}
                    aria-label={t("sessionDetail.gallery.shareSheet.publicLinkAria")}
                    disabled={linkCopyDisabled}
                  />
                  {generatingPublicId ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 transition-opacity duration-300",
                        copiedLink ? "opacity-100" : "opacity-0"
                      )}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={linkCopyDisabled}
                  className="h-full px-6 bg-gray-900 hover:bg-black text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors active:scale-95 transform whitespace-nowrap"
                >
                  {copiedLink ? t("sessionDetail.gallery.shareSheet.copied") : t("sessionDetail.gallery.shareSheet.copyLink")}
                  {!copiedLink && <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copiedLink && <Check className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
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

                <div className="bg-background border border-orange-200 rounded-lg p-1.5 flex items-center justify-between pl-4">
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

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={sectionLabelClassName}>
                  {t("sessionDetail.gallery.shareSheet.messageLabel")}
                </label>
                <button
                  type="button"
                  onClick={resetToDefaultMessage}
                  className="text-[10px] font-bold text-brand-600 hover:text-brand-700 hover:underline bg-brand-50 px-2 py-1 rounded transition-colors"
                  disabled={!defaultMessage}
                >
                  {t("sessionDetail.gallery.shareSheet.resetMessage")}
                </button>
              </div>
              <Textarea
                value={customMessage}
                onChange={(event) => {
                  messageTouchedRef.current = true;
                  setCustomMessage(event.target.value);
                }}
                className="w-full h-24 p-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground focus-visible:ring-brand-500 resize-none leading-relaxed"
                placeholder={t("sessionDetail.gallery.shareSheet.messagePlaceholder")}
              />
            </div>

            <div>
              <label className={cn(sectionLabelClassName, "mb-3")}>
                {t("sessionDetail.gallery.shareSheet.quickActionsLabel")}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <a
                  href={quickActionsDisabled ? undefined : whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={quickActionsDisabled}
                  tabIndex={quickActionsDisabled ? -1 : 0}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-green-100 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-200 transition-all group",
                    quickActionsDisabled && "pointer-events-none opacity-50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-5 w-5 fill-green-600 text-green-600" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold">{t("sessionDetail.gallery.shareSheet.whatsapp")}</span>
                </a>

                <a
                  href={quickActionsDisabled ? undefined : mailUrl}
                  aria-disabled={quickActionsDisabled}
                  tabIndex={quickActionsDisabled ? -1 : 0}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-200 transition-all group",
                    quickActionsDisabled && "pointer-events-none opacity-50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Mail className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold">{t("sessionDetail.gallery.shareSheet.email")}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 bg-muted/20">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-muted-foreground/80">
                <Globe className="h-3 w-3" aria-hidden="true" />
                {t("sessionDetail.gallery.shareSheet.footerPublicLabel")}
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenLink}
              disabled={!publicUrl}
              className={cn(
                "flex items-center gap-1 hover:text-foreground transition-colors",
                !publicUrl && "opacity-50 cursor-not-allowed hover:text-muted-foreground"
              )}
            >
              {t("sessionDetail.gallery.shareSheet.openLink")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
