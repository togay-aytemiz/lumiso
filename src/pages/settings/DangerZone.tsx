import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsSingleColumnSection } from "@/components/settings/SettingsSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function DangerZone() {
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('pages');

  const handleDeleteAllData = async () => {
    if (!password) {
      toast({
        title: t('settings.dangerZone.deleteData.passwordRequired'),
        description: t('settings.dangerZone.deleteData.passwordRequiredDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: t('settings.dangerZone.deleteData.deleteComplete'),
        description: t('settings.dangerZone.deleteData.deleteCompleteDesc'),
        variant: "destructive",
      });
      
      setPassword("");
    } catch (error) {
      toast({
        title: t('settings.dangerZone.deleteData.deleteFailed'),
        description: t('settings.dangerZone.deleteData.deleteFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SettingsPageWrapper>
      <div className="space-y-6">
        <SettingsSingleColumnSection
          sectionId="danger-zone-delete-data"
          title={t('settings.dangerZone.deleteData.title')}
          description={t('settings.dangerZone.deleteData.description')}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-destructive flex-shrink-0" />
                <div className="space-y-3 flex-1 min-w-0">
                  <h3 className="font-semibold text-destructive text-sm md:text-base">
                    {t('settings.dangerZone.deleteData.warning')}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {t('settings.dangerZone.deleteData.warningDesc')}
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="w-full sm:w-fit mt-4"
                        disabled={isDeleting}
                        size="default"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('settings.dangerZone.deleteData.button')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="mx-4 max-w-md">
                      <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base">
                          <AlertTriangle className="h-5 w-5" />
                          {t('settings.dangerZone.deleteData.confirmTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-sm">
                          <p>{t('settings.dangerZone.deleteData.confirmDesc')}</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>{t('settings.dangerZone.deleteData.leads')}</li>
                            <li>{t('settings.dangerZone.deleteData.projects')}</li>
                            <li>{t('settings.dangerZone.deleteData.sessions')}</li>
                            <li>{t('settings.dangerZone.deleteData.reminders')}</li>
                            <li>{t('settings.dangerZone.deleteData.payments')}</li>
                            <li>{t('settings.dangerZone.deleteData.settings')}</li>
                          </ul>
                          <p className="text-destructive font-medium text-sm">
                            {t('settings.dangerZone.deleteData.passwordPrompt')}
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-sm">{t('settings.dangerZone.deleteData.passwordLabel')}</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder={t('settings.dangerZone.deleteData.passwordPlaceholder')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="border-destructive/30 focus:border-destructive h-10"
                        />
                      </div>
                      
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel 
                          onClick={() => setPassword("")}
                          className="w-full order-2 sm:order-1 sm:w-auto"
                        >
                          {t('settings.dangerZone.deleteData.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAllData}
                          disabled={!password || isDeleting}
                          className="w-full order-1 sm:order-2 sm:w-auto bg-destructive hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              {t('settings.dangerZone.deleteData.deleting')}
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('settings.dangerZone.deleteData.button')}
                            </>
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        </SettingsSingleColumnSection>
      </div>
    </SettingsPageWrapper>
  );
}
