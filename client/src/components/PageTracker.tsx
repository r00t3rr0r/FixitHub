import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { autoTrackPageView } from '../api/tracking';

/**
 * PageTracker - Automatic page view tracking component
 * Tracks every route change and sends a page_view event to the backend
 */
export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on every route change
    autoTrackPageView();
  }, [location.pathname, location.search]);

  return null;
}
