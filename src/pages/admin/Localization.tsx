import { useState, useEffect, useRef } from "react";
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
        title: "Success",
        description: "Translation updated successfully",
      });
    } catch (error) {
      console.error('Error updating translation:', error);
      toast({
        title: "Error",
        description: "Failed to update translation",
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
        title: "Success",
        description: `Successfully uploaded ${successCount} translation file(s)`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `Uploaded ${successCount}/${totalCount} files successfully`,
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
            {isProcessing ? "Processing..." : "Upload"}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Download Translation Files</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Individual Files</h4>
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
                  <h4 className="font-medium">Language Packs</h4>
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
                        {lang.toUpperCase()} Complete Pack
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
                  Download All Translations
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Translation Workflow:</strong> This system uses JSON files for translations. 
          Download existing files, translate them in your preferred tool, and upload the updated files back. 
          File format: <code className="bg-muted px-1 rounded">{`{"key": "value", "nested": {"key": "value"}}`}</code>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="json-manager" className="space-y-4">
        <TabsList>
          <TabsTrigger value="json-manager" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            JSON Translation Manager
          </TabsTrigger>
          <TabsTrigger value="languages" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Languages (DB)
          </TabsTrigger>
          <TabsTrigger value="translations" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Translations (DB)
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Languages className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="json-manager" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Translation Status</CardTitle>
                <CardDescription>Current translation file statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(getTranslationStats()).map(([lang, namespaces]) => (
                    <div key={lang} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{lang.toUpperCase()}</h4>
                        <Badge variant="outline">{Object.values(namespaces).reduce((a, b) => a + b, 0)} keys</Badge>
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
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common translation management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Download Individual Files</h4>
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
                  <h4 className="font-medium text-sm">Download Language Packs</h4>
                  {getAvailableLanguages().map(lang => (
                    <Button
                      key={lang}
                      variant="outline"
                      size="sm"
                      onClick={() => downloadLanguagePack(lang)}
                      className="w-full justify-start"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      {lang.toUpperCase()} Complete Pack
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={downloadAllTranslations}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All Translations
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Translation Workflow Guide</CardTitle>
              <CardDescription>Step-by-step guide for managing translations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
                      <h4 className="font-medium">Download</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Download the translation file(s) you want to work with. Choose individual files or complete language packs.
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</div>
                      <h4 className="font-medium">Translate</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Edit the JSON files using any text editor or translation tool. Maintain the structure and only change the values.
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">3</div>
                      <h4 className="font-medium">Upload</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upload the modified files back to the system. The changes will be validated and applied.
                    </p>
                  </div>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-medium mb-2">Example JSON Structure:</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
{`{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "labels": {
    "name": "Name",
    "email": "Email"
  }
}`}
                  </pre>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Pro Tips:</strong> Use translation tools like Crowdin, Weblate, or even Google Translate for bulk translations. 
                    Always test your translations in the app after uploading to ensure proper formatting.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
            <div className="flex gap-4 items-end">
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
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search keys or translations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[250px] mt-1"
                />
              </div>
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
                                      placeholder={`Enter ${language.native_name} translation`}
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
                                          Click to add translation...
                                        </span>
                                      )}
                                    </div>
                                  )}
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
              
              {searchFilteredKeys.length === 0 && (
                <div className="mt-4 text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No translation keys match your search.' : 'No translation keys found.'}
                  </p>
                </div>
              )}
              
              {searchFilteredKeys.length > 0 && (
                <div className="mt-4 text-center">
                  <Badge variant="secondary">
                    Showing {searchFilteredKeys.length} keys
                    {searchQuery && ` (filtered from ${filteredKeys.length})`}
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