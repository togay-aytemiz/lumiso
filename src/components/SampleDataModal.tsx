import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Users, FolderOpen, Calendar, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface SampleDataModalProps {
  open: boolean;
  onClose: () => void;
}

const sampleDataItems = [
  {
    icon: Users,
    title: "Sample Leads",
    description: "Pre-filled client leads with realistic contact information"
  },
  {
    icon: FolderOpen, 
    title: "Example Projects",
    description: "Photography projects in different stages of completion"
  },
  {
    icon: Calendar,
    title: "Scheduled Sessions", 
    description: "Upcoming and past photo sessions to explore"
  },
  {
    icon: Package,
    title: "Photography Packages",
    description: "Ready-to-use service packages with pricing"
  }
];

export function SampleDataModal({ open, onClose }: SampleDataModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSkipWithSampleData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Update user settings to mark guided setup as skipped
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          in_guided_setup: false,
          guided_setup_skipped: true 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Sample data activated!",
        description: "Your CRM is now populated with sample data to explore.",
      });

      // Close modal and redirect to leads page
      onClose();
      navigate('/leads');
      
      // TODO: Trigger sample data seeding in next phase
      
    } catch (error) {
      console.error('Error skipping setup:', error);
      toast({
        title: "Error",
        description: "Failed to skip setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg mx-auto">
        <DialogHeader className="px-6 pt-6 text-center">
          <DialogTitle className="text-xl">Skip Setup & Use Sample Data?</DialogTitle>
          <DialogDescription className="text-base mt-3">
            We'll populate your CRM with realistic sample data so you can explore all features immediately. 
            You can always customize or clear this data later.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6">
          <div className="mb-6">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
              What's included:
            </h4>
            <div className="space-y-4">
              {sampleDataItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <h5 className="font-medium text-sm">{item.title}</h5>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-center gap-4 pt-4 pb-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="min-h-[44px] sm:w-auto"
              disabled={isLoading}
            >
              Continue Guided Setup
            </Button>
            <Button 
              onClick={handleSkipWithSampleData}
              disabled={isLoading}
              className="min-h-[44px] sm:w-auto"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Setting up...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Start with Sample Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}