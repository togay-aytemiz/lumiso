import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import Layout from "./Layout";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const { inGuidedSetup, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();

  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to getting-started if user is in guided setup mode and not already there
  if (inGuidedSetup && location.pathname !== "/getting-started") {
    return <Navigate to="/getting-started" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedRoute;