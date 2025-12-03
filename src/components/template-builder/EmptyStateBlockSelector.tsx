import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Type, Calendar, MousePointer, Image, Columns3, Minus, Link, Layout } from "lucide-react";
import { TemplateBlock } from "@/types/templateBuilder";
import { useTranslation } from "react-i18next";
import "../template-builder/AddBlockSheet.css";

interface EmptyStateBlockSelectorProps {
    onAddBlock: (type: TemplateBlock["type"]) => void;
}

export function EmptyStateBlockSelector({ onAddBlock }: EmptyStateBlockSelectorProps) {
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
        <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="text-center mb-8 max-w-2xl">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {t('pages:templateBuilder.emptyState.title', { defaultValue: 'Template Builder' })}
                </h3>
                <p className="text-sm text-slate-600">
                    {t('pages:templateBuilder.emptyState.description', {
                        defaultValue: 'Drag and drop blocks to create your email template. Select a block below to get started.'
                    })}
                </p>
            </div>

            <div className="w-full max-w-4xl">
                <div className="grid grid-cols-2 gap-4">
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
        </div>
    );
}
