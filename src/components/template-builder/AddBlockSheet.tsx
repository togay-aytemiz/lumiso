import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Type, Calendar, MousePointer, Image, Columns3, Minus, Link, Layout, Code } from "lucide-react";
import { TemplateBlock } from "@/types/templateBuilder";
import { useTranslation } from "react-i18next";


interface AddBlockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBlock: (type: TemplateBlock["type"]) => void;
}

export function AddBlockSheet({ open, onOpenChange, onAddBlock }: AddBlockSheetProps) {
  const { t } = useTranslation();

  const blockTypes = [
    {
      type: "text" as const,
      icon: Type,
      title: t('pages:templateBuilder.addBlockSheet.blocks.text.title'),
      description: t('pages:templateBuilder.addBlockSheet.blocks.text.description'),
    },
    {
      type: "session-details" as const,
      icon: Calendar,
      title: t('pages:template_builder.addBlockSheet.blocks.sessionDetails.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.sessionDetails.description'),
    },
    {
      type: "cta" as const,
      icon: MousePointer,
      title: t('pages:template_builder.addBlockSheet.blocks.cta.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.cta.description'),
    },
    {
      type: "image" as const,
      icon: Image,
      title: t('pages:template_builder.addBlockSheet.blocks.image.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.image.description'),
    },
    {
      type: "divider" as const,
      icon: Minus,
      title: t('pages:template_builder.addBlockSheet.blocks.divider.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.divider.description'),
    },
    {
      type: "social-links" as const,
      icon: Link,
      title: t('pages:template_builder.addBlockSheet.blocks.socialLinks.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.socialLinks.description'),
    },
    {
      type: "header" as const,
      icon: Layout,
      title: t('pages:template_builder.addBlockSheet.blocks.header.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.header.description'),
    },
    {
      type: "footer" as const,
      icon: Columns3,
      title: t('pages:template_builder.addBlockSheet.blocks.footer.title'),
      description: t('pages:template_builder.addBlockSheet.blocks.footer.description'),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[45vw] min-w-[600px]">
        <SheetHeader>
          <SheetTitle>{t('pages:template_builder.addBlockSheet.title')}</SheetTitle>
          <SheetDescription>
            {t('pages:template_builder.addBlockSheet.description')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 h-full overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 pb-4">
            {blockTypes.map((blockType) => {
              const Icon = blockType.icon;
              return (
                <Card 
                  key={blockType.type}
                  className="cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:border-primary/20 transition-all duration-200"
                  onClick={() => onAddBlock(blockType.type)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-primary/10 text-primary rounded-lg flex-shrink-0">
                        <Icon className="h-10 w-10" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{blockType.title}</CardTitle>
                        <CardDescription className="text-sm mt-2 leading-relaxed">
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