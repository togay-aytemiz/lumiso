import { TemplateBlock } from "@/types/templateBuilder";
import { generatePlainText } from "@/lib/templateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlainTextPreviewProps {
  blocks: TemplateBlock[];
  mockData: Record<string, string>;
}

export function PlainTextPreview({ blocks, mockData }: PlainTextPreviewProps) {
  const { toast } = useToast();
  const plainText = generatePlainText(blocks, mockData);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(plainText);
    toast({
      title: "Copied to clipboard",
      description: "Plain text version has been copied to your clipboard.",
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Plain Text Preview</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="h-7 px-2"
            aria-label="Copy plain text preview"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 rounded-md p-3">
          <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">
            {plainText || "No content yet. Add some blocks to see the plain text version."}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
