import { useState, useEffect, useRef, useMemo } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Language, TranslationNamespace, TranslationKey, Translation } from "@/i18n/types";
import { useTranslationFiles } from "@/hooks/useTranslationFiles";
import { Globe, Languages, FileText, Upload, Download, Plus, Edit, Trash, Info, FileDown, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommonTranslation } from "@/hooks/useTypedTranslation";

export default function AdminLocalization() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [namespaces, setNamespaces] = useState<TranslationNamespace[]>([]);
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingTranslation, setEditingTranslation] = useState<{keyId: string, languageCode: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    downloadLanguageFile,
    downloadLanguagePack,
    downloadAllTranslations,
    uploadTranslationFile,
    getAvailableLanguages,
    getAvailableNamespaces,
    getTranslationStats,
    isProcessing,
  } = useTranslationFiles();
  const { t: tCommon } = useCommonTranslation();
  const { t, i18n } = useTranslation("pages");
  const workflowSteps = useMemo(
    () =>
      t("admin.localization.cards.workflow.steps", {
        returnObjects: true,
      }) as Array<{ title: string; description: string }>,
    [t, i18n.language]
  );

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
        title: tCommon("toast.error"),
        description: t("admin.localization.toast.loadError"),
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
        title: tCommon("toast.success"),
        description: isActive
          ? t("admin.localization.toast.languageActivated")
          : t("admin.localization.toast.languageDeactivated"),
      });
    } catch (error) {
      console.error('Error updating language:', error);
      toast({
        title: tCommon("toast.error"),
        description: t("admin.localization.toast.languageUpdateError"),
        variant: "destructive",
      });
    }
  };

  const filteredKeys = selectedNamespace 
    ? keys.filter(key => key.namespace_id === selectedNamespace)
    : keys;

  const searchFilteredKeys = searchQuery 
    ? filteredKeys.filter(key => 
        key.key_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        translations.some(t => 
          t.key_id === key.id && 
          t.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : filteredKeys;

  const getTranslation = (keyId: string, languageCode: string) => {
    return translations.find(t => t.key_id === keyId && t.language_code === languageCode);
  };

  const updateTranslation = async (keyId: string, languageCode: string, value: string) => {
    try {
      const existingTranslation = getTranslation(keyId, languageCode);
      
      if (existingTranslation) {
        // Update existing translation
        const { error } = await supabase
          .from('translations')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('id', existingTranslation.id);
          
        if (error) throw error;
        
        setTranslations(prev => prev.map(t => 
          t.id === existingTranslation.id ? { ...t, value } : t
        ));
      } else {
        // Create new translation
        const { data, error } = await supabase
          .from('translations')
          .insert({ key_id: keyId, language_code: languageCode, value })
          .select()
          .single();
          
        if (error) throw error;
        
        setTranslations(prev => [...prev, data]);
      }
      
      toast({
        title: tCommon("toast.success"),
        description: t("admin.localization.toast.translationUpdated"),
      });
    } catch (error) {
      console.error('Error updating translation:', error);
      toast({
        title: tCommon("toast.error"),
        description: t("admin.localization.toast.translationUpdateError"),
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Process files with file writing capability
    const results = await Promise.all(
      Array.from(files).map(async (file) => {
        // Create a file writer function that will write files immediately
        const fileWriter = async (filePath: string, content: string) => {
          // Create a promise that will be resolved when the file is written
          await writeTranslationFile(filePath, content);
        };
        
        return uploadTranslationFile(file, fileWriter);
      })
    );

    const successCount = results.filter(Boolean).length;
    const totalCount = results.length;

    if (successCount === totalCount) {
      toast({
        title: tCommon("toast.success"),
        description: t("admin.localization.toast.uploadSuccess", { count: successCount }),
      });
    } else {
      toast({
        title: tCommon("toast.warning"),
        description: t("admin.localization.toast.uploadPartial", { success: successCount, total: totalCount }),
        variant: "destructive",
      });
    }

    // Reset the input and reload data
    event.target.value = '';
    await loadData();
  };

  // Function to handle actual file writing
  const writeTranslationFile = async (filePath: string, content: string) => {
    // Store the file write request for batch processing
    const pendingWrites = JSON.parse(localStorage.getItem('pendingTranslationWrites') || '[]');
    pendingWrites.push({ filePath, content, timestamp: Date.now() });
    localStorage.setItem('pendingTranslationWrites', JSON.stringify(pendingWrites));
    
    // Trigger immediate processing
    processPendingWrites();
  };

  // Process pending file writes
  const processPendingWrites = () => {
    const pendingWrites = JSON.parse(localStorage.getItem('pendingTranslationWrites') || '[]');
    if (pendingWrites.length > 0) {
      // Emit custom event that parent component can listen to
      window.dispatchEvent(new CustomEvent('processPendingTranslationWrites', {
        detail: { writes: pendingWrites }
      }));
      // Clear pending writes
      localStorage.removeItem('pendingTranslationWrites');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("admin.localization.title")}</h1>
            <p className="text-muted-foreground">{t("admin.localization.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.localization.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.localization.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isProcessing ? t("admin.localization.buttons.processing") : t("admin.localization.buttons.upload")}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                {t("admin.localization.buttons.download")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("admin.localization.dialog.title")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">{t("admin.localization.dialog.individual")}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableLanguages().map(lang => 
                      getAvailableNamespaces().map(ns => (
                        <Button
                          key={`${lang}-${ns}`}
                          variant="outline"
                          size="sm"
                          onClick={() => downloadLanguageFile(lang, ns)}
                          className="text-xs"
                        >
                          <FileDown className="w-3 h-3 mr-1" />
                          {lang}/{ns}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">{t("admin.localization.dialog.packs")}</h4>
                  <div className="space-y-1">
                    {getAvailableLanguages().map(lang => (
                      <Button
                        key={lang}
                        variant="outline"
                        size="sm"
                        onClick={() => downloadLanguagePack(lang)}
                        className="w-full justify-start"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        {t("admin.localization.dialog.completePack", { code: lang.toUpperCase() })}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="default"
                  onClick={downloadAllTranslations}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("admin.localization.buttons.downloadAll")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{t("admin.localization.alert.title")}</strong>{" "}
          {t("admin.localization.alert.description")}
          <div className="mt-2">
            <span>{t("admin.localization.alert.formatLabel")} </span>
            <code className="bg-muted px-1 rounded">
              {t("admin.localization.alert.formatCode")}
            </code>
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="json-manager" className="space-y-4">
        <TabsList>
          <TabsTrigger value="json-manager" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("admin.localization.tabs.jsonManager")}
          </TabsTrigger>
          <TabsTrigger value="languages" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t("admin.localization.tabs.languages")}
          </TabsTrigger>
          <TabsTrigger value="translations" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("admin.localization.tabs.translations")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Languages className="w-4 h-4" />
            {t("admin.localization.tabs.settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="json-manager" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.localization.cards.status.title")}</CardTitle>
                <CardDescription>{t("admin.localization.cards.status.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(getTranslationStats()).map(([lang, namespaces]) => (
                    <div key={lang} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{lang.toUpperCase()}</h4>
                        <Badge variant="outline">
                          {t("admin.localization.cards.status.keysBadge", {
                            count: Object.values(namespaces).reduce((a, b) => a + b, 0),
                          })}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(namespaces).map(([ns, count]) => (
                          <div key={ns} className="flex justify-between">
                            <span className="text-muted-foreground">{ns}:</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin.localization.cards.quickActions.title")}</CardTitle>
                <CardDescription>{t("admin.localization.cards.quickActions.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">{t("admin.localization.cards.quickActions.downloadIndividual")}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableLanguages().map(lang => 
                      getAvailableNamespaces().slice(0, 4).map(ns => (
                        <Button
                          key={`${lang}-${ns}`}
                          variant="outline"
                          size="sm"
                          onClick={() => downloadLanguageFile(lang, ns)}
                          className="text-xs justify-start"
                        >
                          <FileDown className="w-3 h-3 mr-1" />
                          {lang}/{ns}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">{t("admin.localization.cards.quickActions.downloadPacks")}</h4>
                  {getAvailableLanguages().map(lang => (
                    <Button
                      key={lang}
                      variant="outline"
                      size="sm"
                      onClick={() => downloadLanguagePack(lang)}
                      className="w-full justify-start"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      {t("admin.localization.dialog.completePack", { code: lang.toUpperCase() })}
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={downloadAllTranslations}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("admin.localization.buttons.downloadAll")}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.localization.cards.workflow.title")}</CardTitle>
              <CardDescription>{t("admin.localization.cards.workflow.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {workflowSteps.map((step, index) => (
                    <div key={step.title} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <h4 className="font-medium">{step.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  ))}
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-medium mb-2">{t("admin.localization.cards.workflow.exampleTitle")}</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
{t("admin.localization.cards.workflow.exampleCode")}
                  </pre>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t("admin.localization.cards.workflow.alertTitle")}</strong> {t("admin.localization.alert.proTipsDescription")}
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.localization.languagesTable.title")}</CardTitle>
              <CardDescription>
                {t("admin.localization.languagesTable.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.localization.languagesTable.headers.language")}</TableHead>
                    <TableHead>{t("admin.localization.languagesTable.headers.code")}</TableHead>
                    <TableHead>{t("admin.localization.languagesTable.headers.nativeName")}</TableHead>
                    <TableHead>{t("admin.localization.languagesTable.headers.default")}</TableHead>
                    <TableHead>{t("admin.localization.languagesTable.headers.status")}</TableHead>
                    <TableHead>{t("admin.localization.languagesTable.headers.actions")}</TableHead>
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
                          <Badge variant="secondary">{t("admin.localization.languagesTable.badges.default")}</Badge>
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
            <div className="flex gap-4 items-end">
              <div>
                <Label htmlFor="namespace">{t("admin.localization.translations.namespaceLabel")}</Label>
                <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                  <SelectTrigger className="w-[200px] mt-1">
                    <SelectValue placeholder={t("admin.localization.translations.namespacePlaceholder")} />
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
              <div>
                <Label htmlFor="search">{t("admin.localization.translations.searchLabel")}</Label>
                <Input
                  id="search"
                  placeholder={t("admin.localization.translations.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[250px] mt-1"
                />
              </div>
            </div>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t("admin.localization.buttons.addKey")}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.localization.translations.table.title")}</CardTitle>
              <CardDescription>
                {t("admin.localization.translations.table.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">{t("admin.localization.translations.table.headers.key")}</TableHead>
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
                      <TableHead>{t("admin.localization.translations.table.headers.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchFilteredKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.key_name}</TableCell>
                        {languages
                          .filter(lang => lang.is_active)
                          .map(language => {
                            const translation = getTranslation(key.id, language.code);
                            const isEditing = editingTranslation?.keyId === key.id && editingTranslation?.languageCode === language.code;
                            return (
                              <TableCell key={language.code}>
                                <div className="space-y-1">
                                  {isEditing ? (
                                    <Textarea
                                      value={translation?.value || ''}
                                      onChange={(e) => {
                                        updateTranslation(key.id, language.code, e.target.value);
                                      }}
                                      onBlur={() => setEditingTranslation(null)}
                                      placeholder={t("admin.localization.translations.table.inputPlaceholder", { language: language.native_name })}
                                      className="text-sm min-h-[60px] resize-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <div
                                      className="min-h-[40px] p-2 border rounded cursor-pointer hover:bg-muted/50 text-sm"
                                      onClick={() => setEditingTranslation({keyId: key.id, languageCode: language.code})}
                                    >
                                  {translation?.value || (
                                    <span className="text-muted-foreground italic">
                                      {t("admin.localization.translations.table.clickToAdd")}
                                    </span>
                                  )}
                                </div>
                              )}
                              {translation && !translation.is_approved && (
                                <Badge variant="outline" className="text-xs">
                                  {t("admin.localization.languagesTable.badges.pending")}
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
              
              {searchFilteredKeys.length === 0 && (
                <div className="mt-4 text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? t("admin.localization.translations.table.emptySearch")
                      : t("admin.localization.translations.table.empty")}
                  </p>
                </div>
              )}
              
              {searchFilteredKeys.length > 0 && (
                <div className="mt-4 text-center">
                  <Badge variant="secondary">
                    {t("admin.localization.translations.table.showing", { count: searchFilteredKeys.length })}
                    {searchQuery &&
                      t("admin.localization.translations.table.filtered", { total: filteredKeys.length })}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.localization.settings.title")}</CardTitle>
              <CardDescription>
                {t("admin.localization.settings.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("admin.localization.settings.autoDetect.label")}</Label>
                <div className="flex items-center space-x-2">
                  <Switch defaultChecked />
                  <span className="text-sm text-muted-foreground">
                    {t("admin.localization.settings.autoDetect.description")}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>{t("admin.localization.settings.fallback.label")}</Label>
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
                <Label>{t("admin.localization.settings.threshold.label")}</Label>
                <Input 
                  type="number" 
                  defaultValue="80" 
                  className="w-[200px]"
                />
                <span className="text-sm text-muted-foreground">
                  {t("admin.localization.settings.threshold.description")}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
