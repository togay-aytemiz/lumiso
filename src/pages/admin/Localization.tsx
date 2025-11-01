import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Language } from "@/i18n/types";
import { useTranslationFiles } from "@/hooks/useTranslationFiles";
import { Globe, FileText, Upload, Download, Edit, Info, FileDown, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommonTranslation } from "@/hooks/useTypedTranslation";
import { SegmentedControl } from "@/components/ui/segmented-control";

type SegmentValue = "json-manager" | "languages";

export default function AdminLocalization() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<SegmentValue>("json-manager");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    downloadLanguageFile,
    downloadLanguagePack,
    downloadAllTranslations,
    uploadTranslationFile,
    getAvailableLanguages,
    getNamespacesForLanguage,
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
      setLanguages(languagesData || []);
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
                    {getAvailableLanguages().flatMap(lang =>
                      getNamespacesForLanguage(lang).map(ns => (
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

      <div className="space-y-4">
        <SegmentedControl
          value={activeSegment}
          onValueChange={(value) => setActiveSegment(value as SegmentValue)}
          options={[
            {
              value: "json-manager",
              label: (
                <span className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  {t("admin.localization.tabs.jsonManager")}
                </span>
              ),
            },
            {
              value: "languages",
              label: (
                <span className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  {t("admin.localization.tabs.languages")}
                </span>
              ),
            },
          ]}
        />

        {activeSegment === "json-manager" && (
          <div className="space-y-4">
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
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">{t("admin.localization.cards.quickActions.downloadIndividual")}</h4>
                    <div className="space-y-3">
                      {getAvailableLanguages().map(lang => (
                        <div key={lang} className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            {lang.toUpperCase()}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {getNamespacesForLanguage(lang).map(ns => (
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
                            ))}
                          </div>
                        </div>
                      ))}
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
          </div>
        )}

        {activeSegment === "languages" && (
          <div className="space-y-4">
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
          </div>
        )}
      </div>
    </div>
  );
}
