import { useState } from "react";
import { CheckCircle, Users, FolderOpen, Calendar, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";

interface SampleDataModalProps {
  open: boolean;
  onClose: () => void;
  onCloseAll?: () => void;
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

export function SampleDataModal({ open, onClose, onCloseAll }: SampleDataModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { startGuidedSetup } = useOnboarding();

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
        title: "Setup skipped!",
        description: "You can start exploring Lumiso. Sample data will be added in a future update.",
      });

      // Close all modals and redirect to leads page
      if (onCloseAll) {
        onCloseAll();
      } else {
        onClose();
      }
      navigate('/leads');
      
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

  const handleContinueGuidedSetup = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await startGuidedSetup();
      
      if (onCloseAll) {
        onCloseAll();
      } else {
        onClose();
      }
      // Note: startGuidedSetup() includes navigation to /getting-started via window.location.reload()
    } catch (error) {
      console.error('Error starting guided setup:', error);
      toast({
        title: "Error",
        description: "Failed to start guided setup. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const actions: OnboardingAction[] = [
    {
      label: isLoading ? "Starting..." : "Continue Guided Setup",
      onClick: handleContinueGuidedSetup,
      variant: "outline",
      disabled: isLoading
    },
    {
      label: isLoading ? "Setting up..." : "Start with Sample Data",
      onClick: handleSkipWithSampleData,
      variant: "cta",
      disabled: isLoading
    }
  ];

  return (
    <BaseOnboardingModal
      open={open}
      onClose={onClose}
      title="Skip Setup & Use Sample Data?"
      description="We'll populate your CRM with realistic sample data so you can explore all features immediately. You can always customize or clear this data later."
      actions={actions}
    >
      <div className="space-y-4">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
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
    </BaseOnboardingModal>
  );
}