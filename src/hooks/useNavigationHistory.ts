import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const useNavigationHistory = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Store the current path when navigating
    const currentPath = location.pathname;
    const previousPath = sessionStorage.getItem('previousPath');
    
    // Only update if this is a different path
    if (previousPath !== currentPath) {
      sessionStorage.setItem('previousPath', previousPath || '/');
      sessionStorage.setItem('currentPath', currentPath);
    }
  }, [location.pathname]);

  const goBack = () => {
    const previousPath = sessionStorage.getItem('previousPath');
    if (previousPath && previousPath !== location.pathname) {
      navigate(previousPath);
    } else {
      // Fallback navigation
      navigate(-1);
    }
  };

  const getPreviousPath = () => {
    return sessionStorage.getItem('previousPath') || '/';
  };

  return { goBack, getPreviousPath };
};