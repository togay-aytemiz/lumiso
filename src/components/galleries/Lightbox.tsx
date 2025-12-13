import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  ListChecks,
  PanelRightClose,
  PlusCircle,
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
  maxCount: number | null;
};

type LightboxMode = "admin" | "client";

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
}

export function Lightbox({
  isOpen,
  onClose,
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
}: LightboxProps) {
  const { t } = useTranslation("pages");
  const currentPhoto = photos[currentIndex];
  const [showClientSelectionPanel, setShowClientSelectionPanel] = useState(mode === "client");

  const activeRule = useMemo(
    () => (activeRuleId ? rules.find((rule) => rule.id === activeRuleId) ?? null : null),
    [activeRuleId, rules]
  );
  const isSelectedForActiveRule = activeRuleId ? currentPhoto?.selections.includes(activeRuleId) : false;
  const activeRuleIsFull = activeRule?.maxCount != null ? activeRule.currentCount >= activeRule.maxCount : false;
  const isActiveRuleDisabled = Boolean(activeRule && activeRuleIsFull && !isSelectedForActiveRule);
  const hasSelections = (currentPhoto?.selections.length ?? 0) > 0;

  useEffect(() => {
    if (isOpen) {
      setShowClientSelectionPanel(mode === "client");
    }
  }, [isOpen, mode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      const key = event.key.toLowerCase();
      if (key === "escape") onClose();
      if (key === "arrowleft") onNavigate(currentIndex - 1);
      if (key === "arrowright") onNavigate(currentIndex + 1);

      if (!currentPhoto) return;
      if (mode === "client" && favoritesEnabled && key === "f") onToggleStar(currentPhoto.id);
      if (mode === "admin" && key === "s") onToggleStar(currentPhoto.id);

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
  ]);

  if (!isOpen || !currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-[200] flex bg-black/95 backdrop-blur-sm text-white" role="dialog" aria-modal="true">
      <div
        className={`relative flex flex-col h-full flex-1 transition-all duration-300 ${
          showClientSelectionPanel && mode === "client" ? "mr-80" : ""
        }`}
      >
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-sm font-medium opacity-80 shrink-0">
              {currentIndex + 1} / {photos.length}
            </span>
            <span className="text-sm opacity-60 font-mono truncate">{currentPhoto.filename}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
            >
              <span className="text-sm font-medium hidden sm:inline uppercase tracking-wide">
                {t("sessionDetail.gallery.lightbox.close")}
              </span>
              <X size={24} />
            </button>

            {mode === "client" && !showClientSelectionPanel ? (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                {activeRule ? (
                  <button
                    type="button"
                    onClick={() => !isActiveRuleDisabled && onToggleRule(currentPhoto.id, activeRule.id)}
                    disabled={isActiveRuleDisabled}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all shadow-lg hidden sm:flex disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelectedForActiveRule
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
                  onClick={() => setShowClientSelectionPanel(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all bg-white/10 text-white hover:bg-white hover:text-brand-600 backdrop-blur-md border border-white/10"
                  title={t("sessionDetail.gallery.lightbox.showSelectionsTitle")}
                >
                  <ListChecks size={18} />
                  <span className="hidden sm:inline">{t("sessionDetail.gallery.lightbox.showSelections")}</span>
                  {hasSelections ? (
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
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 hover:bg-white/10 rounded-full transition-colors disabled:opacity-20 disabled:cursor-not-allowed z-10"
          aria-label={t("sessionDetail.gallery.lightbox.previous")}
        >
          <ChevronLeft size={32} />
        </button>

        <button
          type="button"
          onClick={() => onNavigate(currentIndex + 1)}
          disabled={currentIndex === photos.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 hover:bg-white/10 rounded-full transition-colors disabled:opacity-20 disabled:cursor-not-allowed z-10"
          aria-label={t("sessionDetail.gallery.lightbox.next")}
        >
          <ChevronRight size={32} />
        </button>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
          {currentPhoto.url ? (
            <img
              src={currentPhoto.url}
              alt={currentPhoto.filename}
              className="max-w-full max-h-full object-contain shadow-2xl"
              onError={() => onImageError?.(currentPhoto.id)}
            />
          ) : (
            <div className="text-sm text-white/60">{t("sessionDetail.gallery.lightbox.noPreview")}</div>
          )}
        </div>
      </div>

      {mode === "admin" || (mode === "client" && showClientSelectionPanel) ? (
        <div
          className={`fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 transition-transform duration-300 z-20 shadow-2xl ${
            showClientSelectionPanel && mode === "client"
              ? "translate-x-0"
              : mode === "admin"
                ? "translate-x-0"
                : "translate-x-full"
          }`}
        >
          <div className="p-6 border-b border-gray-800 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-lg mb-1 truncate">
                {mode === "client"
                  ? t("sessionDetail.gallery.lightbox.sidebar.client.title")
                  : t("sessionDetail.gallery.lightbox.sidebar.admin.title")}
              </h3>
              <p className="text-xs text-gray-400">
                {mode === "client"
                  ? t("sessionDetail.gallery.lightbox.sidebar.client.description")
                  : t("sessionDetail.gallery.lightbox.sidebar.admin.description")}
              </p>
            </div>

            {mode === "client" ? (
              <button
                type="button"
                onClick={() => setShowClientSelectionPanel(false)}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors px-3 py-1.5 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10"
                title={t("sessionDetail.gallery.lightbox.collapseTitle")}
              >
                <span className="text-xs font-medium uppercase tracking-wide">
                  {t("sessionDetail.gallery.lightbox.collapse")}
                </span>
                <PanelRightClose size={18} />
              </button>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {mode === "client" ? (
              <div className="space-y-3">
                {favoritesEnabled ? (
                  <button
                    type="button"
                    onClick={() => onToggleStar(currentPhoto.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group ${
                      currentPhoto.isFavorite
                        ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-900/20"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-800/80 hover:border-gray-600"
                    }`}
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
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    currentPhoto.isStarred
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-400"
                      : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500"
                  }`}
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
                  className={`w-full flex items-center justify-between p-3 rounded-lg border border-dashed transition-all ${
                    currentPhoto.isFavorite
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
                  const serviceName = rule.serviceName || t("sessionDetail.gallery.lightbox.lists.generalService");

                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => !isDisabled && onToggleRule(currentPhoto.id, rule.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group disabled:opacity-50 ${
                        isSelected
                          ? "bg-brand-900/30 border-brand-500/50 shadow-[0_0_15px_rgba(14,165,233,0.1)]"
                          : "bg-transparent border-gray-700 hover:bg-gray-800 hover:border-gray-600"
                      } ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                      title={isDisabled ? t("sessionDetail.gallery.lightbox.limitFull") : undefined}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className={`text-sm font-semibold mb-0.5 truncate ${isSelected ? "text-white" : "text-gray-300"}`}>
                          {rule.title}
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={isSelected ? "text-brand-400" : "text-gray-500"}>{serviceName}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-600" />
                          <span className={isFull && !isSelected ? "text-orange-400" : "text-gray-500"}>
                            {rule.currentCount} / {rule.maxCount || "∞"}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
