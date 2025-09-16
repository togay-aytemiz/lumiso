import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Language, TranslationNamespace, TranslationKey, Translation } from "@/i18n/types";
import { Globe, Languages, FileText, Upload, Download, Plus, Edit, Trash } from "lucide-react";

export default function AdminLocalization() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [namespaces, setNamespaces] = useState<TranslationNamespace[]>([]);
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load languages
      const { data: languagesData } = await supabase
        .from('languages')
        .select('*')
        .order('sort_order');
      
      // Load namespaces
      const { data: namespacesData } = await supabase
        .from('translation_namespaces')
        .select('*')
        .order('name');
      
      // Load translation keys
      const { data: keysData } = await supabase
        .from('translation_keys')
        .select('*')
        .order('key_name');
      
      // Load translations
      const { data: translationsData } = await supabase
        .from('translations')
        .select('*');

      setLanguages(languagesData || []);
      setNamespaces(namespacesData || []);
      setKeys(keysData || []);
      setTranslations(translationsData || []);
      
      if (namespacesData && namespacesData.length > 0) {
        setSelectedNamespace(namespacesData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load localization data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = async (languageId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('languages')
        .update({ is_active: isActive })
        .eq('id', languageId);

      if (error) throw error;

      setLanguages(prev => prev.map(lang => 
        lang.id === languageId ? { ...lang, is_active: isActive } : lang
      ));

      toast({
        title: "Success",
        description: `Language ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error('Error updating language:', error);
      toast({
        title: "Error",
        description: "Failed to update language",
        variant: "destructive",
      });
    }
  };

  const filteredKeys = selectedNamespace 
    ? keys.filter(key => key.namespace_id === selectedNamespace)
    : keys;

  const getTranslation = (keyId: string, languageCode: string) => {
    return translations.find(t => t.key_id === keyId && t.language_code === languageCode);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Localization</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Localization</h1>
          <p className="text-muted-foreground">
            Manage languages and translations for your application
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="languages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="languages" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Languages
          </TabsTrigger>
          <TabsTrigger value="translations" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Translations
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Languages className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Languages</CardTitle>
              <CardDescription>
                Configure which languages are available in your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Language</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Native Name</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {languages.map((language) => (
                    <TableRow key={language.id}>
                      <TableCell className="font-medium">{language.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{language.code.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{language.native_name}</TableCell>
                      <TableCell>
                        {language.is_default && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={language.is_active}
                          onCheckedChange={(checked) => toggleLanguage(language.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="translations" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="namespace">Namespace</Label>
              <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                <SelectTrigger className="w-[200px] mt-1">
                  <SelectValue placeholder="Select namespace" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map((namespace) => (
                    <SelectItem key={namespace.id} value={namespace.id}>
                      {namespace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Key
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Translation Keys</CardTitle>
              <CardDescription>
                Manage translation keys and their values across languages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Key</TableHead>
                      {languages
                        .filter(lang => lang.is_active)
                        .map(language => (
                          <TableHead key={language.code} className="min-w-[200px]">
                            {language.native_name}
                            <Badge variant="outline" className="ml-2">
                              {language.code.toUpperCase()}
                            </Badge>
                          </TableHead>
                        ))}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeys.slice(0, 10).map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.key_name}</TableCell>
                        {languages
                          .filter(lang => lang.is_active)
                          .map(language => {
                            const translation = getTranslation(key.id, language.code);
                            return (
                              <TableCell key={language.code}>
                                <div className="space-y-1">
                                  <Input
                                    value={translation?.value || ''}
                                    placeholder={`Enter ${language.native_name} translation`}
                                    className="text-sm"
                                  />
                                  {translation && !translation.is_approved && (
                                    <Badge variant="outline" className="text-xs">
                                      Pending
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {filteredKeys.length > 10 && (
                <div className="mt-4 text-center">
                  <Badge variant="secondary">
                    Showing 10 of {filteredKeys.length} keys
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Localization Settings</CardTitle>
              <CardDescription>
                Configure global localization preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Auto-detect browser language</Label>
                <div className="flex items-center space-x-2">
                  <Switch defaultChecked />
                  <span className="text-sm text-muted-foreground">
                    Automatically set user language based on browser settings
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Fallback language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                  {languages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.native_name}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Translation progress threshold</Label>
                <Input 
                  type="number" 
                  defaultValue="80" 
                  className="w-[200px]"
                />
                <span className="text-sm text-muted-foreground">
                  Minimum percentage of translations required to show a language
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}