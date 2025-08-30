import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TemplateBlock } from "@/types/templateBuilder";
import { Loader2, Mail, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: TemplateBlock[];
  emailSubject: string;
  preheader?: string;
  mockData: Record<string, string>;
}

export function EmailTestDialog({
  open,
  onOpenChange,
  blocks,
  emailSubject,
  preheader,
  mockData
}: EmailTestDialogProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<{ html: string; text: string } | null>(null);
  const { toast } = useToast();

  const generatePreview = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-template-email', {
        body: {
          to: 'preview@example.com',
          subject: emailSubject,
          preheader,
          blocks,
          mockData,
          isTest: true,
          preview: true
        }
      });

      if (error) throw error;

      setPreview(data.preview);
    } catch (error: any) {
      console.error('Preview generation error:', error);
      toast({
        title: "Preview Error",
        description: error.message || "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-template-email', {
        body: {
          to: email,
          subject: emailSubject,
          preheader,
          blocks,
          mockData,
          isTest: true
        }
      });

      if (error) throw error;

      toast({
        title: "Test Email Sent!",
        description: `Test email sent successfully to ${email}`,
      });

      setEmail("");
      onOpenChange(false);
    } catch (error: any) {
      console.error('Send email error:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test Email Template
          </DialogTitle>
          <DialogDescription>
            Send a test email or preview how your template will look to recipients.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="send" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send">Send Test</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="Enter email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label>Email Details</Label>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Subject:</strong> {emailSubject || 'No subject'}</p>
                  {preheader && <p><strong>Preheader:</strong> {preheader}</p>}
                  <p><strong>Blocks:</strong> {blocks.length}</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={sendTestEmail} disabled={isLoading || !email.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {!preview ? (
              <div className="text-center py-8">
                <Button onClick={generatePreview} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Generate Preview
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="html" className="flex-1">
                <TabsList>
                  <TabsTrigger value="html">HTML Preview</TabsTrigger>
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="mt-4">
                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <div 
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                      className="w-full"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="text" className="mt-4">
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                      {preview.text}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {preview && (
                <Button onClick={generatePreview} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Refresh Preview
                </Button>
              )}
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}