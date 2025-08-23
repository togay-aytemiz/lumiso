import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PREVIOUS_ROUTE_KEY = 'previousRoute';

export const useNavigationHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Store the current route as the previous route when navigating away
    const currentPath = location.pathname + location.search;
    
    // Don't store session or project detail pages as previous routes
    if (!currentPath.match(/\/(sessions|projects)\/[^/]+$/)) {
      sessionStorage.setItem(PREVIOUS_ROUTE_KEY, currentPath);
    }
  }, [location]);

  const goBack = (fallbackRoute = '/') => {
    const previousRoute = sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
    
    if (previousRoute && previousRoute !== location.pathname) {
      navigate(previousRoute);
    } else {
      navigate(fallbackRoute);
    }
  };

  const getPreviousRoute = () => {
    return sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
  };

  return { goBack, getPreviousRoute };
};