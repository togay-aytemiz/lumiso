import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";  
import { HelpCircle, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { SampleDataModal } from "@/components/SampleDataModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { ExitGuidanceModeButton } from "@/components/ExitGuidanceModeButton";
import { GuidedStepProgress } from "@/components/GuidedStepProgress";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useTranslation } from "react-i18next";

// Remove duplicate step definitions - now using centralized ones from hook

const GettingStarted = () => {
  const { t } = useTranslation('pages');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { 
    loading, 
    isInGuidedSetup, 
    isOnboardingComplete,
    currentStepInfo,
    nextStepInfo,
    completedSteps,
    isAllStepsComplete,
    totalSteps,
    currentStep,
    completeOnboarding
  } = useOnboarding();

  // If guided setup is complete, redirect to dashboard
  useEffect(() => {
    if (!loading && (!isInGuidedSetup || isOnboardingComplete)) {
      navigate('/', { replace: true });
    }
  }, [loading, isInGuidedSetup, isOnboardingComplete, navigate]);
  
  // Handle completion
  const handleComplete = async () => {
    try {
      await completeOnboarding();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  // Animation on mount and when currentStep changes
  useEffect(() => {
    if (!loading) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [currentStep, loading]);

  const handleStepAction = (step: any) => {
    if (step.id === 1 || step.id === 4 || step.id === 5) {
      navigate(`${step.route}${step.route.includes('?') ? '' : '?tutorial=true'}`);
    } else {
      navigate(step.route);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">{t('onboarding.getting_started.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-6 gap-6">
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('onboarding.getting_started.welcome_title')}</h1>
              <p className="text-sm text-muted-foreground mt-2">{t('onboarding.getting_started.welcome_subtitle')}</p>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-3">
              <Button variant="outline" size="sm">
                <HelpCircle className="w-4 h-4 mr-2" />
                {t('onboarding.getting_started.need_help')}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSampleDataModal(true)}
              >
                {t('onboarding.getting_started.skip_setup')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-safe">
        {/* Progress Section */}
        <div className={`mb-6 sm:mb-8 ${isAnimating ? 'animate-fade-in' : ''}`}>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                {t('onboarding.getting_started.setup_progress')}
                {completedSteps.length > 0 && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <GuidedStepProgress 
                  currentValue={currentStep - 1}
                  targetValue={currentStep - 1}
                  totalSteps={totalSteps}
                  animate={true}
                />
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="font-medium">
                    <span className="text-foreground">{t('onboarding.getting_started.now_label')}</span> {currentStepInfo ? t(`onboarding.steps.step_${currentStepInfo.id}.title`) : t('onboarding.getting_started.all_tasks_complete')}
                  </div>
                  {nextStepInfo && (
                    <div>
                      <span className="text-foreground">{t('onboarding.getting_started.next_label')}</span> {t(`onboarding.steps.step_${nextStepInfo.id}.title`)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Path Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            {t('onboarding.getting_started.your_learning_path')}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('onboarding.getting_started.learning_path_subtitle')}
          </p>
        </div>

        {/* Completed Steps */}
        {completedSteps.length > 0 && (
          <div className={`mb-4 ${isAnimating ? 'animate-scale-in' : ''}`}>
            <div className="space-y-2">
              {completedSteps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white flex-shrink-0">
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {t(`onboarding.steps.step_${step.id}.title`)}
                    </p>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">
                    ✓
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Task */}
        {currentStepInfo && (
          <div className={`mb-6 sm:mb-8 ${isAnimating ? 'animate-fade-in' : ''}`}>
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-lg font-bold animate-pulse">
                        {currentStepInfo.id}
                      </div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">
                          {t(`onboarding.steps.step_${currentStepInfo.id}.title`)}
                        </CardTitle>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          {t(`onboarding.steps.step_${currentStepInfo.id}.duration`)}
                        </span>
                      </div>
                    </div>
                    <CardDescription className="text-base text-muted-foreground ml-14">
                      {t(`onboarding.steps.step_${currentStepInfo.id}.description`)}
                    </CardDescription>
                  </div>
                  <div className="ml-8">
                    <Button 
                      size="lg" 
                      onClick={() => handleStepAction(currentStepInfo)}
                      className="hover-scale"
                    >
                      {t(`onboarding.steps.step_${currentStepInfo.id}.button`)}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Next Step Preview */}
        {nextStepInfo && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px bg-border flex-1"></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide px-3">{t('onboarding.getting_started.coming_next')}</span>
              <div className="h-px bg-border flex-1"></div>
            </div>
            
            <Card className="opacity-50 pointer-events-none grayscale-[0.3] hover:opacity-60 transition-opacity">
              <CardContent className="p-4 md:p-6">
                {/* Mobile-first responsive layout for next step preview */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-muted-foreground/30 text-muted-foreground text-lg font-bold flex-shrink-0">
                          {nextStepInfo.id}
                        </div>
                        <CardTitle className="text-lg sm:text-xl text-muted-foreground leading-tight">
                          {t(`onboarding.steps.step_${nextStepInfo.id}.title`)}
                        </CardTitle>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground/80 w-fit">
                        <Clock className="w-3 h-3 mr-1" />
                        {t(`onboarding.steps.step_${nextStepInfo.id}.duration`)}
                      </span>
                    </div>
                    <CardDescription className="text-sm sm:text-base text-muted-foreground/80 pl-0 sm:pl-13">
                      {t(`onboarding.steps.step_${nextStepInfo.id}.description`)}
                    </CardDescription>
                  </div>
                  <div className="flex-shrink-0">
                    <Button 
                      size="lg"
                      variant="outline"
                      disabled
                      className="opacity-50 w-full sm:w-auto"
                    >
                      {t(`onboarding.steps.step_${nextStepInfo.id}.button`)}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completion */}
        {isAllStepsComplete && (
          <div className={`text-center ${isAnimating ? 'animate-scale-in' : ''}`}>
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  {t('onboarding.getting_started.congratulations')}
                </h2>
                <p className="text-green-600 dark:text-green-300 mb-6">
                  {t('onboarding.getting_started.setup_complete')}
                </p>
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700 hover-scale"
                  onClick={handleComplete}
                >
                  {t('onboarding.getting_started.go_to_dashboard')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <SampleDataModal 
        open={showSampleDataModal}
        onClose={() => setShowSampleDataModal(false)}
      />

      <RestartGuidedModeButton />
      <ExitGuidanceModeButton />
    </div>
  );
};

export default GettingStarted;