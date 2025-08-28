import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Type, Calendar, MousePointer, Image, Columns3 } from "lucide-react";
import { TemplateBlock } from "@/types/templateBuilder";

interface AddBlockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBlock: (type: TemplateBlock["type"]) => void;
}

const blockTypes = [
  {
    type: "text" as const,
    icon: Type,
    title: "Text Block",
    description: "Rich text with formatting, links, and placeholders",
  },
  {
    type: "session-details" as const,
    icon: Calendar,
    title: "Session Details",
    description: "Date, time, location displayed cleanly with optional notes",
  },
  {
    type: "cta" as const,
    icon: MousePointer,
    title: "Call to Action",
    description: "Primary and secondary action buttons",
  },
  {
    type: "image" as const,
    icon: Image,
    title: "Image Block",
    description: "Insert brand image, uploaded file, or cover with caption + link option",
  },
  {
    type: "footer" as const,
    icon: Columns3,
    title: "Footer Block",
    description: "Logo, studio name, contact info auto-injected",
  },
];

export function AddBlockSheet({ open, onOpenChange, onAddBlock }: AddBlockSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Block Library</SheetTitle>
          <SheetDescription>
            Choose a block to add to your template. Blocks can be reordered and customized after adding.
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {blockTypes.map((blockType) => {
            const Icon = blockType.icon;
            return (
              <Card 
                key={blockType.type}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => onAddBlock(blockType.type)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-md">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">{blockType.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {blockType.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}