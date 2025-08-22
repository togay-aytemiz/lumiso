import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Plus } from 'lucide-react';

interface SessionGalleryProps {
  sessionId: string;
  className?: string;
}

export default function SessionGallery({ sessionId, className }: SessionGalleryProps) {
  const [images] = useState<string[]>([]); // Placeholder for future implementation

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Session Gallery</CardTitle>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
            <div className="flex items-center justify-center w-16 h-16 mb-4 bg-muted rounded-full">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No images yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Upload photos from this session to create a beautiful gallery for your client.
            </p>
            <Button variant="outline" disabled className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Images
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Coming soon
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image, index) => (
                <div key={index} className="aspect-square bg-muted rounded-lg">
                  <img 
                    src={image} 
                    alt={`Session image ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
              <button className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center hover:border-muted-foreground/50 transition-colors">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}