import { useOnboarding } from "@/hooks/useOnboarding";
import { GuidedStepProgress } from "@/components/GuidedStepProgress";
import { DeveloperSettings } from "@/components/DeveloperSettings";

export default function GettingStarted() {
  const { inGuidedSetup } = useOnboarding();

  if (!inGuidedSetup) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-3xl font-bold">Welcome to Lumiso!</h1>
          <p className="text-lg text-muted-foreground">
            You've completed the guided setup. You now have full access to all features.
          </p>
        </div>
        <DeveloperSettings />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to Lumiso!</h1>
          <p className="text-lg text-muted-foreground">
            Let's get you set up step by step. Complete each task to unlock more features.
          </p>
        </div>

        <GuidedStepProgress />
      </div>
      <DeveloperSettings />
    </div>
  );
}