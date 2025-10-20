import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import Layout from "./Layout";
import { useTranslation } from "react-i18next";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const { shouldLockNavigation, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();
  const { t } = useTranslation("common");

  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">{t("actions.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow access to onboarding step pages when in guided setup
  const onboardingStepPaths = [
    "/getting-started",
    "/settings/profile", 
    "/settings/general", // Add this missing path!
    "/leads",
    "/projects", 
    "/calendar",
    "/settings/services"
  ];
  
  // Redirect to getting-started if user is in guided setup mode and not on an allowed page
  if (shouldLockNavigation && !onboardingStepPaths.some(path => location.pathname.startsWith(path))) {
    return <Navigate to="/getting-started" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedRoute;