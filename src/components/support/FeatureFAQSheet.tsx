import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BellRing,
  Boxes,
  CalendarRange,
  Compass,
  CreditCard,
  FileQuestion,
  Search as SearchIcon,
  ShieldCheck,
  Smartphone,
  Users2,
  Workflow,
  X,
} from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { featureFaqCategories, searchFeatureFaq, type FeatureFaqCategory } from "@/data/featureFaq";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface FeatureFAQSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIconMap: Record<string, LucideIcon> = {
  Başlarken: Compass,
  "Giriş ve Güvenlik": ShieldCheck,
  "Kişiler, Projeler ve Seanslar": Users2,
  "Hizmetler ve Paketler": Boxes,
  "Ödemeler ve Kapora": CreditCard,
  "Takvim ve Hatırlatmalar": CalendarRange,
  "Şablonlar ve Otomasyon": Workflow,
  "Bildirimler ve Günlük Özetler": BellRing,
  "Arama ve Mobil Deneyim": Smartphone,
};

function getCategoryIcon(categoryName: string) {
  return categoryIconMap[categoryName] ?? FileQuestion;
}

export function FeatureFAQSheet({ open, onOpenChange }: FeatureFAQSheetProps) {
  const { t } = useTranslation(["navigation", "common"]);
  const isMobile = useIsMobile();
  const [selectedCategory, setSelectedCategory] = useState<FeatureFaqCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim();
  const searchResults = useMemo(
    () => (normalizedQuery ? searchFeatureFaq(normalizedQuery) : []),
    [normalizedQuery]
  );
  const showSearchResults = normalizedQuery.length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedCategory(null);
      setSearchQuery("");
    }
    onOpenChange(nextOpen);
  };

  const handleSelectCategory = (category: FeatureFaqCategory) => {
    setSelectedCategory(category);
  };

  const searchLabel = t("help.faq_sheet.search_label");
  const categoriesHeading = t("help.faq_sheet.categories_heading");

  const renderCategoryList = () => {
    if (!featureFaqCategories.length) {
      return <p className="text-sm text-muted-foreground">{t("help.faq_sheet.empty_state")}</p>;
    }

    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{categoriesHeading}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {featureFaqCategories.map((category) => {
            const Icon = getCategoryIcon(category.category);
            return (
              <button
                key={category.category}
                type="button"
                onClick={() => handleSelectCategory(category)}
                className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-semibold">{category.category}</span>
                    <span className="text-sm text-muted-foreground">
                      {t("help.faq_sheet.question_count", { count: category.entries.length })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{category.entries[0]?.question ?? ""}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCategoryAccordion = () => {
    if (!selectedCategory) return null;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => setSelectedCategory(null)}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("help.faq_sheet.back_to_categories")}
          </Button>
          <div>
            <p className="text-lg font-semibold">{selectedCategory.category}</p>
            <p className="text-sm text-muted-foreground">
              {t("help.faq_sheet.question_count", { count: selectedCategory.entries.length })}
            </p>
          </div>
        </div>

        {selectedCategory.entries.length ? (
          <Accordion type="multiple" className="space-y-2">
            {selectedCategory.entries.map((entry) => (
              <AccordionItem key={entry.id} value={entry.id}>
                <AccordionTrigger className="text-left text-base">{entry.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{entry.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-sm text-muted-foreground">{t("help.faq_sheet.empty_category_state")}</p>
        )}
      </div>
    );
  };

  const renderSearchResults = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {t("help.faq_sheet.search_results", { count: searchResults.length })}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
          {t("help.faq_sheet.clear_search")}
        </Button>
      </div>

      {searchResults.length ? (
        <Accordion type="multiple" className="space-y-2">
          {searchResults.map((entry) => (
            <AccordionItem key={`search-${entry.id}`} value={`search-${entry.id}`}>
              <AccordionTrigger className="text-left">
                <div className="flex flex-col items-start gap-1 text-left">
                  <span className="text-base font-semibold">{entry.question}</span>
                  <Badge variant="outline">{entry.category}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{entry.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <p className="text-sm text-muted-foreground">{t("help.faq_sheet.no_results")}</p>
      )}
    </div>
  );

  const content = showSearchResults ? renderSearchResults() : selectedCategory ? renderCategoryAccordion() : renderCategoryList();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "w-full bg-background p-0 sm:max-w-3xl",
          isMobile ? "h-[90vh] rounded-t-3xl" : "h-full border-l"
        )}
      >
        <div className="flex h-full flex-col gap-4 p-6 pb-0">
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle>{t("help.faq_sheet.title")}</SheetTitle>
            <SheetDescription>{t("help.faq_sheet.description")}</SheetDescription>
          </SheetHeader>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{searchLabel}</p>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("help.faq_sheet.search_placeholder")}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">{t("help.faq_sheet.clear_search")}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <div className="pb-6">{content}</div>
            </ScrollArea>
          </div>

          {/* Fixed bottom close button */}
          <div className="sticky bottom-0 border-t bg-background px-6 py-4 -mx-6">
            <Button
              variant="surface"
              className="btn-surface-accent w-full"
              onClick={() => handleOpenChange(false)}
            >
              {t("help.close")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
