import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If user is on /settings exactly, redirect to profile
    if (location.pathname === "/settings") {
      navigate("/settings/profile", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null; // The redirect will handle routing
};

export default Settings;