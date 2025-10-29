import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Plus } from 'lucide-react';

interface SessionGalleryProps {
  sessionId: string;
  className?: string;
}

export default function SessionGallery({ sessionId, className }: SessionGalleryProps) {
  const [images] = useState<string[]>([]); // Placeholder for future implementation
  const { t } = useTranslation('pages');

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('sessionDetail.gallery.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
            <div className="flex items-center justify-center w-16 h-16 mb-4 bg-muted rounded-full">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {t('sessionDetail.gallery.emptyState.title')}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {t('sessionDetail.gallery.emptyState.description')}
            </p>
            <Button variant="outline" disabled className="gap-2">
              <Upload className="w-4 h-4" />
              {t('sessionDetail.gallery.emptyState.button')}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {t('sessionDetail.gallery.emptyState.comingSoon')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image, index) => (
                <div key={index} className="aspect-square bg-muted rounded-lg">
                  <img 
                    src={image} 
                    alt={t('sessionDetail.gallery.imageAlt', { index: index + 1 })}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
              <button
                className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
                aria-label={t('sessionDetail.gallery.addImageAriaLabel')}
              >
                <Plus className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
