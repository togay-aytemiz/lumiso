import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Image as ImageIcon, ListPlus, X } from "lucide-react";

export type MobilePhotoSelectionSheetPhoto = {
  id: string;
  url: string;
  filename: string;
};

export type MobilePhotoSelectionSheetRule = {
  id: string;
  title: string;
  serviceName?: string | null;
  currentCount: number;
  maxCount: number | null;
};

interface MobilePhotoSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: MobilePhotoSelectionSheetPhoto;
  rules: MobilePhotoSelectionSheetRule[];
  selectedRuleIds: string[];
  onToggleRule: (ruleId: string) => void;
  photoImageBroken?: boolean;
  onPhotoImageError?: () => void;
  zIndexClassName?: string;
}

export function MobilePhotoSelectionSheet({
  open,
  onOpenChange,
  photo,
  rules,
  selectedRuleIds,
  onToggleRule,
  photoImageBroken,
  onPhotoImageError,
  zIndexClassName = "z-[200]",
}: MobilePhotoSelectionSheetProps) {
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const titleId = useId();
  const [localImageBroken, setLocalImageBroken] = useState(false);

  useEffect(() => {
    setLocalImageBroken(false);
  }, [photo.id, photo.url]);

  if (!open) return null;

  const closeSheet = () => onOpenChange(false);
  const isImageBroken = Boolean(photoImageBroken || localImageBroken);

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex flex-col justify-end md:hidden`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSheet} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

        <button
          type="button"
          onClick={closeSheet}
          className="absolute top-4 right-4 w-11 h-11 bg-gray-50 rounded-full flex items-center justify-center active:scale-95"
          aria-label={tCommon("buttons.close")}
        >
          <X size={20} className="text-gray-500" />
        </button>

        <div className="flex items-start gap-4 mb-6 border-b border-gray-100 pb-6">
          {photo.url && !isImageBroken ? (
            <img
              src={photo.url}
              className="w-16 h-16 rounded-lg object-cover bg-gray-100"
              alt={photo.filename}
              loading="lazy"
              onError={() => {
                setLocalImageBroken(true);
                onPhotoImageError?.();
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <ImageIcon size={20} aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h3 id={titleId} className="font-bold text-lg text-gray-900">
              {t("sessionDetail.gallery.clientPreview.labels.addToLists")}
            </h3>
            <p className="text-sm text-gray-500">{t("sessionDetail.gallery.lightbox.sidebar.client.description")}</p>
          </div>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => {
            const isSelected = selectedRuleIds.includes(rule.id);
            const isFull = rule.maxCount ? rule.currentCount >= rule.maxCount : false;
            const isDisabled = !isSelected && isFull;
            const serviceName = rule.serviceName?.trim() ?? "";

            return (
              <button
                key={rule.id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) onToggleRule(rule.id);
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
}

