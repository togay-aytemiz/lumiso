import { useState } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSection from "@/components/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DangerZone() {
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDeleteAllData = async () => {
    if (!password) {
      toast({
        title: "Password Required",
        description: "Please enter your password to confirm this action.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      // Here you would implement the actual deletion logic
      // For now, we'll just simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Data Deletion Complete",
        description: "All your data has been permanently deleted.",
        variant: "destructive",
      });
      
      setPassword("");
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description: "An error occurred while deleting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="Danger Zone"
        description="These actions are destructive and cannot be undone. Proceed with caution."
      />
      
      <div className="space-y-8">
        <SettingsSection
          title="Delete All Data"
          description="Permanently remove all your data from our servers"
        >
          <div className="space-y-6">
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-3 flex-1">
                  <h3 className="font-semibold text-destructive">
                    Permanently Delete All Data
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This action will permanently delete all of your leads, projects, sessions, 
                    reminders, payments, and associated data. This action cannot be undone and 
                    all data will be lost forever.
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="w-full sm:w-auto"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                          Confirm Data Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p>
                            This action will permanently delete all of your data including:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>All leads and their information</li>
                            <li>All projects and their details</li>
                            <li>All sessions and appointments</li>
                            <li>All reminders and activities</li>
                            <li>All payment records</li>
                            <li>All custom settings and configurations</li>
                          </ul>
                          <p className="text-destructive font-medium">
                            This action cannot be undone. Please enter your account password to confirm.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Account Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="border-destructive/30 focus:border-destructive"
                        />
                      </div>
                      
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel 
                          onClick={() => setPassword("")}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAllData}
                          disabled={!password || isDeleting}
                          className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete All Data
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
        </SettingsSection>
      </div>
    </SettingsPageWrapper>
  );
}