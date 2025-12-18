import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GalleryWatermarkConfig } from "@/lib/galleryWatermark";
import { GalleryWatermarkOverlay } from "./GalleryWatermarkOverlay";
import { MobilePhotoSelectionSheet } from "./MobilePhotoSelectionSheet";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  ListChecks,
  ListPlus,
  PanelRightClose,
  PlusCircle,
  Share2,
  Star,
  X,
} from "lucide-react";

export type LightboxPhoto = {
  id: string;
  url: string;
  filename: string;
  isFavorite: boolean;
  isStarred: boolean;
  selections: string[];
};

export type LightboxRule = {
  id: string;
  title: string;
  serviceName?: string | null;
  currentCount: number;
  maxCount?: number;
  minCount?: number; // Add minCount to support validation status
  required?: boolean;
};

type LightboxMode = "admin" | "client";

// Helper to determine rule status in Lightbox
const getLightboxRuleStatus = (
  rule: LightboxRule,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const isRequired = rule.required;
  const currentCount = rule.currentCount;
  const minCount = Math.max(0, rule.minCount ?? 0); // Default to 0 if missing

  // 1. Mandatory Rules
  if (isRequired) {
    const effectiveMin = minCount < 1 ? 1 : minCount;
    const isComplete = currentCount >= effectiveMin;

    if (isComplete) {
      return {
        isComplete: true,
        statusLabel: t("sessionDetail.gallery.clientPreview.labels.validSelection"),
        statusColor: "text-emerald-500", // Brighter for dark mode
      };
    } else {
      const missing = effectiveMin - currentCount;
      return {
        isComplete: false,
        statusLabel: t("sessionDetail.gallery.clientPreview.tasks.missingCount", { count: missing }),
        statusColor: "text-orange-400", // Brighter for dark mode
      };
    }
  }

  // 2. Optional Rules
  if (currentCount === 0) {
    return {
      isComplete: true,
      statusLabel: t("sessionDetail.gallery.clientPreview.labels.optional"),
      statusColor: "text-gray-500 opacity-60",
    };
  }

  if (minCount > 0 && currentCount < minCount) {
    const missing = minCount - currentCount;
    return {
      isComplete: false,
      statusLabel: t("sessionDetail.gallery.clientPreview.tasks.missingCount", { count: missing }),
      statusColor: "text-orange-400",
    };
  }

  return {
    isComplete: true,
    statusLabel: t("sessionDetail.gallery.clientPreview.labels.validSelection"),
    statusColor: "text-emerald-500",
  };
};

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  photos: LightboxPhoto[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  rules: LightboxRule[];
  onToggleRule: (photoId: string, ruleId: string) => void;
  onToggleStar: (photoId: string) => void;
  mode?: LightboxMode;
  activeRuleId?: string | null;
  favoritesEnabled?: boolean;
  onImageError?: (photoId: string) => void;
  watermark?: GalleryWatermarkConfig;
  isSelectionsLocked?: boolean;
  readOnly?: boolean;
}

export function Lightbox({
  isOpen,
  onClose,
  // Force HMR update
  photos,
  currentIndex,
  onNavigate,
  rules,
  onToggleRule,
  onToggleStar,
  mode = "admin",
  activeRuleId,
  favoritesEnabled = true,
  onImageError,
  watermark,
  isSelectionsLocked = false,
  readOnly = false,
}: LightboxProps) {
  const { t } = useTranslation("pages");
  const currentPhoto = photos[currentIndex];
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSelectionPanelOpen, setIsMobileSelectionPanelOpen] = useState(false);
  const hasSelectionRules = rules.length > 0;

  // Carousel State
  const [mobileApi, setMobileApi] = useState<CarouselApi>();
  const [desktopApi, setDesktopApi] = useState<CarouselApi>();
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeLastXRef = useRef<number | null>(null);
  const swipeLastYRef = useRef<number | null>(null);
  const swipeStartIndexRef = useRef<number>(0);
  const swipeStartCarouselIndexRef = useRef<number | null>(null);

  const activeRule = useMemo(
    () => (activeRuleId ? rules.find((rule) => rule.id === activeRuleId) ?? null : null),
    [activeRuleId, rules]
  );
  const isSelectedForActiveRule = activeRuleId ? currentPhoto?.selections.includes(activeRuleId) : false;
  const activeRuleIsFull = activeRule?.maxCount != null ? activeRule.currentCount >= activeRule.maxCount : false;
  const isActiveRuleDisabled =
    Boolean(activeRule && activeRuleIsFull && !isSelectedForActiveRule) || isSelectionsLocked || readOnly;
  const hasSelections = (currentPhoto?.selections.length ?? 0) > 0;
  const isFavoriteToggleDisabled = readOnly || (mode === "client" && isSelectionsLocked);

  const handleMobileSwipeTouchStart = useMemo(
    () => (event: React.TouchEvent<HTMLImageElement>) => {
      const touch = event.targetTouches?.[0];
      if (!touch) return;
      swipeStartXRef.current = touch.clientX;
      swipeStartYRef.current = touch.clientY;
      swipeLastXRef.current = touch.clientX;
      swipeLastYRef.current = touch.clientY;
      swipeStartIndexRef.current = currentIndex;
      swipeStartCarouselIndexRef.current = mobileApi ? mobileApi.selectedScrollSnap() : null;
    },
    [currentIndex, mobileApi]
  );

  const handleMobileSwipeTouchMove = useMemo(
    () => (event: React.TouchEvent<HTMLImageElement>) => {
      const touch = event.targetTouches?.[0];
      if (!touch) return;
      swipeLastXRef.current = touch.clientX;
      swipeLastYRef.current = touch.clientY;
    },
    []
  );

  const handleMobileSwipeTouchEnd = useMemo(
    () => (event: React.TouchEvent<HTMLImageElement>) => {
      const startX = swipeStartXRef.current;
      const startY = swipeStartYRef.current;
      if (startX == null || startY == null) return;

      const changedTouch = event.changedTouches?.[0];
      const endX = changedTouch?.clientX ?? swipeLastXRef.current ?? startX;
      const endY = changedTouch?.clientY ?? swipeLastYRef.current ?? startY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      swipeLastXRef.current = null;
      swipeLastYRef.current = null;

      const threshold = 50;
      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < Math.abs(deltaY)) return;
      if (photos.length < 2) return;

      const startingCarouselIndex = swipeStartCarouselIndexRef.current;
      if (mobileApi && startingCarouselIndex != null && mobileApi.selectedScrollSnap() !== startingCarouselIndex) {
        return;
      }

      const direction = deltaX < 0 ? 1 : -1;
      const baseIndex = swipeStartIndexRef.current;
      const nextIndex = Math.max(0, Math.min(baseIndex + direction, photos.length - 1));
      if (nextIndex !== baseIndex) {
        onNavigate(nextIndex);
      }
    },
    [mobileApi, onNavigate, photos.length]
  );

  useEffect(() => {
    if (isOpen) {
      if (mode === "client") {
        setIsMobileSelectionPanelOpen(false);
      }
    }
  }, [isOpen, mode]);

  // Sync currentIndex -> Carousels
  useEffect(() => {
    if (!isOpen) return;
    if (mobileApi && mobileApi.selectedScrollSnap() !== currentIndex) {
      mobileApi.scrollTo(currentIndex);
    }
    if (desktopApi && desktopApi.selectedScrollSnap() !== currentIndex) {
      desktopApi.scrollTo(currentIndex);
    }
  }, [mobileApi, desktopApi, currentIndex, isOpen]);

  // Sync Mobile Carousel -> currentIndex
  useEffect(() => {
    if (!mobileApi) return;
    const onSelect = () => {
      const selected = mobileApi.selectedScrollSnap();
      if (selected !== currentIndex) {
        onNavigate(selected);
      }
    };
    mobileApi.on("select", onSelect);
    return () => {
      mobileApi.off("select", onSelect);
    };
  }, [mobileApi, currentIndex, onNavigate]);

  // Sync Desktop Carousel -> currentIndex
  useEffect(() => {
    if (!desktopApi) return;
    const onSelect = () => {
      const selected = desktopApi.selectedScrollSnap();
      if (selected !== currentIndex) {
        onNavigate(selected);
      }
    };
    desktopApi.on("select", onSelect);
    return () => {
      desktopApi.off("select", onSelect);
    };
  }, [desktopApi, currentIndex, onNavigate]);



  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      const key = event.key.toLowerCase();
      if (key === "escape") onClose();
      if (key === "arrowleft") onNavigate(currentIndex - 1);
      if (key === "arrowright") onNavigate(currentIndex + 1);

      if (!currentPhoto) return;
      if (!readOnly) {
        if (mode === "client" && favoritesEnabled && key === "f" && !isSelectionsLocked) onToggleStar(currentPhoto.id);
        if (mode === "admin" && key === "s") onToggleStar(currentPhoto.id);
      }

      if (mode === "client" && activeRuleId && event.code === "Space" && !isActiveRuleDisabled) {
        event.preventDefault();
        onToggleRule(currentPhoto.id, activeRuleId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    currentIndex,
    onNavigate,
    onClose,
    onToggleStar,
    currentPhoto,
    mode,
    activeRuleId,
    onToggleRule,
    isActiveRuleDisabled,
    favoritesEnabled,
    isSelectionsLocked,
    readOnly,
  ]);

  if (!isOpen || !currentPhoto) return null;

  const desktopContainerClassName = `fixed inset-0 z-[200] ${mode === "client" ? "hidden md:flex" : "flex"
    } bg-black/95 backdrop-blur-sm text-white`;

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // ignore share cancellations
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore clipboard failures
    }
  };

  const shouldRenderMobileAddButton = hasSelectionRules && !isSelectionsLocked && !readOnly;
  const addButtonActive =
    shouldRenderMobileAddButton &&
    (isMobileSelectionPanelOpen || currentPhoto.selections.length > 0);



  return (
    <>
      {mode === "client" ? (
        <div className="fixed inset-0 z-[200] flex bg-black text-white md:hidden" role="dialog" aria-modal="true">
          <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-black">
            <div className="absolute top-0 left-0 right-0 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95"
                aria-label={t("sessionDetail.gallery.lightbox.close")}
              >
                <X size={24} />
              </button>
              <div className="flex flex-col items-center min-w-0 px-2">
                <div className="text-sm font-medium text-white/80 tabular-nums">
                  {currentIndex + 1} / {photos.length}
                </div>
                <div className="mt-0.5 text-[11px] text-white/60 font-mono max-w-[70vw] truncate">
                  {currentPhoto.filename}
                </div>
              </div>
              <div className="w-11" />
            </div>

            {currentPhoto.isStarred ? (
              <div className="absolute top-20 left-4 z-10 bg-amber-400 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-in fade-in zoom-in duration-300">
                <Star size={14} fill="currentColor" />
                <span className="text-xs font-bold uppercase tracking-wide">
                  {t("sessionDetail.gallery.lightbox.client.photographerPickTitleShort")}
                </span>
              </div>
            ) : null}

            <div className="relative flex-1 flex items-center justify-center w-full h-full overflow-hidden">
              <Carousel
                setApi={setMobileApi}
                className="w-full h-full"
                opts={{
                  loop: true,
                  duration: 20,
                  align: "center",
                }}
              >
                <CarouselContent className="h-full ml-0">
                  {photos.map((photo, index) => (
                    <CarouselItem
                      key={photo.id}
                      className="relative w-full h-full pl-0 flex items-center justify-center min-w-full"
                    >
                      {Math.abs(index - currentIndex) <= 2 ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img
                            src={photo.url}
                            alt={photo.filename}
                            className="max-w-full max-h-full object-contain"
                            onError={() => onImageError?.(photo.id)}
                            onTouchStart={handleMobileSwipeTouchStart}
                            onTouchMove={handleMobileSwipeTouchMove}
                            onTouchEnd={handleMobileSwipeTouchEnd}
                          />
                          {mode === "client" && watermark ? (
                            <GalleryWatermarkOverlay
                              watermark={watermark}
                              variant="lightbox"
                              className="z-10"
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/[0.14] hover:bg-white/[0.2] backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed z-20"
                    aria-label={t("sessionDetail.gallery.lightbox.previous")}
                    data-testid="lightbox-mobile-prev"
                  >
                    <ChevronLeft size={28} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate(currentIndex + 1)}
                    disabled={currentIndex === photos.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/[0.14] hover:bg-white/[0.2] backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed z-20"
                    aria-label={t("sessionDetail.gallery.lightbox.next")}
                    data-testid="lightbox-mobile-next"
                  >
                    <ChevronRight size={28} />
                  </button>
                </>
              ) : null}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 pb-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex items-end justify-center gap-10">
              {favoritesEnabled ? (
                <button
                  type="button"
                  onClick={() => onToggleStar(currentPhoto.id)}
                  disabled={isFavoriteToggleDisabled}
                  className="flex flex-col items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${currentPhoto.isFavorite
                      ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.45)]"
                      : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                  >
                    <Heart size={26} fill={currentPhoto.isFavorite ? "currentColor" : "none"} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    {t("sessionDetail.gallery.lightbox.mobileActions.favorite")}
                  </span>
                </button>
              ) : null}

              {shouldRenderMobileAddButton ? (
                <button
                  type="button"
                  onClick={() => setIsMobileSelectionPanelOpen((prev) => !prev)}
                  disabled={isSelectionsLocked}
                  className="flex flex-col items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 relative ${addButtonActive ? "bg-brand-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.35)]" : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                  >
                    <ListPlus size={26} />
                    {currentPhoto.selections.length > 0 ? (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-white text-brand-700 rounded-full text-[11px] font-bold flex items-center justify-center shadow">
                        {currentPhoto.selections.length}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    {t("sessionDetail.gallery.lightbox.mobileActions.add")}
                  </span>
                </button>
              ) : null}

              <button type="button" onClick={handleShare} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all active:scale-95">
                  <Share2 size={26} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  {t("sessionDetail.gallery.lightbox.mobileActions.share")}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "client" ? (
        hasSelectionRules ? (
          <MobilePhotoSelectionSheet
            open={isMobileSelectionPanelOpen}
            onOpenChange={setIsMobileSelectionPanelOpen}
            photo={{
              id: currentPhoto.id,
              url: currentPhoto.url,
              filename: currentPhoto.filename,
            }}
            rules={rules.map((rule) => ({
              id: rule.id,
              title: rule.title,
              serviceName: rule.serviceName,
              currentCount: rule.currentCount,
              maxCount: rule.maxCount,
              required: rule.required,
            }))}
            selectedRuleIds={currentPhoto.selections}
            onToggleRule={(ruleId) => {
              if (isSelectionsLocked || readOnly) return;
              onToggleRule(currentPhoto.id, ruleId);
            }}
            onPhotoImageError={() => onImageError?.(currentPhoto.id)}
            zIndexClassName="z-[210]"
          />
        ) : null
      ) : null}

      <div className={desktopContainerClassName} role="dialog" aria-modal="true">
        <div
          className={`relative flex flex-col h-full flex-1 transition-all duration-300 ${isSidebarOpen ? "md:mr-80" : ""
            }`}
        >
          <div className="absolute top-0 left-0 right-0 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-sm font-medium opacity-80 shrink-0">
                {currentIndex + 1} / {photos.length}
              </span>
              <span className="min-w-0 flex-1 text-sm opacity-60 font-mono truncate">{currentPhoto.filename}</span>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label={t("sessionDetail.gallery.lightbox.close")}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-colors text-white/90"
              >
                <span className="text-sm font-medium hidden sm:inline uppercase tracking-wide">
                  {t("sessionDetail.gallery.lightbox.close")}
                </span>
                <X size={24} />
              </button>

              {!isSidebarOpen ? (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                  {mode === "client" && activeRule ? (
                    <button
                      type="button"
                      onClick={() => !isActiveRuleDisabled && onToggleRule(currentPhoto.id, activeRule.id)}
                      disabled={isActiveRuleDisabled}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all shadow-lg hidden sm:flex disabled:opacity-50 disabled:cursor-not-allowed ${isSelectedForActiveRule
                        ? "bg-brand-500 text-white hover:bg-red-500 hover:shadow-red-500/30"
                        : "bg-white text-gray-900 hover:bg-brand-50 hover:text-brand-600"
                        }`}
                      title={isActiveRuleDisabled ? t("sessionDetail.gallery.lightbox.limitFull") : undefined}
                    >
                      {isSelectedForActiveRule ? (
                        <>
                          <CheckCircle2 size={18} />
                          <span>{t("sessionDetail.gallery.lightbox.quickAdd.added", { rule: activeRule.title })}</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle size={18} />
                          <span>{t("sessionDetail.gallery.lightbox.quickAdd.add", { rule: activeRule.title })}</span>
                        </>
                      )}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all bg-white/10 text-white hover:bg-white hover:text-brand-600 backdrop-blur-md border border-white/10"
                    title={
                      hasSelectionRules
                        ? t("sessionDetail.gallery.lightbox.showSelectionsTitle")
                        : t("sessionDetail.gallery.lightbox.showDetailsTitle")
                    }
                  >
                    {hasSelectionRules ? <ListChecks size={18} /> : <Heart size={18} />}
                    <span className="hidden sm:inline">
                      {hasSelectionRules
                        ? t("sessionDetail.gallery.lightbox.showSelections")
                        : t("sessionDetail.gallery.lightbox.showDetails")}
                    </span>
                    {hasSelectionRules && hasSelections ? (
                      <span className="ml-1 bg-white text-brand-600 text-[10px] px-1.5 rounded-full min-w-[1.5rem] text-center">
                        {currentPhoto.selections.length}
                      </span>
                    ) : null}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/[0.14] hover:bg-white/[0.2] backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed z-20"
            aria-label={t("sessionDetail.gallery.lightbox.previous")}
          >
            <ChevronLeft size={32} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate(currentIndex + 1)}
            disabled={currentIndex === photos.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/[0.14] hover:bg-white/[0.2] backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed z-20"
            aria-label={t("sessionDetail.gallery.lightbox.next")}
          >
            <ChevronRight size={32} />
          </button>

          <div className="relative flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
            <Carousel
              setApi={setDesktopApi}
              className="w-full h-full"
              opts={{
                loop: true,
                duration: 20,
                align: "center",
              }}
            >
              <CarouselContent className="h-full ml-0">
                {photos.map((photo, index) => (
                  <CarouselItem key={photo.id} className="relative w-full h-full pl-0 flex items-center justify-center min-w-full">
                    {Math.abs(index - currentIndex) <= 2 ? (
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        className="max-w-full max-h-full object-contain shadow-2xl"
                        onError={() => onImageError?.(photo.id)}
                      />
                    ) : null}
                    {mode === "client" && watermark && Math.abs(index - currentIndex) <= 2 ? (
                      <GalleryWatermarkOverlay watermark={watermark} variant="lightbox" className="z-10" />
                    ) : null}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>

        {isSidebarOpen ? (
          <div
            className={`fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 ${mode === "client" ? "hidden md:flex" : "flex"
              } flex-col shrink-0 transition-transform duration-300 z-20 shadow-2xl ${"translate-x-0"
              }`}
          >
            <div className="p-6 border-b border-gray-800 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg mb-1 truncate">
                  {mode === "client"
                    ? hasSelectionRules
                      ? t("sessionDetail.gallery.lightbox.sidebar.client.title")
                      : t("sessionDetail.gallery.lightbox.sidebar.client.finalTitle")
                    : t("sessionDetail.gallery.lightbox.sidebar.admin.title")}
                </h3>
                <p className="text-xs text-gray-400">
                  {mode === "client"
                    ? hasSelectionRules
                      ? t("sessionDetail.gallery.lightbox.sidebar.client.description")
                      : t("sessionDetail.gallery.lightbox.sidebar.client.finalDescription")
                    : t("sessionDetail.gallery.lightbox.sidebar.admin.description")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors px-3 py-1.5 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10"
                title={t("sessionDetail.gallery.lightbox.collapseTitle")}
              >
                <span className="text-xs font-medium uppercase tracking-wide">
                  {t("sessionDetail.gallery.lightbox.collapse")}
                </span>
                <PanelRightClose size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {mode === "client" ? (
                <div className="space-y-3">
                  {favoritesEnabled ? (
                    <button
                      type="button"
                      onClick={() => onToggleStar(currentPhoto.id)}
                      disabled={isFavoriteToggleDisabled}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group ${currentPhoto.isFavorite
                        ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-900/20"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-800/80 hover:border-gray-600"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span className="font-semibold flex items-center gap-3">
                        <Heart
                          size={20}
                          fill={currentPhoto.isFavorite ? "currentColor" : "none"}
                          className={currentPhoto.isFavorite ? "animate-in zoom-in spin-in-12 duration-300" : ""}
                        />
                        <span>
                          {currentPhoto.isFavorite
                            ? t("sessionDetail.gallery.lightbox.client.favoriteAdded")
                            : t("sessionDetail.gallery.lightbox.client.favoriteAdd")}
                        </span>
                      </span>
                      {currentPhoto.isFavorite ? <CheckCircle2 size={18} className="text-white/80" /> : null}
                    </button>
                  ) : null}

                  {currentPhoto.isStarred ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-500/10 border border-amber-500/30 text-amber-200 animate-in fade-in slide-in-from-right-4">
                      <div className="p-1.5 bg-amber-500 rounded-full text-white shadow-sm shrink-0">
                        <Star size={12} fill="currentColor" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-amber-100 uppercase tracking-wide truncate">
                          {t("sessionDetail.gallery.lightbox.client.photographerPickTitle")}
                        </span>
                        <span className="text-[10px] opacity-70">
                          {t("sessionDetail.gallery.lightbox.client.photographerPickDescription")}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "admin" ? (
                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {t("sessionDetail.gallery.lightbox.admin.photoStatusTitle")}
                    </span>
                  </div>

	                  <button
	                    type="button"
	                    onClick={() => onToggleStar(currentPhoto.id)}
	                    disabled={readOnly}
	                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${currentPhoto.isStarred
	                      ? "bg-amber-500/10 border-amber-500/50 text-amber-400"
	                      : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500"
	                      } ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
	                  >
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Star size={16} fill={currentPhoto.isStarred ? "currentColor" : "none"} />
                      {t("sessionDetail.gallery.lightbox.admin.starLabel")}
                    </span>
                    {currentPhoto.isStarred ? (
                      <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">
                        {t("sessionDetail.gallery.lightbox.admin.starSelected")}
                      </span>
                    ) : null}
                  </button>

                  <div
                    className={`w-full flex items-center justify-between p-3 rounded-lg border border-dashed transition-all ${currentPhoto.isFavorite
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-transparent border-gray-700 text-gray-500 opacity-60"
                      }`}
                  >
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Heart size={16} fill={currentPhoto.isFavorite ? "currentColor" : "none"} />
                      {t("sessionDetail.gallery.lightbox.admin.clientFavoriteLabel")}
                    </span>
                    {currentPhoto.isFavorite ? (
                      <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded text-red-300">
                        {t("sessionDetail.gallery.lightbox.admin.clientFavoriteYes")}
                      </span>
                    ) : (
                      <span className="text-[10px]">{t("sessionDetail.gallery.lightbox.admin.clientFavoriteNo")}</span>
                    )}
                  </div>
                </div>
              ) : null}

              {hasSelectionRules ? (
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">
                    {mode === "client"
                      ? t("sessionDetail.gallery.lightbox.lists.clientTitle")
                      : t("sessionDetail.gallery.lightbox.lists.adminTitle")}
                  </div>

                  <div className="space-y-2">
                    {rules.map((rule) => {
	                    const isSelected = currentPhoto.selections.includes(rule.id);
	                    const isFull = rule.maxCount ? rule.currentCount >= rule.maxCount : false;
	                    const isDisabled = !isSelected && isFull;
	                    const isRuleToggleDisabled = isDisabled || isSelectionsLocked || readOnly;
                    const serviceName = rule.serviceName || t("sessionDetail.gallery.lightbox.lists.generalService");
                    const ruleStatus = getLightboxRuleStatus(rule, t);

                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => !isRuleToggleDisabled && onToggleRule(currentPhoto.id, rule.id)}
                        disabled={isRuleToggleDisabled}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group disabled:opacity-50 ${isSelected
                          ? "bg-brand-900/30 border-brand-500/50 shadow-[0_0_15px_rgba(14,165,233,0.1)]"
                          : "bg-transparent border-gray-700 hover:bg-gray-800 hover:border-gray-600"
                          } ${isRuleToggleDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                        title={isDisabled ? t("sessionDetail.gallery.lightbox.limitFull") : undefined}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          {/* Chip Line */}
                          <div className="mb-1.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${rule.required
                              ? "bg-brand-900/40 text-brand-300 border border-brand-500/20"
                              : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
                              }`}>
                              {rule.required
                                ? t("sessionDetail.gallery.clientPreview.labels.mandatory")
                                : t("sessionDetail.gallery.clientPreview.labels.optional")}
                            </span>
                          </div>

                          <div className={`text-sm font-semibold mb-0.5 truncate ${isSelected ? "text-white" : "text-gray-300"}`}>
                            {rule.title}
                          </div>
                          <div className={`text-[10px] mb-0.5 ${isSelected ? "text-brand-400" : "text-gray-500"}`}>
                            {serviceName}
                          </div>
                          <div className={`text-xs font-medium ${isFull && !isSelected ? "text-orange-400" : "text-gray-400"}`}>
                            {rule.currentCount} / {rule.minCount && rule.maxCount && rule.minCount !== rule.maxCount ? `${rule.minCount}-${rule.maxCount}` : (rule.maxCount || "∞")}
                            {isFull && !isSelected ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
                                {t("sessionDetail.gallery.clientPreview.labels.limitFull")}
                              </span>
                            ) : null}
                            <span className="mx-1.5 opacity-30">•</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${ruleStatus.statusColor}`}>
                              {ruleStatus.statusLabel}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected
                            ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                            : "bg-gray-800 border border-gray-600 text-transparent group-hover:border-gray-500"
                            }`}
                        >
                          {isSelected ? <Check size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />}
                        </div>
                      </button>
                    );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
