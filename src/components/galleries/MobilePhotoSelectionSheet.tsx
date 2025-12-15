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
  minCount?: number;
  required?: boolean;
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
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="font-bold text-lg text-gray-900 leading-tight">
              {t("sessionDetail.gallery.clientPreview.labels.addToLists")}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{t("sessionDetail.gallery.lightbox.sidebar.client.description")}</p>
          </div>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => {
            const isSelected = selectedRuleIds.includes(rule.id);
            const isFull = rule.maxCount ? rule.currentCount >= rule.maxCount : false;
            const isDisabled = !isSelected && isFull;
            const serviceName = rule.serviceName?.trim() ?? "";

            // Replicate smart status logic locally to keep it consistent 
            // (or ideally this should be a shared helper, but inline is fine here for now)
            const minCount = Math.max(0, rule.minCount ?? 0);
            // Wait, we just need to know if it's "Valid" or "Missing" for color coding? 
            // Actually, the chip just says "Zorunlu" or "Opsiyonel". 
            // The status text (Valid/Missing) is separate.
            // User request: "Zorunlu/optional in a chip but very compact top of the name (1st line)"

            return (
              <div key={rule.id} className={`group w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left
                    ${isSelected ? "bg-brand-50 border-brand-200 shadow-sm" : "bg-white border-gray-100 active:bg-gray-50"}
                    ${isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""}
                  `}
                onClick={() => {
                  if (!isDisabled) onToggleRule(rule.id);
                }}
              >
                <div className="flex items-start gap-4 w-full">
                  <div
                    className={`shrink-0 w-10 h-10 mt-1 rounded-full flex items-center justify-center transition-colors
                          ${isSelected ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-400"}
                        `}
                  >
                    {isSelected ? <Check size={18} strokeWidth={3} /> : <ListPlus size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Chip Line */}
                    <div className="mb-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${rule.required
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-500"
                        }`}>
                        {rule.required
                          ? t("sessionDetail.gallery.clientPreview.labels.mandatory")
                          : t("sessionDetail.gallery.clientPreview.labels.optional")}
                      </span>
                    </div>

                    <div className={`font-bold text-sm truncate leading-snug ${isSelected ? "text-brand-900" : "text-gray-900"}`}>
                      {rule.title}
                    </div>

                    {serviceName ? (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate mt-0.5">
                        {serviceName}
                      </div>
                    ) : null}

                    <div className={`text-xs font-medium mt-1.5 ${isFull && !isSelected ? "text-orange-500" : "text-gray-500"}`}>
                      <span className="tabular-nums">
                        {rule.currentCount} / {rule.minCount && rule.maxCount && rule.minCount !== rule.maxCount ? `${rule.minCount}-${rule.maxCount}` : (rule.maxCount || "∞")}
                      </span>
                      {isFull && !isSelected ? (
                        <span className="ml-1.5 font-normal opacity-90 text-orange-600">
                          • {t("sessionDetail.gallery.clientPreview.labels.limitReached")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={closeSheet}
          className="w-full mt-6 bg-gray-900 text-white py-4 rounded-xl font-bold text-sm active:scale-[0.99] transition-transform"
        >
          {tCommon("buttons.close")}
        </button>
      </div>
    </div>
  );
}

