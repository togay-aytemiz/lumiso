import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Type, Calendar, MousePointer, Image, Columns3, Minus, Link, Layout, X } from "lucide-react";
import { TemplateBlock } from "@/types/templateBuilder";
import { useTranslation } from "react-i18next";
import "./AddBlockSheet.css";


interface AddBlockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBlock: (type: TemplateBlock["type"]) => void;
}

export function AddBlockSheet({ open, onOpenChange, onAddBlock }: AddBlockSheetProps) {
  const { t } = useTranslation();

  const blockTypes = [
    {
      type: "header" as const,
      icon: Layout,
      title: t('pages:templateBuilder.addBlockSheet.blocks.header.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.header.description'),
    },
    {
      type: "text" as const,
      icon: Type,
      title: t('pages:templateBuilder.addBlockSheet.blocks.text.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.text.description'),
    },
    {
      type: "image" as const,
      icon: Image,
      title: t('pages:templateBuilder.addBlockSheet.blocks.image.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.image.description'),
    },
    {
      type: "session-details" as const,
      icon: Calendar,
      title: t('pages:templateBuilder.addBlockSheet.blocks.sessionDetails.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.sessionDetails.description'),
    },
    {
      type: "cta" as const,
      icon: MousePointer,
      title: t('pages:templateBuilder.addBlockSheet.blocks.cta.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.cta.description'),
    },
    {
      type: "social-links" as const,
      icon: Link,
      title: t('pages:templateBuilder.addBlockSheet.blocks.socialLinks.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.socialLinks.description'),
    },
    {
      type: "divider" as const,
      icon: Minus,
      title: t('pages:templateBuilder.addBlockSheet.blocks.divider.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.divider.description'),
    },
    {
      type: "footer" as const,
      icon: Columns3,
      title: t('pages:templateBuilder.addBlockSheet.blocks.footer.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.footer.description'),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[45vw] min-w-[600px]">
        <SheetClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </SheetClose>

        <SheetHeader>
          <SheetTitle>{t('pages:templateBuilder.addBlockSheet.title')}</SheetTitle>
          <SheetDescription>
            {t('pages:templateBuilder.addBlockSheet.description')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 h-full overflow-y-auto pt-3">
          <div className="grid grid-cols-2 gap-4 pb-4">
            {blockTypes.map((blockType) => {
              const Icon = blockType.icon;
              return (
                <Card 
                  key={blockType.type}
                  className="block-library-card group h-full cursor-pointer rounded-2xl border border-slate-200/70 bg-white/90"
                  onClick={() => onAddBlock(blockType.type)}
                >
                  <CardHeader className="block-library-inner relative pb-4 md:pb-5">
                    <div className="flex items-start gap-4 md:gap-5">
                      <div className="block-library-icon">
                        <Icon className="h-10 w-10" aria-hidden="true" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <CardTitle className="text-base text-slate-900">{blockType.title}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed text-slate-600">
                          {blockType.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
