import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, FileText, ClipboardList, ScrollText } from "lucide-react";

const categories = [
  {
    id: "messages",
    title: "Messages",
    description: "Email, SMS, and WhatsApp templates",
    icon: MessageSquare,
    active: true
  },
  {
    id: "quotes",
    title: "Quotes",
    description: "Project proposal and quote templates",
    icon: FileText,
    active: false
  },
  {
    id: "questionnaires",
    title: "Questionnaires",
    description: "Client intake and feedback forms",
    icon: ClipboardList,
    active: false
  },
  {
    id: "contracts",
    title: "Contracts",
    description: "Service agreements and terms",
    icon: ScrollText,
    active: false
  }
];

export default function AutomationTemplates() {
  const [activeCategory, setActiveCategory] = useState("messages");

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageHeader 
        title="Templates" 
        subtitle="Manage your templates for automated communications and client interactions"
      />
      
      <div className="p-4 sm:p-6">
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                disabled={!category.active}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {category.title}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <TabsContent key={category.id} value={category.id} className="space-y-4">
              {category.active ? (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <div className="text-center">
                    <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">
                      {category.title} Templates
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Template builder coming soon
                    </p>
                  </div>
                </div>
              ) : (
                <Card>
                  <CardHeader className="text-center">
                    <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <CardTitle className="text-muted-foreground">Coming Soon</CardTitle>
                    <CardDescription>
                      {category.description} will be available in a future update
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </TabsContent>
          );
        })}
        </Tabs>
      </div>
    </div>
  );
}