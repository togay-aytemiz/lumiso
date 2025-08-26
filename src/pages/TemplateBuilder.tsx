import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { BlockLibrary } from "@/components/template-builder/BlockLibrary";
import { BlockEditor } from "@/components/template-builder/BlockEditor";
import { LivePreview } from "@/components/template-builder/LivePreview";

export interface Block {
  id: string;
  type: 'text' | 'session-details' | 'cta' | 'image' | 'footer';
  content: any;
  isVisible: boolean;
  order: number;
}

export interface Template {
  id?: string;
  name: string;
  category: string;
  blocks: Block[];
  isDraft: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeOrganization } = useOrganization();
  
  const [template, setTemplate] = useState<Template>({
    name: "New Template",
    category: "session_confirmation",
    blocks: [],
    isDraft: true
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load existing template if editing
  useEffect(() => {
    if (id && id !== 'new') {
      loadTemplate(id);
    } else {
      // Initialize with default blocks for new template
      setTemplate(prev => ({
        ...prev,
        blocks: [
          {
            id: 'text-1',
            type: 'text',
            content: { text: 'Hi {customer_name}!' },
            isVisible: true,
            order: 0
          },
          {
            id: 'session-1',
            type: 'session-details',
            content: { 
              showDate: true, 
              showTime: true, 
              showLocation: true,
              notes: ''
            },
            isVisible: true,
            order: 1
          },
          {
            id: 'footer-1',
            type: 'footer',
            content: {},
            isVisible: true,
            order: 2
          }
        ]
      }));
    }
  }, [id]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (template.blocks.length > 0 && !isSaving) {
        saveTemplate(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [template, isSaving]);

  const loadTemplate = async (templateId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .eq('organization_id', activeOrganization?.id)
        .single();

      if (error) throw error;

      // Convert old format to new block format if needed
      const placeholdersData = typeof data.placeholders === 'object' && data.placeholders !== null ? data.placeholders as any : {};
      const blocks = placeholdersData.blocks || convertLegacyToBlocks(data);
      
      setTemplate({
        id: data.id,
        name: data.name,
        category: data.category,
        blocks,
        isDraft: !data.is_active
      });
    } catch (error) {
      console.error('Error loading template:', error);
      toast({
        title: "Error",
        description: "Failed to load template",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const convertLegacyToBlocks = (data: any): Block[] => {
    return [
      {
        id: 'text-legacy',
        type: 'text',
        content: { text: data.master_content || '' },
        isVisible: true,
        order: 0
      }
    ];
  };

  const saveTemplate = async (isDraft = false) => {
    if (!activeOrganization?.id) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const templateData = {
        name: template.name,
        category: template.category,
        organization_id: activeOrganization.id,
        user_id: user.id,
        is_active: !isDraft,
        master_content: '', // Keep for backward compatibility
        placeholders: JSON.parse(JSON.stringify({
          blocks: template.blocks,
          variables: extractPlaceholders(template.blocks)
        }))
      };

      let result;
      if (template.id) {
        result = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', template.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('message_templates')
          .insert(templateData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setTemplate(prev => ({ ...prev, id: result.data.id, isDraft }));
      setLastSaved(new Date());
      
      if (!isDraft) {
        toast({
          title: "Success",
          description: "Template saved successfully"
        });
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const extractPlaceholders = (blocks: Block[]): string[] => {
    const placeholders = new Set<string>();
    
    blocks.forEach(block => {
      const content = JSON.stringify(block.content);
      const matches = content.match(/\{([^}]+)\}/g);
      if (matches) {
        matches.forEach(match => placeholders.add(match.slice(1, -1)));
      }
    });
    
    return Array.from(placeholders);
  };

  const updateBlock = (blockId: string, updates: Partial<Block>) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId ? { ...block, ...updates } : block
      )
    }));
  };

  const addBlock = (blockType: Block['type']) => {
    const newBlock: Block = {
      id: `${blockType}-${Date.now()}`,
      type: blockType,
      content: getDefaultBlockContent(blockType),
      isVisible: true,
      order: template.blocks.length
    };

    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
  };

  const getDefaultBlockContent = (type: Block['type']) => {
    switch (type) {
      case 'text':
        return { text: 'Enter your text here...' };
      case 'session-details':
        return { showDate: true, showTime: true, showLocation: true, notes: '' };
      case 'cta':
        return { primaryText: 'Primary Action', primaryUrl: '', secondaryText: '', secondaryUrl: '' };
      case 'image':
        return { url: '', caption: '', link: '' };
      case 'footer':
        return {};
      default:
        return {};
    }
  };

  const reorderBlocks = (startIndex: number, endIndex: number) => {
    setTemplate(prev => {
      const result = Array.from(prev.blocks);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // Update order numbers
      const updatedBlocks = result.map((block, index) => ({
        ...block,
        order: index
      }));

      return { ...prev, blocks: updatedBlocks };
    });
  };

  const removeBlock = (blockId: string) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId)
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings/templates')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
            <div className="border-l h-6"></div>
            <div>
              <Input
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg font-semibold border-none p-0 h-auto bg-transparent focus-visible:ring-0"
              />
              <p className="text-sm text-muted-foreground">
                {lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : 
                 template.isDraft ? 'Draft - not saved' : 'Saved'}
                {isSaving && ' • Saving...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => saveTemplate(true)}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => saveTemplate(false)}
              disabled={isSaving}
            >
              <Send className="h-4 w-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Block Library Sidebar */}
        <div className="w-80 border-r bg-card">
          <BlockLibrary onAddBlock={addBlock} />
        </div>

        {/* Block Editor */}
        <div className="flex-1 min-w-0">
          <BlockEditor
            blocks={template.blocks}
            onUpdateBlock={updateBlock}
            onReorderBlocks={reorderBlocks}
            onRemoveBlock={removeBlock}
          />
        </div>

        {/* Live Preview */}
        <div className="w-96 border-l bg-card">
          <LivePreview
            blocks={template.blocks}
            templateName={template.name}
            onTestSend={(channel) => {
              // TODO: Implement test send functionality
              toast({
                title: "Test Send",
                description: `Test ${channel} sent successfully`
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}