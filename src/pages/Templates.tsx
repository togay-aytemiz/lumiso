import { useState, useEffect } from "react";
import { Plus, MessageSquare, FileText, Receipt, HelpCircle, Quote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import TemplatesSettings from "./settings/Templates";

interface TemplateCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  count: number;
  available: boolean;
}

export default function Templates() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>({});
  const { activeOrganization } = useOrganization();
  const { settings } = useOrganizationSettings();
  const { toast } = useToast();

  const categories: TemplateCategory[] = [
    {
      id: "messages",
      title: "Messages",
      description: "Email, SMS, and WhatsApp templates for client communication",
      icon: MessageSquare,
      count: templateCounts.messages || 0,
      available: true,
    },
    {
      id: "contracts",
      title: "Contracts",
      description: "Service agreements and terms for client projects",
      icon: FileText,
      count: templateCounts.contracts || 0,
      available: false,
    },
    {
      id: "invoices",
      title: "Invoices",
      description: "Payment requests and billing templates",
      icon: Receipt,
      count: templateCounts.invoices || 0,
      available: false,
    },
    {
      id: "questionnaires",
      title: "Questionnaires",
      description: "Client intake forms and project questionnaires",
      icon: HelpCircle,
      count: templateCounts.questionnaires || 0,
      available: false,
    },
    {
      id: "quotes",
      title: "Quotes",
      description: "Service estimates and project proposals",
      icon: Quote,
      count: templateCounts.quotes || 0,
      available: false,
    },
  ];

  const fetchTemplateCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('category')
        .eq('organization_id', activeOrganization?.id);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((template) => {
        const category = getCategoryFromTemplateCategory(template.category);
        counts[category] = (counts[category] || 0) + 1;
      });

      setTemplateCounts(counts);
    } catch (error) {
      console.error('Error fetching template counts:', error);
    }
  };

  const getCategoryFromTemplateCategory = (templateCategory: string): string => {
    // Map template categories to our display categories
    const categoryMap: Record<string, string> = {
      'session_confirmation': 'messages',
      'session_reminder': 'messages',
      'session_rescheduled': 'messages',
      'session_cancelled': 'messages',
      'session_completed': 'messages',
      'lead_follow_up': 'messages',
      'payment_reminder': 'messages',
      'general': 'messages',
    };
    return categoryMap[templateCategory] || 'messages';
  };

  const handleCategoryClick = (categoryId: string, available: boolean) => {
    if (!available) {
      toast({
        title: "Coming Soon",
        description: `${categories.find(c => c.id === categoryId)?.title} templates will be available in a future update.`,
      });
      return;
    }
    setSelectedCategory(categoryId);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    fetchTemplateCounts();
  };

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchTemplateCounts();
    }
  }, [activeOrganization?.id]);

  if (selectedCategory === "messages") {
    return (
      <TemplatesSettings 
        onBack={handleBackToCategories}
        organizationName={activeOrganization?.name}
        brandColor={settings?.primary_brand_color}
        logoUrl={settings?.logo_url}
        businessName={settings?.photography_business_name}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-muted-foreground mt-1">
          Manage your communication templates, contracts, and other documents
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => {
          const IconComponent = category.icon;
          return (
            <Card 
              key={category.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !category.available ? 'opacity-60' : ''
              }`}
              onClick={() => handleCategoryClick(category.id, category.available)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          {category.count} template{category.count !== 1 ? 's' : ''}
                        </span>
                        {!category.available && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-4">
                  {category.description}
                </CardDescription>
                <Button 
                  className="w-full" 
                  variant={category.available ? "default" : "secondary"}
                  disabled={!category.available}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {category.title}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}