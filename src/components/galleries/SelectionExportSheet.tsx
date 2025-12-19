import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Command,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Heart,
  Info,
  Layers,
  Monitor,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { sanitizeFileBasename } from "@/lib/fileNames";

export type SelectionExportTab = "windows" | "mac" | "list";

export type SelectionExportPhoto = {
  id: string;
  filename: string;
  selections: string[];
  isFavorite: boolean;
};

export type SelectionExportRule = {
  id: string;
  title: string;
};

type SelectionExportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: SelectionExportPhoto[];
  rules: SelectionExportRule[];
};

type ExportGroup = {
  id: string;
  title: string;
  icon: ReactNode;
  photos: SelectionExportPhoto[];
  tone: "indigo" | "red";
};

const FAVORITES_GROUP_ID = "favorites";

const getPreferredTab = (): SelectionExportTab => {
  if (typeof navigator === "undefined") return "windows";
  const userAgentDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  const platform = String(userAgentDataPlatform || navigator.platform || navigator.userAgent || "").toLowerCase();
  if (platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad") || platform.includes("ipod")) {
    return "mac";
  }
  return "windows";
};

const downloadPlainText = (filename: string, content: string) => {
  const element = document.createElement("a");
  const file = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(file);
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  element.remove();
  URL.revokeObjectURL(url);
};

const escapeQuotedValue = (value: string) => value.replace(/"/g, '\\"');

const formatOrToken = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const safePattern = /^[\w.-]+$/;
  if (safePattern.test(trimmed)) return trimmed;
  return `"${escapeQuotedValue(trimmed)}"`;
};

const buildExportQuery = (tab: SelectionExportTab, filenames: string[]) => {
  const normalized = filenames.map((name) => name.trim()).filter(Boolean);
  if (normalized.length === 0) return "";

  switch (tab) {
    case "windows": {
      const parts = normalized.map(formatOrToken).filter(Boolean) as string[];
      return `name:(${parts.join(" OR ")})`;
    }
    case "mac": {
      const parts = normalized.map(formatOrToken).filter(Boolean) as string[];
      return parts.join(" OR ");
    }
    case "list":
      return normalized.join(" ");
    default:
      return "";
  }
};

const ExportSection = ({
  title,
  count,
  icon,
  filenames,
  query,
  activeTab,
  tone,
}: {
  title: string;
  count: number;
  icon: ReactNode;
  filenames: string[];
  query: string;
  activeTab: SelectionExportTab;
  tone: ExportGroup["tone"];
}) => {
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!query) return;
      try {
        await navigator.clipboard.writeText(query);
        setCopied(true);
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard failures (non-secure contexts, permissions).
      }
    },
    [query]
  );

  const handleDownload = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (filenames.length === 0) return;
      const fileName = `${sanitizeFileBasename(title)}_list.txt`;
      downloadPlainText(fileName, filenames.join("\n"));
    },
    [filenames, title]
  );

  const queryLabel = useMemo(() => {
    switch (activeTab) {
      case "windows":
        return t("sessionDetail.gallery.exportSheet.queryLabels.windows");
      case "mac":
        return t("sessionDetail.gallery.exportSheet.queryLabels.mac");
      case "list":
        return t("sessionDetail.gallery.exportSheet.queryLabels.list");
      default:
        return "";
    }
  }, [activeTab, t]);

  const iconClassName = tone === "red" ? "bg-red-50 text-red-500" : "bg-indigo-50 text-indigo-600";

  return (
    <div
      className={cn(
        "border rounded-xl overflow-hidden bg-white transition-all duration-300",
        isExpanded ? "border-indigo-200 shadow-md ring-1 ring-indigo-50" : "border-gray-200 shadow-sm hover:border-gray-300"
      )}
    >
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors group text-left"
      >
        <div className="flex items-center gap-4">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", iconClassName)}>{icon}</div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm">{title}</h4>
            <p className="text-xs text-gray-500">{t("sessionDetail.gallery.exportSheet.fileCount", { count })}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!query}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors border border-gray-200 disabled:opacity-50 disabled:pointer-events-none"
              title={tCommon("buttons.copy")}
              aria-label={tCommon("buttons.copy")}
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={filenames.length === 0}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors border border-gray-200 disabled:opacity-50 disabled:pointer-events-none"
              title={t("sessionDetail.gallery.exportSheet.downloadTxt")}
              aria-label={t("sessionDetail.gallery.exportSheet.downloadTxt")}
            >
              <Download size={16} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <div className="text-gray-400 p-1 group-hover:text-gray-600" aria-hidden="true">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="px-4 pb-4 pt-0 bg-white animate-in slide-in-from-top-1 duration-200">
           <div className="relative pt-2 border-t border-gray-100 mt-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">
              {queryLabel}
            </label>
            <div className="w-full h-24 bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-xs text-gray-600 overflow-y-auto break-words select-all whitespace-pre-wrap focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow">
              {query}
            </div>
            {activeTab === "list" ? (
              <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                <Info size={12} aria-hidden="true" />
                {t("sessionDetail.gallery.exportSheet.listTipInline")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export function SelectionExportSheet({ open, onOpenChange, photos, rules }: SelectionExportSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");

  const [activeTab, setActiveTab] = useState<SelectionExportTab>("windows");
  const [copiedAll, setCopiedAll] = useState(false);
  const copiedAllTimeoutRef = useRef<number | null>(null);

  const groups = useMemo(() => {
    const categorized: ExportGroup[] = [];
    const allRuleSelectedPhotos = photos.filter((photo) => photo.selections.length > 0);

    const favorites = photos.filter((photo) => photo.isFavorite);
    if (favorites.length > 0) {
      categorized.push({
        id: FAVORITES_GROUP_ID,
        title: t("sessionDetail.gallery.exportSheet.favoritesTitle"),
        icon: <Heart size={18} fill="currentColor" />,
        photos: favorites,
        tone: "red",
      });
    }

    rules.forEach((rule) => {
      const rulePhotos = photos.filter((photo) => photo.selections.includes(rule.id));
      if (rulePhotos.length === 0) return;
      categorized.push({
        id: rule.id,
        title: rule.title,
        icon: <Layers size={18} />,
        photos: rulePhotos,
        tone: "indigo",
      });
    });

    return { all: allRuleSelectedPhotos, categorized };
  }, [photos, rules, t]);

  const hasAnythingToExport = useMemo(
    () => photos.some((photo) => photo.isFavorite || photo.selections.length > 0),
    [photos]
  );

  const generateQuery = useCallback(
    (targetPhotos: SelectionExportPhoto[]) => buildExportQuery(activeTab, targetPhotos.map((photo) => photo.filename)),
    [activeTab]
  );

  useEffect(() => {
    if (!open) return;
    setActiveTab(getPreferredTab());
    setCopiedAll(false);
    if (copiedAllTimeoutRef.current) {
      window.clearTimeout(copiedAllTimeoutRef.current);
      copiedAllTimeoutRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (copiedAllTimeoutRef.current) {
        window.clearTimeout(copiedAllTimeoutRef.current);
      }
    };
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (groups.all.length === 0) return;
    const filenames = groups.all.map((photo) => photo.filename);
    const baseName = sanitizeFileBasename(t("sessionDetail.gallery.exportSheet.downloadFileNames.master"));
    downloadPlainText(`${baseName}.txt`, filenames.join("\n"));
  }, [groups.all, t]);

  const handleCopyAll = useCallback(async () => {
    if (groups.all.length === 0) return;
    const query = generateQuery(groups.all);
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      setCopiedAll(true);
      if (copiedAllTimeoutRef.current) {
        window.clearTimeout(copiedAllTimeoutRef.current);
      }
      copiedAllTimeoutRef.current = window.setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Ignore clipboard failures (non-secure contexts, permissions).
    }
  }, [generateQuery, groups.all]);

  const sideVariant = isMobile ? "bottom" : "right";
  const sheetContentClassName = cn(
    "flex min-h-0 flex-col overflow-hidden w-full",
    !isMobile && "sm:max-w-md",
    isMobile && cn("max-h-[85vh]", "h-[calc(100vh-12px)]", "rounded-t-xl")
  );
  const scrollContainerClassName = cn(
    "flex-1 overflow-y-auto pb-4 my-0 py-0 custom-scrollbar",
    isMobile && "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  );

  const tabOptions = useMemo(
    () => [
      {
        value: "windows",
        label: (
          <>
            <Monitor size={14} aria-hidden="true" />
            {t("sessionDetail.gallery.exportSheet.tabs.windows")}
          </>
        ),
        ariaLabel: t("sessionDetail.gallery.exportSheet.tabs.windows"),
      },
      {
        value: "mac",
        label: (
          <>
            <Command size={14} aria-hidden="true" />
            {t("sessionDetail.gallery.exportSheet.tabs.mac")}
          </>
        ),
        ariaLabel: t("sessionDetail.gallery.exportSheet.tabs.mac"),
      },
      {
        value: "list",
        label: (
          <>
            <FileText size={14} aria-hidden="true" />
            {t("sessionDetail.gallery.exportSheet.tabs.list")}
          </>
        ),
        ariaLabel: t("sessionDetail.gallery.exportSheet.tabs.list"),
      },
    ],
    [t]
  );

  const helperText = useMemo(() => {
    switch (activeTab) {
      case "windows":
        return t("sessionDetail.gallery.exportSheet.tips.windows");
      case "mac":
        return t("sessionDetail.gallery.exportSheet.tips.mac");
      case "list":
        return t("sessionDetail.gallery.exportSheet.tips.list");
      default:
        return "";
    }
  }, [activeTab, t]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sideVariant} className={sheetContentClassName}>
        <SheetHeader className="border-b pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold">
                {t("sessionDetail.gallery.exportSheet.title")}
              </SheetTitle>
              <SheetDescription className="mt-1">
                {t("sessionDetail.gallery.exportSheet.description")}
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
            <SegmentedControl
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as SelectionExportTab)}
              options={tabOptions}
              size="md"
              className="w-full justify-between [&>button]:flex-1 [&>button]:justify-center [&>button]:uppercase [&>button]:tracking-wide [&>button]:font-bold"
            />

            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group ring-4 ring-gray-100">
              <div className="absolute -bottom-6 -right-6 p-8 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity duration-500">
                <FolderOpen size={140} aria-hidden="true" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 shadow-inner">
                    <ClipboardList size={24} className="text-indigo-300" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">
                      {t("sessionDetail.gallery.exportSheet.masterCard.title")}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {t("sessionDetail.gallery.exportSheet.masterCard.description")}
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 p-3 mb-5 space-y-1.5">
                  {groups.categorized.filter((group) => group.id !== FAVORITES_GROUP_ID).length > 0 ? (
                    groups.categorized
                      .filter((group) => group.id !== FAVORITES_GROUP_ID)
                      .map((group) => (
                        <div key={group.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-gray-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                            {group.title}
                          </div>
                          <span className="font-mono text-white opacity-80">{group.photos.length}</span>
                        </div>
                      ))
                  ) : (
                    <div className="text-center text-xs text-gray-500 py-1">
                      {t("sessionDetail.gallery.exportSheet.masterCard.emptyBreakdown")}
                    </div>
                  )}
                  <div className="border-t border-white/10 mt-2 pt-2 flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-400">{t("sessionDetail.gallery.exportSheet.masterCard.totalFiles")}</span>
                    <span className="text-white">{groups.all.length}</span>
                  </div>
                </div>

                <div className="grid grid-cols-[1.15fr_1fr] gap-3">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    disabled={groups.all.length === 0}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-900 font-bold text-[13px] sm:text-sm whitespace-nowrap rounded-xl hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {copiedAll ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    {copiedAll ? tCommon("copied") : t("sessionDetail.gallery.exportSheet.copyQuery")}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={groups.all.length === 0}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white border border-gray-700 font-bold text-sm whitespace-nowrap rounded-xl hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} aria-hidden="true" />
                    {t("sessionDetail.gallery.exportSheet.downloadTxt")}
                  </button>
                </div>

                {!hasAnythingToExport ? (
                  <p className="mt-4 text-xs text-gray-400">
                    {t("sessionDetail.gallery.exportSheet.emptyState")}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-gray-400" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    {t("sessionDetail.gallery.exportSheet.categories.title")}
                  </h3>
                </div>
                <span className="text-[10px] text-gray-400">
                  {t("sessionDetail.gallery.exportSheet.categories.subtitle")}
                </span>
              </div>

              <div className="space-y-3">
                {groups.categorized.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <p className="text-gray-400 text-sm font-medium">
                      {t("sessionDetail.gallery.exportSheet.categories.empty")}
                    </p>
                  </div>
                ) : null}

                {groups.categorized.map((group) => (
                  <ExportSection
                    key={group.id}
                    title={group.title}
                    count={group.photos.length}
                    icon={group.icon}
                    filenames={group.photos.map((photo) => photo.filename)}
                    query={buildExportQuery(activeTab, group.photos.map((photo) => photo.filename))}
                    activeTab={activeTab}
                    tone={group.tone}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200/50">
              <div className="flex gap-3 text-xs text-gray-500 leading-relaxed px-2">
                <div className="shrink-0 mt-0.5">
                  <Info size={16} className="text-gray-400" aria-hidden="true" />
                </div>
                <div>{helperText}</div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
