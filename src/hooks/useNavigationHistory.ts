import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PREVIOUS_ROUTE_KEY = 'previousRoute';

export const useNavigationHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const previousLocation = useRef<string>('');

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // If we're navigating TO a session or project detail page, 
    // store the previous location as the route to go back to
    if (currentPath.match(/\/(sessions|projects)\/[^/]+$/)) {
      if (previousLocation.current && !previousLocation.current.match(/\/(sessions|projects)\/[^/]+$/)) {
        console.log('📍 Navigation History: Storing previous route:', previousLocation.current, 'for current:', currentPath);
        sessionStorage.setItem(PREVIOUS_ROUTE_KEY, previousLocation.current);
      }
    }
    
    // Always update the previous location for next navigation
    previousLocation.current = currentPath;
  }, [location]);

  const goBack = (fallbackRoute = '/') => {
    const previousRoute = sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
    console.log('🔙 Navigation History: Going back. Previous route:', previousRoute, 'Current:', location.pathname, 'Fallback:', fallbackRoute);
    
    if (previousRoute && previousRoute !== location.pathname) {
      // Clear the stored route so we don't use it again
      sessionStorage.removeItem(PREVIOUS_ROUTE_KEY);
      navigate(previousRoute);
    } else {
      navigate(fallbackRoute);
    }
  };

  const getPreviousRoute = () => {
    return sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
  };

  const setPreviousRoute = (route: string) => {
    console.log('📍 Navigation History: Manually setting previous route:', route);
    sessionStorage.setItem(PREVIOUS_ROUTE_KEY, route);
  };

  return { goBack, getPreviousRoute, setPreviousRoute };
};